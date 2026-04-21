"""
LILA BLACK - Player Journey Data Preprocessor
=============================================
Reads ALL parquet files from the player_data/ folder,
converts world coords → minimap pixel coords,
and writes compact JSON files ready for the frontend.

Usage:
    python preprocess.py --input ./public/player_data --output ./public/data

Output structure:
    public/data/
    ├── index.json              ← metadata: all matches, dates, maps
    ├── AmbroseValley.json      ← all events for this map (heatmaps)
    ├── GrandRift.json
    ├── Lockdown.json
    └── matches/
        └── {match_id}.json     ← per-match data for timeline playback
"""

import os
import json
import argparse
from pathlib import Path
from collections import defaultdict

import pyarrow.parquet as pq
import pandas as pd
import numpy as np

# ─── Map Configuration (from README) ────────────────────────────────────────
MAP_CONFIG = {
    "AmbroseValley": {"scale": 900,  "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581,  "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500},
}

# Event categories for the frontend
EVENT_CATEGORIES = {
    "Position":      "move_human",
    "BotPosition":   "move_bot",
    "Kill":          "combat",
    "Killed":        "combat",
    "BotKill":       "combat",
    "BotKilled":     "combat",
    "KilledByStorm": "storm",
    "Loot":          "loot",
}


def world_to_pixel(x, z, map_id):
    """Convert world (x, z) coordinates to minimap pixel coords (1024x1024)."""
    cfg = MAP_CONFIG[map_id]
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    px = round(u * 1024, 1)
    py = round((1 - v) * 1024, 1)
    return px, py


def is_bot(user_id: str) -> bool:
    """Bots have numeric IDs; humans have UUIDs."""
    return not "-" in str(user_id)


def load_file(filepath: str) -> pd.DataFrame | None:
    """Load a single parquet file and decode the event column."""
    try:
        df = pq.read_table(filepath).to_pandas()
        df["event"] = df["event"].apply(
            lambda x: x.decode("utf-8") if isinstance(x, bytes) else x
        )
        return df
    except Exception as e:
        print(f"  ⚠ Could not read {filepath}: {e}")
        return None


def process_all_files(input_dir: str) -> pd.DataFrame:
    """
    Walk the entire player_data folder and load every file.
    Adds derived columns: is_bot, pixel_x, pixel_y, date, category.
    """
    all_frames = []
    input_path = Path(input_dir)

    # Gather all files (handles nested date folders like February_10/)
    all_files = []
    for root, dirs, files in os.walk(input_path):
        for fname in files:
            if fname.endswith(".nakama-0") or "." not in fname:
                # Parquet files have no extension per README
                all_files.append(os.path.join(root, fname))

    total = len(all_files)
    print(f"Found {total} files to process...")

    for i, filepath in enumerate(all_files):
        if i % 100 == 0:
            print(f"  Processing {i}/{total}...")

        df = load_file(filepath)
        if df is None or df.empty:
            continue

        # Extract date from folder name (e.g. February_10)
        parent_folder = Path(filepath).parent.name
        df["date"] = parent_folder  # "February_10", "February_11", etc.

        all_frames.append(df)

    if not all_frames:
        raise ValueError("No valid files found!")

    print(f"  Loaded {len(all_frames)} files successfully.")
    full = pd.concat(all_frames, ignore_index=True)
    print(f"  Total rows: {len(full):,}")
    return full


def enrich(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived columns used by the frontend."""
    # Player type
    df["is_bot"] = df["user_id"].apply(is_bot)

    # Clean match_id (strip .nakama-0 suffix for display)
    df["match_id_clean"] = df["match_id"].str.replace(r"\.nakama-\d+$", "", regex=True)

    # Event category
    df["category"] = df["event"].map(EVENT_CATEGORIES).fillna("other")

    # Convert timestamps to ms-since-match-start (per match)
    df["ts_ms"] = df["ts"].astype("int64") // 1_000_000  # nanoseconds → ms

    # Normalize timestamps per match so all matches start at t=0
    min_ts = df.groupby("match_id")["ts_ms"].transform("min")
    df["ts_relative"] = df["ts_ms"] - min_ts

    # Pixel coordinates
    px_list, py_list = [], []
    for _, row in df.iterrows():
        if row["map_id"] in MAP_CONFIG:
            px, py = world_to_pixel(row["x"], row["z"], row["map_id"])
        else:
            px, py = -1, -1
        px_list.append(px)
        py_list.append(py)

    df["px"] = px_list
    df["py"] = py_list

    return df


def build_index(df: pd.DataFrame) -> dict:
    """Build index.json — metadata about all matches and dates."""
    matches = []
    for match_id, group in df.groupby("match_id"):
        human_players = group[~group["is_bot"]]["user_id"].nunique()
        bot_players   = group[group["is_bot"]]["user_id"].nunique()
        matches.append({
            "match_id":      match_id,
            "match_id_clean": group["match_id_clean"].iloc[0],
            "map_id":        group["map_id"].iloc[0],
            "date":          group["date"].iloc[0],
            "human_players": int(human_players),
            "bot_players":   int(bot_players),
            "total_events":  int(len(group)),
            "duration_ms":   int(group["ts_relative"].max()),
        })

    return {
        "dates":   sorted(df["date"].unique().tolist()),
        "maps":    sorted(df["map_id"].unique().tolist()),
        "matches": sorted(matches, key=lambda m: (m["date"], m["map_id"])),
        "total_rows": int(len(df)),
    }


def build_map_json(df: pd.DataFrame, map_id: str) -> dict:
    """
    Build per-map JSON for heatmaps.
    Only includes non-position events + SAMPLED positions (every 5th).
    Keeps file size small.
    """
    map_df = df[df["map_id"] == map_id].copy()

    # For heatmaps: keep all combat/loot/storm events; sample movement
    events_df  = map_df[map_df["category"] != "move_human"]
    move_human = map_df[map_df["category"] == "move_human"].iloc[::5]  # 1 in 5
    move_bot   = map_df[map_df["category"] == "move_bot"].iloc[::5]

    combined = pd.concat([events_df, move_human, move_bot])

    # Round coordinates to 1 decimal to reduce JSON size
    combined = combined.copy()
    combined["px"] = combined["px"].round(1)
    combined["py"] = combined["py"].round(1)

    rows = combined[[
        "user_id", "match_id_clean", "event", "category",
        "px", "py", "ts_relative", "is_bot", "date"
    ]].to_dict(orient="records")

    # Heatmap buckets (pre-computed for frontend)
    heatmaps = build_heatmaps(map_df)

    return {
        "map_id": map_id,
        "total_events": int(len(map_df)),
        "events": rows,
        "heatmaps": heatmaps,
    }


def build_heatmaps(df: pd.DataFrame, grid_size: int = 32) -> dict:
    """
    Pre-compute heatmap grids at grid_size resolution.
    Returns kill_zone, death_zone, traffic grids as flat arrays.
    """
    def to_grid(sub_df):
        if sub_df.empty:
            return []
        # Bucket pixel coords into grid cells
        sub_df = sub_df.copy()
        sub_df["gx"] = (sub_df["px"] / 1024 * grid_size).clip(0, grid_size - 1).astype(int)
        sub_df["gy"] = (sub_df["py"] / 1024 * grid_size).clip(0, grid_size - 1).astype(int)
        counts = sub_df.groupby(["gx", "gy"]).size().reset_index(name="count")
        return counts.to_dict(orient="records")

    kill_events  = df[df["event"].isin(["Kill", "BotKill"])]
    death_events = df[df["event"].isin(["Killed", "BotKilled", "KilledByStorm"])]
    traffic      = df[df["category"].isin(["move_human", "move_bot"])]

    return {
        "grid_size": grid_size,
        "kills":     to_grid(kill_events),
        "deaths":    to_grid(death_events),
        "traffic":   to_grid(traffic),
        "loot":      to_grid(df[df["event"] == "Loot"]),
    }


def build_match_json(df: pd.DataFrame, match_id: str) -> dict:
    """
    Build per-match JSON for timeline playback.
    Contains full event list sorted by ts_relative.
    """
    match_df = df[df["match_id"] == match_id].sort_values("ts_relative")

    rows = match_df[[
        "user_id", "event", "category",
        "px", "py", "ts_relative", "is_bot"
    ]].round({"px": 1, "py": 1}).to_dict(orient="records")

    # Player list for legend
    players = []
    for uid, grp in match_df.groupby("user_id"):
        players.append({
            "user_id": uid,
            "is_bot":  bool(grp["is_bot"].iloc[0]),
            "events":  int(len(grp)),
        })

    return {
        "match_id":   match_id,
        "map_id":     match_df["map_id"].iloc[0],
        "duration_ms": int(match_df["ts_relative"].max()),
        "players":    players,
        "events":     rows,
    }


def main():
    parser = argparse.ArgumentParser(description="LILA BLACK Data Preprocessor")
    parser.add_argument("--input",  default="./public/player_data", help="Path to player_data folder")
    parser.add_argument("--output", default="./public/data",  help="Output folder for JSON files")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)
    os.makedirs(os.path.join(args.output, "matches"), exist_ok=True)

    # ── Step 1: Load all files ─────────────────────────────────────────────
    print("\n📂 Step 1: Loading all parquet files...")
    df = process_all_files(args.input)

    # ── Step 2: Enrich with derived columns ────────────────────────────────
    print("\n🔧 Step 2: Enriching data (coordinates, timestamps, categories)...")
    df = enrich(df)

    # ── Step 3: Write index.json ───────────────────────────────────────────
    print("\n📝 Step 3: Writing index.json...")
    index = build_index(df)
    with open(os.path.join(args.output, "index.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"))
    print(f"  → {len(index['matches'])} matches, {len(index['dates'])} dates")

    # ── Step 4: Write per-map JSON (for heatmaps) ─────────────────────────
    print("\n🗺️  Step 4: Writing per-map JSON files...")
    for map_id in MAP_CONFIG.keys():
        map_data = build_map_json(df, map_id)
        out_path = os.path.join(args.output, f"{map_id}.json")
        with open(out_path, "w") as f:
            json.dump(map_data, f, separators=(",", ":"))
        size_kb = os.path.getsize(out_path) / 1024
        print(f"  → {map_id}.json ({size_kb:.0f} KB, {map_data['total_events']:,} events)")

    # ── Step 5: Write per-match JSON (for timeline playback) ──────────────
    print("\n🎮 Step 5: Writing per-match JSON files...")
    match_ids = df["match_id"].unique()
    for i, match_id in enumerate(match_ids):
        match_data = build_match_json(df, match_id)
        clean_id = match_id.replace(".nakama-0", "")
        out_path = os.path.join(args.output, "matches", f"{clean_id}.json")
        with open(out_path, "w") as f:
            json.dump(match_data, f, separators=(",", ":"))
    print(f"  → {len(match_ids)} match files written")

    # ── Done ───────────────────────────────────────────────────────────────
    total_size = sum(
        os.path.getsize(os.path.join(dirpath, f))
        for dirpath, _, files in os.walk(args.output)
        for f in files
    )
    print(f"\n✅ Done! Total output size: {total_size / 1024:.0f} KB")
    print(f"   Output at: {args.output}")


if __name__ == "__main__":
    main()
