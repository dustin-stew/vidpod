"""
benchmark: spark vs pandas on flightcast data.
run as databricks notebook.
"""

# COMMAND ----------

import os
import time
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from pyspark.sql import functions as F
from pyspark.sql.window import Window

WORK_DIR = os.getcwd()
TEMP_PATH = os.path.join(WORK_DIR, "_benchmark_data.parquet")
RESULTS_PATH = os.path.join(WORK_DIR, "benchmark_results.txt")

spark_df = spark.table("silver.flightcast.playback_events")
row_count = spark_df.count()
print(f"Dataset: {row_count:,} playback events")

# cache as local parquet for pandas
pdf_full = spark_df.toPandas()
pdf_full.attrs = {}
pq.write_table(pa.Table.from_pandas(pdf_full, preserve_index=False), TEMP_PATH)
print(f"Cached to {TEMP_PATH}\n")
del pdf_full

with open(RESULTS_PATH, "w") as f:
    f.write(f"BENCHMARK RESULTS -- {row_count:,} rows\n")
    f.write("=" * 60 + "\n\n")

# COMMAND ----------

# benchmark 1: daily aggregation

print("=" * 60)
print("BENCHMARK 1: Daily multi-metric aggregation")
print("=" * 60)

t0 = time.time()
pdf = pd.read_parquet(TEMP_PATH)
pandas_daily = (
    pdf.groupby("event_date")
    .agg(
        total_views=("views", "sum"),
        total_watch_time=("watch_time_ms", "sum"),
        total_likes=("likes", "sum"),
        total_comments=("comments", "sum"),
        total_shares=("shares", "sum"),
        unique_users=("user_id_hash", "nunique"),
    )
)
t_pandas_1 = time.time() - t0
n_days = len(pandas_daily)
del pdf
print(f"  Pandas:  {t_pandas_1:.2f}s  ({n_days} days)")

t0 = time.time()
spark_daily = (
    spark_df.groupBy("event_date")
    .agg(
        F.sum("views").alias("total_views"),
        F.sum("watch_time_ms").alias("total_watch_time"),
        F.sum("likes").alias("total_likes"),
        F.sum("comments").alias("total_comments"),
        F.sum("shares").alias("total_shares"),
        F.countDistinct("user_id_hash").alias("unique_users"),
    )
    .collect()
)
t_spark_1 = time.time() - t0
print(f"  Spark:   {t_spark_1:.2f}s  ({len(spark_daily)} days)")
print(f"  Speedup: {t_pandas_1 / t_spark_1:.1f}x\n")

with open(RESULTS_PATH, "a") as f:
    f.write(f"1. Daily multi-metric aggregation\n")
    f.write(f"   Pandas: {t_pandas_1:.2f}s | Spark: {t_spark_1:.2f}s | Speedup: {t_pandas_1/t_spark_1:.1f}x\n\n")

# COMMAND ----------

# benchmark 2: episode overlap self-join

print("=" * 60)
print("BENCHMARK 2: Episode audience overlap (self-join)")
print("=" * 60)

t0 = time.time()
pdf = pd.read_parquet(TEMP_PATH, columns=["user_id_hash", "video_id"])
user_eps_pdf = pdf.drop_duplicates()
del pdf
merged = user_eps_pdf.merge(user_eps_pdf, on="user_id_hash", suffixes=("_a", "_b"))
merged = merged[merged["video_id_a"] < merged["video_id_b"]]
pandas_overlap = (
    merged.groupby(["video_id_a", "video_id_b"])
    .size()
    .reset_index(name="shared_users")
    .sort_values("shared_users", ascending=False)
)
t_pandas_2 = time.time() - t0
n_pairs_pd = len(pandas_overlap)
del user_eps_pdf, merged, pandas_overlap
print(f"  Pandas:  {t_pandas_2:.2f}s  ({n_pairs_pd} pairs)")

t0 = time.time()
ue = spark_df.select("user_id_hash", "video_id").distinct()
spark_overlap = (
    ue.alias("a")
    .join(
        ue.alias("b"),
        (F.col("a.user_id_hash") == F.col("b.user_id_hash"))
        & (F.col("a.video_id") < F.col("b.video_id")),
    )
    .groupBy(
        F.col("a.video_id").alias("episode_a"),
        F.col("b.video_id").alias("episode_b"),
    )
    .agg(F.count("*").alias("shared_users"))
    .orderBy(F.desc("shared_users"))
    .collect()
)
t_spark_2 = time.time() - t0
print(f"  Spark:   {t_spark_2:.2f}s  ({len(spark_overlap)} pairs)")
print(f"  Speedup: {t_pandas_2 / t_spark_2:.1f}x\n")

with open(RESULTS_PATH, "a") as f:
    f.write(f"2. Episode audience overlap (self-join)\n")
    f.write(f"   Pandas: {t_pandas_2:.2f}s | Spark: {t_spark_2:.2f}s | Speedup: {t_pandas_2/t_spark_2:.1f}x\n\n")

# COMMAND ----------

# benchmark 3: window deduplication

print("=" * 60)
print("BENCHMARK 3: Window-based deduplication")
print("=" * 60)

t0 = time.time()
pdf = pd.read_parquet(TEMP_PATH)
pandas_deduped = (
    pdf.sort_values("_ingested_at", ascending=False)
    .drop_duplicates(subset=["user_id_hash", "video_id", "event_timestamp"], keep="first")
)
n_dedup_pd = len(pandas_deduped)
t_pandas_3 = time.time() - t0
del pdf, pandas_deduped
print(f"  Pandas:  {t_pandas_3:.2f}s  ({n_dedup_pd} rows after dedup)")

t0 = time.time()
w = Window.partitionBy("user_id_hash", "video_id", "event_timestamp").orderBy(F.desc("_ingested_at"))
spark_deduped = (
    spark_df
    .withColumn("_rn", F.row_number().over(w))
    .filter(F.col("_rn") == 1)
    .drop("_rn")
    .count()
)
t_spark_3 = time.time() - t0
print(f"  Spark:   {t_spark_3:.2f}s  ({spark_deduped} rows after dedup)")
print(f"  Speedup: {t_pandas_3 / t_spark_3:.1f}x\n")

with open(RESULTS_PATH, "a") as f:
    f.write(f"3. Window-based deduplication\n")
    f.write(f"   Pandas: {t_pandas_3:.2f}s | Spark: {t_spark_3:.2f}s | Speedup: {t_pandas_3/t_spark_3:.1f}x\n\n")

# COMMAND ----------

# summary

print("=" * 60)
print(f"SUMMARY -- {row_count:,} rows")
print("=" * 60)
print(f"{'Operation':<35} {'Pandas':>8} {'Spark':>8} {'Speedup':>8}")
print("-" * 60)
print(f"{'Daily multi-metric agg':<35} {t_pandas_1:>7.2f}s {t_spark_1:>7.2f}s {t_pandas_1/t_spark_1:>7.1f}x")
print(f"{'Episode overlap (self-join)':<35} {t_pandas_2:>7.2f}s {t_spark_2:>7.2f}s {t_pandas_2/t_spark_2:>7.1f}x")
print(f"{'Window dedup':<35} {t_pandas_3:>7.2f}s {t_spark_3:>7.2f}s {t_pandas_3/t_spark_3:>7.1f}x")

with open(RESULTS_PATH, "a") as f:
    f.write("=" * 60 + "\n")
    f.write(f"{'Operation':<35} {'Pandas':>8} {'Spark':>8} {'Speedup':>8}\n")
    f.write("-" * 60 + "\n")
    f.write(f"{'Daily multi-metric agg':<35} {t_pandas_1:>7.2f}s {t_spark_1:>7.2f}s {t_pandas_1/t_spark_1:>7.1f}x\n")
    f.write(f"{'Episode overlap (self-join)':<35} {t_pandas_2:>7.2f}s {t_spark_2:>7.2f}s {t_pandas_2/t_spark_2:>7.1f}x\n")
    f.write(f"{'Window dedup':<35} {t_pandas_3:>7.2f}s {t_spark_3:>7.2f}s {t_pandas_3/t_spark_3:>7.1f}x\n")

print(f"\nResults saved to {RESULTS_PATH}")

# COMMAND ----------

os.remove(TEMP_PATH)
print(f"Cleaned up {TEMP_PATH}")
