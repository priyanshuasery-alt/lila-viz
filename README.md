# LILA BLACK — Player Journey Visualizer

A browser-based telemetry visualization tool that lets Level Designers explore how players navigate LILA BLACK maps. Built for the Lila Games APM assignment.

**Live Demo:** `https://lila-viz.vercel.app` ← replace with your URL after deploy

---

## What It Does

- Overlays player movement paths on top of minimap images
- Distinguishes human players (solid dots) from bots (hollow dots) visually
- Marks all 8 event types with distinct colors and sizes
- Heatmaps for kill zones, death zones, loot density, and traffic
- Filter by map, date range, and individual match
- Timeline playback — watch any match unfold second by second

---

## Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Data preprocessing | Python + PyArrow + Pandas | Fast parquet parsing, runs once offline |
| Frontend | React + TypeScript | Component model fits filter/canvas architecture |
| Rendering | HTML Canvas API | GPU-accelerated, handles 89k events without lag |
| Hosting | Vercel | Free static hosting, zero config, instant deploy |

---

## Repo Structure

```
lila-viz/
├── preprocess.py          ← Run once to generate JSON from parquet
├── public/
│   ├── data/              ← Output from preprocess.py (committed)
│   │   ├── index.json
│   │   ├── AmbroseValley.json
│   │   ├── GrandRift.json
│   │   ├── Lockdown.json
│   │   └── matches/
│   └── minimaps/          ← Minimap images
│       ├── AmbroseValley_Minimap.png
│       ├── GrandRift_Minimap.png
│       └── Lockdown_Minimap.jpg
├── src/
│   ├── components/
│   │   ├── MapViewer.tsx   ← Canvas rendering
│   │   ├── FilterPanel.tsx ← Sidebar controls
│   │   └── Timeline.tsx    ← Playback slider
│   ├── types.ts
│   └── App.tsx
├── ARCHITECTURE.md
└── INSIGHTS.md
```

---

## Setup & Running Locally

**Prerequisites:** Node.js 18+, Python 3.9+

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/lila-viz
cd lila-viz

# 2. Install frontend dependencies
npm install

# 3. (Optional) Re-run preprocessing if you have the full dataset
pip install pyarrow pandas numpy
python preprocess.py --input ./player_data --output ./public/data

# 4. Start dev server
npm start
# Opens at http://localhost:3000
```

**Note:** The `public/data/` folder is already committed with preprocessed data, so step 3 is only needed if you want to regenerate from the raw parquet files.

---

## Deploying to Vercel

```bash
npm install -g vercel
npm run build
vercel --prod
```

No environment variables required — it's a fully static build.

---

## How to Use the Tool

1. **Select a map** from the left sidebar (AmbroseValley is default)
2. **Filter by date** using the checkboxes — February 10-14
3. **Select a match** from the dropdown to focus on one session
4. **Toggle event types** — show/hide paths, kills, deaths, loot, storm
5. **Enable heatmap** — choose kills / deaths / traffic / loot overlay
6. **Press Play** on the timeline to watch the match unfold in real time

---

## Assumptions

- `ts` column treated as milliseconds elapsed within the match (not wall-clock time)
- `y` column (elevation) ignored for 2D plotting — only `x` and `z` used
- Human vs bot detection based on filename: UUID = human, numeric = bot
- February 14 is a partial day — flagged in the UI
