#!/usr/bin/env python3
"""
generate synthetic events and upload to s3 as parquet.

usage:
    python stream_to_s3.py --mode backfill
    python stream_to_s3.py --mode stream --delay 5
    python stream_to_s3.py --mode local --output-dir ./output
"""

import argparse
import time
from datetime import datetime, timedelta, date
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import boto3

from config import (
    START_DATE, END_DATE, VIDEO_IDS, EPISODE_LOOKUP,
    NUM_USERS, PROVIDERS, PROVIDER_WEIGHTS,
    COUNTRIES, COUNTRY_WEIGHTS, DEVICE_TYPES, DEVICE_WEIGHTS,
    SOURCES, SOURCE_WEIGHTS, CAMPAIGNS, ADS_PER_CAMPAIGN,
    AD_EVENT_TYPES, AD_FUNNEL_RATES,
    TARGET_PLAYBACK_EVENTS, TARGET_AD_EVENTS, TARGET_AD_OPPORTUNITIES,
    ZIPF_ALPHA,
)


def make_user_ids(n, rng):
    raw = rng.integers(0, 2**32, size=n, dtype=np.uint32)
    return [f"u_{x:08x}" for x in raw]


def zipf_weights(n, alpha):
    ranks = np.arange(1, n + 1, dtype=np.float64)
    w = 1.0 / np.power(ranks, alpha)
    return w / w.sum()


def recency_boost(ep_pub_date, current_date):
    days_since = (current_date - ep_pub_date).days
    if days_since < 0:
        return 0.0
    if days_since <= 7:
        return 3.0
    return max(0.3, np.exp(-0.02 * days_since))


def get_daily_episode_weights(current_date, base_weights):
    boosts = np.array([recency_boost(EPISODE_LOOKUP[vid][2], current_date) for vid in VIDEO_IDS])
    w = base_weights * boosts
    total = w.sum()
    if total == 0:
        return w
    return w / total


def hour_distribution():
    w = np.ones(24) * 0.5
    for h in range(6, 11):
        w[h] = 2.0
    for h in range(17, 22):
        w[h] = 2.5
    return w / w.sum()


def playback_schema():
    return pa.schema([
        ("timestamp", pa.timestamp("us")), ("show_id", pa.string()),
        ("video_id", pa.string()), ("user_id_hash", pa.string()),
        ("provider", pa.string()), ("views", pa.int32()),
        ("watch_time_ms", pa.int64()), ("likes", pa.int32()),
        ("comments", pa.int32()), ("shares", pa.int32()),
        ("country", pa.string()), ("device_type", pa.string()),
        ("source", pa.string()),
    ])


def ad_event_schema():
    return pa.schema([
        ("timestamp", pa.timestamp("us")), ("campaign_id", pa.string()),
        ("ad_id", pa.string()), ("show_id", pa.string()),
        ("video_id", pa.string()), ("event_type", pa.string()),
        ("country", pa.string()),
    ])


def ad_opp_schema():
    return pa.schema([
        ("timestamp", pa.timestamp("us")), ("show_id", pa.string()),
        ("video_id", pa.string()), ("country", pa.string()),
        ("opportunities", pa.int32()), ("filled", pa.int32()),
        ("unfilled", pa.int32()),
    ])


def write_parquet(base_dir, date_str, rows, schema):
    part_dir = base_dir / f"event_date={date_str}"
    part_dir.mkdir(parents=True, exist_ok=True)
    table = pa.table(rows, schema=schema)
    pq.write_table(table, part_dir / "part-0000.parquet", compression="snappy")


def upload_day_to_s3(local_base, date_str, s3_client, bucket, prefix, event_type):
    part_dir = local_base / event_type / f"event_date={date_str}"
    if not part_dir.exists():
        return
    for f in part_dir.glob("*.parquet"):
        key = f"{prefix}/{event_type}/event_date={date_str}/{f.name}"
        s3_client.upload_file(str(f), bucket, key)


def normalize_weights(values):
    w = np.array(values, dtype=np.float64)
    w /= w.sum()
    return w


def generate_day(current_date, rng, user_ids_arr, user_tiers, base_ep_weights,
                 total_days, day_offset, scale, user_first_seen):
    tier_daily_prob = {"casual": 0.005, "regular": 0.02, "power": 0.06}
    weekday_mult = 1.3 if current_date.weekday() < 5 else 0.85

    daily_probs = np.array([tier_daily_prob[t] for t in user_tiers]) * weekday_mult
    active_mask = rng.random(len(user_ids_arr)) < daily_probs
    active_indices = np.where(active_mask)[0]
    n_active = len(active_indices)

    if n_active == 0:
        return None, None, None

    progress_ratio = (day_offset + 1) / total_days
    growth_mult = 0.7 + 0.6 * progress_ratio

    ep_weights = get_daily_episode_weights(current_date, base_ep_weights)
    if ep_weights.sum() == 0:
        return None, None, None

    events_per_user = rng.choice([1, 1, 1, 2, 2, 3], size=n_active)
    total_events_today = int(events_per_user.sum() * growth_mult * scale)

    ad_events_ratio = TARGET_AD_EVENTS / TARGET_PLAYBACK_EVENTS
    ad_opp_ratio = TARGET_AD_OPPORTUNITIES / TARGET_PLAYBACK_EVENTS

    countries_arr = np.array(COUNTRIES)
    country_w = normalize_weights(COUNTRY_WEIGHTS)
    devices_arr = np.array(DEVICE_TYPES)
    device_w = normalize_weights(DEVICE_WEIGHTS)
    sources_arr = np.array(SOURCES)
    source_w = normalize_weights(SOURCE_WEIGHTS)
    providers_arr = np.array(PROVIDERS)
    provider_w = normalize_weights(PROVIDER_WEIGHTS)
    hour_dist = hour_distribution()

    video_ids_arr = np.array(VIDEO_IDS)
    show_ids_arr = np.array([EPISODE_LOOKUP[v][1] for v in VIDEO_IDS])
    dur_ms_arr = np.array([EPISODE_LOOKUP[v][3] for v in VIDEO_IDS], dtype=np.int64)

    base_ts = np.datetime64(f"{current_date.isoformat()}T00:00:00", "us")

    # playback events
    n = total_events_today
    chosen_eps = rng.choice(len(VIDEO_IDS), size=n, p=ep_weights)
    chosen_users = rng.choice(active_indices, size=n, replace=True)
    hours = rng.choice(24, size=n, p=hour_dist).astype(np.int64)
    minutes = rng.integers(0, 60, size=n, dtype=np.int64)
    seconds = rng.integers(0, 60, size=n, dtype=np.int64)
    offsets_us = (hours * 3600 + minutes * 60 + seconds) * 1_000_000
    timestamps = base_ts + offsets_us.astype("timedelta64[us]")

    ep_dur = dur_ms_arr[chosen_eps]
    wt_raw = rng.normal(ep_dur * 0.6, ep_dur * 0.25).astype(np.int64)
    wt = np.clip(wt_raw, 10_000, ep_dur)

    pb_rows = {
        "timestamp":     timestamps,
        "show_id":       show_ids_arr[chosen_eps],
        "video_id":      video_ids_arr[chosen_eps],
        "user_id_hash":  user_ids_arr[chosen_users],
        "provider":      rng.choice(providers_arr, size=n, p=provider_w),
        "views":         np.ones(n, dtype=np.int32),
        "watch_time_ms": wt,
        "likes":         (rng.random(n) < 0.08).astype(np.int32),
        "comments":      (rng.random(n) < 0.02).astype(np.int32),
        "shares":        (rng.random(n) < 0.01).astype(np.int32),
        "country":       rng.choice(countries_arr, size=n, p=country_w),
        "device_type":   rng.choice(devices_arr, size=n, p=device_w),
        "source":        rng.choice(sources_arr, size=n, p=source_w),
    }

    # ad events
    n_ad_base = int(n * ad_events_ratio)
    ad_rows = None
    if n_ad_base > 0:
        campaigns_arr = np.array(CAMPAIGNS)
        camp_indices = rng.integers(0, len(CAMPAIGNS), size=n_ad_base)
        camp_ids = campaigns_arr[camp_indices]
        camp_nums = np.array([c.split("_")[1] for c in camp_ids])
        ad_nums = rng.integers(1, ADS_PER_CAMPAIGN + 1, size=n_ad_base)
        ad_ids = np.array([f"ad_{cn}_{an}" for cn, an in zip(camp_nums, ad_nums)])

        ad_ep_idx = rng.choice(len(VIDEO_IDS), size=n_ad_base, p=ep_weights)
        ad_hours = rng.choice(24, size=n_ad_base, p=hour_dist).astype(np.int64)
        ad_minutes = rng.integers(0, 60, size=n_ad_base, dtype=np.int64)
        ad_seconds = rng.integers(0, 60, size=n_ad_base, dtype=np.int64)
        ad_offsets = (ad_hours * 3600 + ad_minutes * 60 + ad_seconds) * 1_000_000
        ad_base_ts = base_ts + ad_offsets.astype("timedelta64[us]")
        ad_countries = rng.choice(countries_arr, size=n_ad_base, p=country_w)

        # vectorized funnel depth
        funnel_rates = np.array(AD_FUNNEL_RATES)
        stage_draws = rng.random((n_ad_base, len(funnel_rates)))
        stage_pass = stage_draws < funnel_rates[np.newaxis, :]
        cum_pass = np.cumprod(stage_pass, axis=1)
        max_stages = cum_pass.sum(axis=1).astype(np.int32)

        # expand one row per funnel stage
        event_types_arr = np.array(AD_EVENT_TYPES)
        repeat_idx = np.repeat(np.arange(n_ad_base), max_stages)
        stage_nums = np.concatenate([np.arange(s) for s in max_stages])
        stage_offsets_us = stage_nums.astype(np.int64) * 1_000_000

        ad_rows = {
            "timestamp":   ad_base_ts[repeat_idx] + stage_offsets_us.astype("timedelta64[us]"),
            "campaign_id": camp_ids[repeat_idx],
            "ad_id":       ad_ids[repeat_idx],
            "show_id":     show_ids_arr[ad_ep_idx[repeat_idx]],
            "video_id":    video_ids_arr[ad_ep_idx[repeat_idx]],
            "event_type":  event_types_arr[stage_nums],
            "country":     ad_countries[repeat_idx],
        }

    # ad opportunities
    n_opp = int(n * ad_opp_ratio)
    opp_rows = None
    if n_opp > 0:
        opp_ep_idx = rng.choice(len(VIDEO_IDS), size=n_opp, p=ep_weights)
        opp_hours = rng.choice(24, size=n_opp, p=hour_dist).astype(np.int64)
        opp_minutes = rng.integers(0, 60, size=n_opp, dtype=np.int64)
        opp_seconds = rng.integers(0, 60, size=n_opp, dtype=np.int64)
        opp_offsets = (opp_hours * 3600 + opp_minutes * 60 + opp_seconds) * 1_000_000
        opps = rng.integers(1, 6, size=n_opp, dtype=np.int32)
        filled = rng.binomial(opps.astype(np.int64), 0.72).astype(np.int32)

        opp_rows = {
            "timestamp":     base_ts + opp_offsets.astype("timedelta64[us]"),
            "show_id":       show_ids_arr[opp_ep_idx],
            "video_id":      video_ids_arr[opp_ep_idx],
            "country":       rng.choice(countries_arr, size=n_opp, p=country_w),
            "opportunities": opps,
            "filled":        filled,
            "unfilled":      opps - filled,
        }

    return pb_rows, ad_rows, opp_rows


def run(mode, bucket, prefix, delay, output_dir, scale):
    rng = np.random.default_rng(seed=42)
    user_ids = make_user_ids(NUM_USERS, rng)
    user_ids_arr = np.array(user_ids)
    base_ep_weights = zipf_weights(len(VIDEO_IDS), ZIPF_ALPHA)
    user_tiers = rng.choice(["casual", "regular", "power"], size=NUM_USERS, p=[0.60, 0.25, 0.15])
    user_first_seen = {}

    total_days = (END_DATE - START_DATE).days
    local_path = Path(output_dir)

    s3_client = None
    if mode in ("backfill", "stream"):
        s3_client = boto3.client("s3")

    total_pb = total_ad = total_opp = 0

    print(f"Mode: {mode} | Scale: {scale} | Days: {total_days}")
    if mode == "stream":
        print(f"Delay between days: {delay}s")

    for day_offset in range(total_days):
        current_date = START_DATE + timedelta(days=day_offset)
        date_str = current_date.isoformat()

        pb_rows, ad_rows, opp_rows = generate_day(
            current_date, rng, user_ids_arr, user_tiers,
            base_ep_weights, total_days, day_offset, scale, user_first_seen
        )

        if pb_rows is not None and len(pb_rows["timestamp"]) > 0:
            write_parquet(local_path / "playback_events", date_str, pb_rows, playback_schema())
            total_pb += len(pb_rows["timestamp"])

        if ad_rows is not None and len(ad_rows["timestamp"]) > 0:
            write_parquet(local_path / "ad_events", date_str, ad_rows, ad_event_schema())
            total_ad += len(ad_rows["timestamp"])

        if opp_rows is not None and len(opp_rows["timestamp"]) > 0:
            write_parquet(local_path / "ad_opportunities", date_str, opp_rows, ad_opp_schema())
            total_opp += len(opp_rows["timestamp"])

        if s3_client:
            for event_type in ("playback_events", "ad_events", "ad_opportunities"):
                upload_day_to_s3(local_path, date_str, s3_client, bucket, prefix, event_type)

        if (day_offset + 1) % 30 == 0 or day_offset == total_days - 1:
            print(f"  Day {day_offset + 1}/{total_days} ({date_str}): "
                  f"pb={total_pb:,} ad={total_ad:,} opp={total_opp:,}")

        if mode == "stream" and day_offset < total_days - 1:
            time.sleep(delay)

    print(f"\nDone! Totals: playback={total_pb:,}, ad_events={total_ad:,}, ad_opp={total_opp:,}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["backfill", "stream", "local"], default="local")
    parser.add_argument("--bucket", default="flightcast-data")
    parser.add_argument("--prefix", default="raw")
    parser.add_argument("--delay", type=float, default=5.0)
    parser.add_argument("--output-dir", default="./output")
    parser.add_argument("--scale", type=float, default=1.0)
    args = parser.parse_args()
    run(args.mode, args.bucket, args.prefix, args.delay, args.output_dir, args.scale)
