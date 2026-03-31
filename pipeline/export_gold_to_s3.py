"""
export gold tables as json to s3 for frontend.
run as databricks notebook.
"""

# COMMAND ----------

import json
from datetime import datetime, date
import boto3

BUCKET = "flightcast-data"
PREFIX = "rollups/v1"

GOLD_TABLES = [
    ("gold.flightcast.episode_overlap", "episode_overlap"),
    ("gold.flightcast.listener_retention_funnel", "listener_retention_funnel"),
    ("gold.flightcast.new_vs_returning", "new_vs_returning"),
    ("gold.flightcast.relative_performance", "relative_performance"),
    ("gold.flightcast.daily_performance", "daily_performance"),
    ("gold.flightcast.audience_source", "audience_source"),
    ("gold.flightcast.geo_breakdown", "geo_breakdown"),
    ("gold.flightcast.device_breakdown", "device_breakdown"),
    ("gold.flightcast.ad_delivery_funnel", "ad_delivery_funnel"),
    ("gold.flightcast.top_videos", "top_videos"),
]

# COMMAND ----------

def json_serializer(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


# creds from databricks secrets scope
s3 = boto3.client(
    "s3",
    aws_access_key_id=dbutils.secrets.get("flightcast", "s3-access-key"),
    aws_secret_access_key=dbutils.secrets.get("flightcast", "s3-secret-key"),
    region_name="us-east-1",
)

# COMMAND ----------

print("Exporting gold tables to S3...\n")

for full_table, json_name in GOLD_TABLES:
    try:
        df = spark.table(full_table)
        rows = [row.asDict() for row in df.collect()]

        payload = {
            "graph": json_name,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "row_count": len(rows),
            "data": rows,
        }

        key = f"{PREFIX}/{json_name}.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=json.dumps(payload, default=json_serializer),
            ContentType="application/json",
        )
        print(f"  {json_name}: {len(rows)} rows -> s3://{BUCKET}/{key}")
    except Exception as e:
        print(f"  FAILED {json_name}: {e}")

print("\nDone!")
