"""
Configuration constants for synthetic Flightcast event generation.
"""
from datetime import date

# --- Time range ---
START_DATE = date(2025, 10, 1)
END_DATE = date(2026, 3, 31)  # exclusive upper bound

# --- Shows ---
SHOWS = ["show_1", "show_2", "show_3"]

# --- Episodes (50 total, spread across shows) ---
# Each tuple: (video_id, show_id, publish_date, duration_ms)
EPISODES = []
_ep_idx = 1
_show_ep_counts = {"show_1": 20, "show_2": 15, "show_3": 15}
_pub_start = date(2025, 10, 1)
for show_id, count in _show_ep_counts.items():
    for i in range(count):
        pub = date.fromordinal(
            _pub_start.toordinal() + (_ep_idx - 1) * 3  # ~every 3 days
        )
        if pub > date(2026, 3, 25):
            pub = date(2026, 3, 25)
        dur_ms = 900_000 + ((_ep_idx * 7) % 20) * 60_000  # 15-35 min
        EPISODES.append((f"vid_{_ep_idx:03d}", show_id, pub, dur_ms))
        _ep_idx += 1

VIDEO_IDS = [ep[0] for ep in EPISODES]
EPISODE_LOOKUP = {ep[0]: ep for ep in EPISODES}

# --- Users ---
NUM_USERS = 200_000

# --- Providers ---
PROVIDERS = ["youtube", "spotify", "apple", "rss"]
PROVIDER_WEIGHTS = [0.45, 0.30, 0.15, 0.10]

# --- Countries ---
COUNTRIES = [
    "US", "UK", "CA", "AU", "DE", "FR", "IN", "BR", "JP", "MX",
    "KR", "NL", "ES", "IT", "SE", "NO", "PL", "AR", "ZA", "NG",
]
COUNTRY_WEIGHTS = [
    0.35, 0.15, 0.10, 0.08, 0.05, 0.04, 0.04, 0.03, 0.03, 0.02,
    0.02, 0.015, 0.015, 0.01, 0.01, 0.005, 0.005, 0.005, 0.005, 0.01,
]

# --- Device types ---
DEVICE_TYPES = ["mobile", "desktop", "tablet", "smart_tv", "smart_speaker"]
DEVICE_WEIGHTS = [0.50, 0.25, 0.10, 0.10, 0.05]

# --- Sources ---
SOURCES = ["search", "browse", "direct", "notification", "external", "playlist"]
SOURCE_WEIGHTS = [0.30, 0.25, 0.20, 0.10, 0.10, 0.05]

# --- Campaigns & Ads ---
CAMPAIGNS = [f"camp_{i}" for i in range(1, 11)]
ADS_PER_CAMPAIGN = 4  # each campaign has ad_1..ad_4 style
AD_EVENT_TYPES = ["impression", "start", "first_quartile", "midpoint",
                  "third_quartile", "complete", "click"]
# Funnel drop rates (probability of progressing to next stage)
AD_FUNNEL_RATES = [1.0, 0.85, 0.80, 0.75, 0.70, 0.65, 0.03]

# --- Scale targets ---
TARGET_PLAYBACK_EVENTS = 20_000_000
TARGET_AD_EVENTS = 8_000_000
TARGET_AD_OPPORTUNITIES = 2_000_000

# --- Episode popularity (Zipf weights, will be normalized) ---
ZIPF_ALPHA = 1.2
