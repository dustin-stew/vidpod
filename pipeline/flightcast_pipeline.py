"""
flightcast dlt pipeline: bronze > silver > gold
tables written to bronze.flightcast, silver.flightcast, gold.flightcast
"""

import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window

S3_SOURCE_PATH = "s3a://flightcast-data/raw"

BRONZE = "bronze.flightcast"
SILVER = "silver.flightcast"
GOLD   = "gold.flightcast"


# bronze

@dlt.table(name=f"{BRONZE}.playback_events", comment="raw playback events from s3")
def bronze_playback_events():
    return (
        spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "parquet")
        .option("cloudFiles.schemaLocation", f"{S3_SOURCE_PATH}/playback_events/_schema")
        .option("cloudFiles.schemaHints", "timestamp TIMESTAMP, views INT, watch_time_ms BIGINT, likes INT, comments INT, shares INT")
        .load(f"{S3_SOURCE_PATH}/playback_events/")
        .withColumn("_ingested_at", F.current_timestamp())
        .withColumn("_source_file", F.col("_metadata.file_path"))
    )


@dlt.table(name=f"{BRONZE}.ad_events", comment="raw ad funnel events")
def bronze_ad_events():
    return (
        spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "parquet")
        .option("cloudFiles.schemaLocation", f"{S3_SOURCE_PATH}/ad_events/_schema")
        .option("cloudFiles.schemaHints", "timestamp TIMESTAMP")
        .load(f"{S3_SOURCE_PATH}/ad_events/")
        .withColumn("_ingested_at", F.current_timestamp())
        .withColumn("_source_file", F.col("_metadata.file_path"))
    )


@dlt.table(name=f"{BRONZE}.ad_opportunities", comment="raw ad opportunity data")
def bronze_ad_opportunities():
    return (
        spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "parquet")
        .option("cloudFiles.schemaLocation", f"{S3_SOURCE_PATH}/ad_opportunities/_schema")
        .option("cloudFiles.schemaHints", "timestamp TIMESTAMP, opportunities INT, filled INT, unfilled INT")
        .load(f"{S3_SOURCE_PATH}/ad_opportunities/")
        .withColumn("_ingested_at", F.current_timestamp())
        .withColumn("_source_file", F.col("_metadata.file_path"))
    )


# silver: cleaned, typed, deduplicated

@dlt.table(name=f"{SILVER}.playback_events", comment="cleaned deduplicated playback events")
@dlt.expect_all_or_drop({
    "has_user":     "user_id_hash IS NOT NULL",
    "has_video":    "video_id IS NOT NULL",
    "has_show":     "show_id IS NOT NULL",
    "valid_views":  "views > 0",
})
@dlt.expect_all({
    "valid_watch_time":  "watch_time_ms >= 0",
    "valid_timestamp":   "event_timestamp IS NOT NULL",
    "known_provider":    "provider IN ('youtube', 'spotify', 'apple', 'rss')",
})
def silver_playback_events():
    df = dlt.read(f"{BRONZE}.playback_events")

    df_clean = (
        df
        .withColumn("event_timestamp", F.col("timestamp"))
        .withColumn("event_date", F.to_date("timestamp"))
        .withColumn("show_id", F.trim(F.col("show_id")))
        .withColumn("video_id", F.trim(F.col("video_id")))
        .withColumn("user_id_hash", F.trim(F.col("user_id_hash")))
        .withColumn("provider", F.lower(F.trim(F.col("provider"))))
        .withColumn("country", F.upper(F.trim(F.col("country"))))
        .withColumn("device_type", F.lower(F.trim(F.col("device_type"))))
        .withColumn("source", F.lower(F.trim(F.col("source"))))
        .withColumn("watch_time_ms", F.greatest(F.lit(0), F.least(F.col("watch_time_ms"), F.lit(86_400_000))))
    )

    # dedup: keep latest per user+video+timestamp
    window = Window.partitionBy("user_id_hash", "video_id", "event_timestamp").orderBy(F.desc("_ingested_at"))
    df_deduped = (
        df_clean
        .withColumn("_row_num", F.row_number().over(window))
        .filter(F.col("_row_num") == 1)
        .drop("_row_num")
    )

    return df_deduped.select(
        "event_timestamp", "event_date", "show_id", "video_id",
        "user_id_hash", "provider", "views", "watch_time_ms",
        "likes", "comments", "shares", "country", "device_type",
        "source", "_ingested_at",
    )


@dlt.table(name=f"{SILVER}.ad_events", comment="cleaned deduplicated ad events")
@dlt.expect_all_or_drop({
    "has_campaign":   "campaign_id IS NOT NULL",
    "has_ad":         "ad_id IS NOT NULL",
    "has_show":       "show_id IS NOT NULL",
    "valid_event_type": "event_type IN ('impression','start','first_quartile','midpoint','third_quartile','complete','click')",
})
def silver_ad_events():
    df = dlt.read(f"{BRONZE}.ad_events")

    df_clean = (
        df
        .withColumn("event_timestamp", F.col("timestamp"))
        .withColumn("event_date", F.to_date("timestamp"))
        .withColumn("event_type", F.lower(F.trim(F.col("event_type"))))
        .withColumn("country", F.upper(F.trim(F.col("country"))))
    )

    window = Window.partitionBy("ad_id", "video_id", "event_type", "event_timestamp").orderBy(F.desc("_ingested_at"))
    df_deduped = (
        df_clean
        .withColumn("_row_num", F.row_number().over(window))
        .filter(F.col("_row_num") == 1)
        .drop("_row_num")
    )

    return df_deduped.select(
        "event_timestamp", "event_date", "campaign_id", "ad_id",
        "show_id", "video_id", "event_type", "country", "_ingested_at",
    )


@dlt.table(name=f"{SILVER}.ad_opportunities", comment="cleaned ad opportunity data")
@dlt.expect_all_or_drop({
    "has_show":              "show_id IS NOT NULL",
    "positive_opportunities": "opportunities > 0",
})
@dlt.expect_all({
    "filled_lte_total":      "filled <= opportunities",
    "unfilled_consistent":   "unfilled = opportunities - filled",
})
def silver_ad_opportunities():
    df = dlt.read(f"{BRONZE}.ad_opportunities")

    df_clean = (
        df
        .withColumn("event_timestamp", F.col("timestamp"))
        .withColumn("event_date", F.to_date("timestamp"))
        .withColumn("country", F.upper(F.trim(F.col("country"))))
    )

    window = Window.partitionBy("show_id", "video_id", "event_timestamp").orderBy(F.desc("_ingested_at"))
    df_deduped = (
        df_clean
        .withColumn("_row_num", F.row_number().over(window))
        .filter(F.col("_row_num") == 1)
        .drop("_row_num")
    )

    return df_deduped.select(
        "event_timestamp", "event_date", "show_id", "video_id",
        "country", "opportunities", "filled", "unfilled", "_ingested_at",
    )


# silver: derived tables

@dlt.table(name=f"{SILVER}.user_episodes", comment="distinct user-episode pairs")
def silver_user_episodes():
    return (
        dlt.read(f"{SILVER}.playback_events")
        .select("user_id_hash", "video_id")
        .distinct()
    )


@dlt.table(name=f"{SILVER}.user_first_seen", comment="first event date per user")
def silver_user_first_seen():
    return (
        dlt.read(f"{SILVER}.playback_events")
        .groupBy("user_id_hash")
        .agg(F.min("event_date").alias("first_date"))
    )


@dlt.table(name=f"{SILVER}.dim_episodes", comment="episode dimension from event data")
def silver_dim_episodes():
    return (
        dlt.read(f"{SILVER}.playback_events")
        .groupBy("video_id", "show_id")
        .agg(
            F.min("event_date").alias("published_at"),
            F.max("watch_time_ms").alias("duration_ms"),
        )
    )


# gold: rollup tables (10 graphs)

# graph 1: episode overlap
@dlt.table(name=f"{GOLD}.episode_overlap", comment="audience overlap between episodes")
def gold_episode_overlap():
    ue = dlt.read(f"{SILVER}.user_episodes")
    episode_users = ue.groupBy("video_id").agg(F.count("*").alias("total_users"))

    pairs = (
        ue.alias("a")
        .join(ue.alias("b"),
              (F.col("a.user_id_hash") == F.col("b.user_id_hash")) &
              (F.col("a.video_id") < F.col("b.video_id")))
        .groupBy(F.col("a.video_id").alias("episode_a"),
                 F.col("b.video_id").alias("episode_b"))
        .agg(F.count("*").alias("shared_users"))
    )

    return (
        pairs.join(episode_users.alias("ea"),
                   F.col("episode_a") == F.col("ea.video_id"))
        .select(
            "episode_a", "episode_b", "shared_users",
            F.col("ea.total_users").alias("users_in_a"),
            F.round(100.0 * F.col("shared_users") / F.col("ea.total_users"), 1).alias("overlap_percent"),
        )
        .orderBy(F.desc("shared_users"))
    )


# graph 2: listener retention funnel
@dlt.table(name=f"{GOLD}.listener_retention_funnel", comment="episodes-watched funnel")
def gold_listener_retention_funnel():
    ue = dlt.read(f"{SILVER}.user_episodes")

    user_counts = (
        ue.groupBy("user_id_hash")
        .agg(F.countDistinct("video_id").alias("episodes_watched"))
    )
    total_users = user_counts.count()
    buckets = spark.createDataFrame([(1,), (2,), (3,), (5,), (10,)], ["threshold"])

    return (
        buckets.crossJoin(user_counts)
        .filter(F.col("episodes_watched") >= F.col("threshold"))
        .groupBy("threshold")
        .agg(F.count("*").alias("users"))
        .withColumn("episodes_watched_bucket", F.concat(F.col("threshold"), F.lit("+")))
        .withColumn("percent_of_total_users", F.round(100.0 * F.col("users") / F.lit(total_users), 1))
        .select("episodes_watched_bucket", "users", "percent_of_total_users")
        .orderBy("threshold")
    )


# graph 3: new vs returning users
@dlt.table(name=f"{GOLD}.new_vs_returning", comment="daily new vs returning users")
def gold_new_vs_returning():
    pe = dlt.read(f"{SILVER}.playback_events")
    first_seen = dlt.read(f"{SILVER}.user_first_seen")
    daily_users = pe.select("event_date", "user_id_hash").distinct()
    joined = daily_users.join(first_seen, "user_id_hash")

    return (
        joined.groupBy(F.col("event_date").alias("day"))
        .agg(
            F.sum(F.when(F.col("first_date") == F.col("event_date"), 1).otherwise(0)).alias("new_users"),
            F.sum(F.when(F.col("first_date") < F.col("event_date"), 1).otherwise(0)).alias("returning_users"),
        )
        .orderBy("day")
    )


# graph 4: relative performance
@dlt.table(name=f"{GOLD}.relative_performance", comment="latest 10 episodes ranked fairly")
def gold_relative_performance():
    pe = dlt.read(f"{SILVER}.playback_events")
    eps = dlt.read(f"{SILVER}.dim_episodes")

    # fairness window: compare using first X days only
    latest_10 = eps.orderBy(F.desc("published_at")).limit(10)
    latest_with_window = latest_10.crossJoin(
        latest_10.agg(F.max("published_at").alias("newest_pub"))
    ).withColumn(
        "window_days",
        F.greatest(F.datediff(F.current_date(), F.col("newest_pub")), F.lit(1))
    ).select("video_id", "published_at", "window_days")

    windowed = (
        pe.join(latest_with_window, "video_id")
        .filter(
            (F.col("event_date") >= F.col("published_at")) &
            (F.col("event_date") < F.date_add(F.col("published_at"), F.col("window_days")))
        )
        .groupBy("video_id", "window_days")
        .agg(
            F.sum("views").alias("views"),
            F.sum(F.when(F.col("provider") != "youtube", F.col("views")).otherwise(0)).alias("listens"),
            F.sum("likes").alias("likes"),
            F.sum("comments").alias("comments"),
            F.sum("shares").alias("shares"),
            F.sum("watch_time_ms").alias("watch_time"),
        )
    )

    # unpivot and rank per metric
    metrics = ["views", "listens", "likes", "comments", "shares", "watch_time"]
    frames = []
    for m in metrics:
        ranked = (
            windowed.select(
                F.col("video_id").alias("episode_id"),
                F.lit(m).alias("metric"),
                F.col("window_days"),
                F.col(m).alias("value"),
            )
            .withColumn("rank", F.rank().over(Window.orderBy(F.desc("value"))))
            .withColumn("out_of", F.count("*").over(Window.orderBy(F.lit(1))))
        )
        frames.append(ranked)

    result = frames[0]
    for f in frames[1:]:
        result = result.unionByName(f)
    return result.orderBy("metric", "rank")


# graph 5: daily performance trend
@dlt.table(name=f"{GOLD}.daily_performance", comment="daily views, listens, watch time")
def gold_daily_performance():
    return (
        dlt.read(f"{SILVER}.playback_events")
        .groupBy(F.col("event_date").alias("day"))
        .agg(
            F.sum("views").alias("views"),
            F.sum(F.when(F.col("provider") != "youtube", F.col("views")).otherwise(0)).alias("listens"),
            F.sum("views").alias("streams"),
            F.sum("watch_time_ms").alias("watch_time"),
        )
        .orderBy("day")
    )


# graph 6: audience source breakdown
@dlt.table(name=f"{GOLD}.audience_source", comment="daily views by traffic source")
def gold_audience_source():
    daily_source = (
        dlt.read(f"{SILVER}.playback_events")
        .groupBy(F.col("event_date").alias("day"), "source")
        .agg(F.sum("views").alias("views"))
    )
    w = Window.partitionBy("day")
    return (
        daily_source
        .withColumn("share_percent", F.round(100.0 * F.col("views") / F.sum("views").over(w), 1))
        .orderBy("day", "source")
    )


# graph 7: geography breakdown
@dlt.table(name=f"{GOLD}.geo_breakdown", comment="views and users by country")
def gold_geo_breakdown():
    return (
        dlt.read(f"{SILVER}.playback_events")
        .groupBy("country")
        .agg(
            F.sum("views").alias("views"),
            F.sum(F.when(F.col("provider") != "youtube", F.col("views")).otherwise(0)).alias("listens"),
            F.countDistinct("user_id_hash").alias("unique_users"),
        )
        .orderBy(F.desc("views"))
    )


# graph 8: device/platform breakdown
@dlt.table(name=f"{GOLD}.device_breakdown", comment="views by device and platform")
def gold_device_breakdown():
    return (
        dlt.read(f"{SILVER}.playback_events")
        .groupBy("device_type", F.col("provider").alias("platform"))
        .agg(
            F.sum("views").alias("views"),
            F.sum("watch_time_ms").alias("watch_time"),
        )
        .orderBy(F.desc("views"))
    )


# graph 9: ad delivery funnel
@dlt.table(name=f"{GOLD}.ad_delivery_funnel", comment="daily ad opportunities to completions")
def gold_ad_delivery_funnel():
    daily_opp = (
        dlt.read(f"{SILVER}.ad_opportunities")
        .groupBy(F.col("event_date").alias("day"))
        .agg(
            F.sum("opportunities").alias("opportunities"),
            F.sum("filled").alias("filled_slots"),
        )
    )
    daily_ads = (
        dlt.read(f"{SILVER}.ad_events")
        .groupBy(F.col("event_date").alias("day"))
        .agg(
            F.sum(F.when(F.col("event_type") == "impression", 1).otherwise(0)).alias("impressions"),
            F.sum(F.when(F.col("event_type") == "complete", 1).otherwise(0)).alias("completions"),
        )
    )
    return (
        daily_opp.join(daily_ads, "day", "full_outer")
        .select(
            F.coalesce(daily_opp["day"], daily_ads["day"]).alias("day"),
            F.coalesce("opportunities", F.lit(0)).alias("opportunities"),
            F.coalesce("impressions", F.lit(0)).alias("impressions"),
            F.coalesce("completions", F.lit(0)).alias("completions"),
            F.round(
                100.0 * F.coalesce(F.col("impressions"), F.lit(0)) /
                F.when(F.col("opportunities") > 0, F.col("opportunities")).otherwise(F.lit(None)),
                1
            ).alias("fill_rate"),
        )
        .orderBy("day")
    )


# graph 10: top videos
@dlt.table(name=f"{GOLD}.top_videos", comment="videos ranked by total consumption")
def gold_top_videos():
    video_metrics = (
        dlt.read(f"{SILVER}.playback_events")
        .groupBy("video_id")
        .agg(
            F.sum("views").alias("views"),
            F.sum(F.when(F.col("provider") != "youtube", F.col("views")).otherwise(0)).alias("listens"),
            F.sum("watch_time_ms").alias("watch_time"),
        )
        .withColumn("total_consumption", F.col("views") + F.col("listens") + F.col("views"))
    )
    return (
        video_metrics
        .withColumn("rank", F.rank().over(Window.orderBy(F.desc("total_consumption"))))
        .select("video_id", "views", "listens", "watch_time", "rank")
        .orderBy("rank")
    )
