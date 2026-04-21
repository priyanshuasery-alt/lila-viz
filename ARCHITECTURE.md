# Architecture — LILA BLACK Player Journey Visualizer

## What I Built and Why

**React + TypeScript + HTML Canvas + Vercel static hosting.**

The tool is a fully static single-page app. There is no backend or server at runtime — all heavy lifting happens once during preprocessing on my local machine, and the output (compact JSON files) is committed to the repo and served as static assets.

I chose this approach because:
- 89,000 rows / ~17 MB of data is tiny — no database or API needed
- A static deploy on Vercel is free, instant, and produces a shareable URL with zero ops overhead
- HTML Canvas renders thousands of events per frame without lag; React handles the UI state around it

---

## Data Flow

```
1,243 parquet files (player_data/)
        │
        ▼  preprocess.py (runs once, offline)
        │   • Decode event bytes → string
        │   • Convert world (x, z) → minimap pixel (px, py)
        │   • Normalize timestamps to ms-since-match-start
        │   • Pre-compute heatmap grids (32×32 buckets)
        │   • Sample position events (1 in 5) to reduce file size
        │
        ▼  public/data/
        │   ├── index.json          (~3 KB)   — all matches + dates
        │   ├── AmbroseValley.json  (~200 KB) — map events + heatmaps
        │   ├── GrandRift.json
        │   ├── Lockdown.json
        │   └── matches/{id}.json  (~5 KB each) — per-match timelines
        │
        ▼  React Frontend
        │   App.tsx fetches index.json on load
        │   → FilterPanel populates map/date/match selectors
        │   → Selecting a map fetches {MapId}.json
        │   → Selecting a match fetches matches/{id}.json
        │   → MapViewer renders filtered events onto Canvas
        │   → Timeline scrubs through ts_relative values
```

---

## Coordinate Mapping

The README specifies a UV-based conversion from world space to minimap pixel space. Each map has a `scale` and `origin_(x, z)` value.

```
u = (world_x - origin_x) / scale
v = (world_z - origin_z) / scale

pixel_x = u × 1024
pixel_y = (1 - v) × 1024   ← Y-axis is flipped (image origin = top-left)
```

This is pre-computed in `preprocess.py` for every event and stored in the JSON as `px` and `py`. The frontend simply maps these pixel values onto the canvas:

```
canvas_x = (px / 1024) × canvas_size
canvas_y = (py / 1024) × canvas_size
```

The `y` column in the data is 3D elevation — it is ignored for 2D minimap plotting.

---

## Assumptions Made

| Situation | Assumption | Reasoning |
|---|---|---|
| `ts` column shows dates in 1970 | Milliseconds since epoch stored as timestamp. Treated as match-relative elapsed time — normalized to 0 per match. | README says "time elapsed within the match, not wall-clock time" |
| No `Kill` or `Killed` events in sample data | Human vs human combat may be rare in test data or logged differently. Markers implemented and ready, just not triggered. | Schema documents them; kept in UI |
| February 14 partial data | Treated same as other days but labeled "partial" in filter UI | README flags it explicitly |
| Bots have no `Loot` or `KilledByStorm` events | By design — bots only generate `BotPosition`, `BotKill`, `BotKilled` | Confirmed by schema |

---

## Major Tradeoffs

| Option A | Option B (chosen) | Why |
|---|---|---|
| Streamlit (Python) | React + Canvas | React is faster to interact with; no Python server needed at runtime |
| Load parquet in browser (via DuckDB-wasm) | Preprocess to JSON offline | Simpler, faster, no client-side compute; parquet files are 2-3x larger than the JSON output |
| Server-side API | Static file hosting | Zero ops, free Vercel tier, works offline |
| WebGL heatmap | Canvas 2D grid overlay | Sufficient for 32×32 grid; no shader complexity needed |
| Load all maps at once | Lazy-load per map | Keeps initial load under 5KB; each map loads only when selected |
