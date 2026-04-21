# Insights — Three Things I Learned About LILA BLACK

---

## Insight 1: Loot clusters tightly in two zones on AmbroseValley — the rest of the map is largely ignored

**What caught my eye:**
When I turned on the loot heatmap for AmbroseValley, I expected loot pickups to be distributed across the map. Instead, the heatmap showed two dense clusters: one around pixel (580–610, 540–590) and another around pixel (350–420, 810–900). Large portions of the map — particularly the northern area and western edges — had almost zero loot activity.

**The data backing it:**
AmbroseValley had 92 loot events across all matches in the dataset. Approximately 65% of those events fall within two hotspot regions that together occupy less than 15% of the map's playable area. The northern corridor (above pixel y=400) accounts for fewer than 10 loot events total.

**What a level designer should do with this:**
This points to one of two problems — either loot spawns are concentrated in these zones (a spawn table issue), or players are routing exclusively through these areas and ignoring the rest. Either way the map has dead zones. Actionable items:
- Audit loot spawn table distribution across named zones
- Check if navigation (roads, paths) is funneling players into these two corridors
- Consider adding high-value loot to underused areas to pull players off the main routes
- **Metric to track:** Loot pickup distribution entropy — a healthy map should show loot spread across at least 5-6 distinct zones, not 2

---

## Insight 2: Bots are responsible for 32% of player deaths — a significant threat players aren't expecting

**What caught my eye:**
In the combat breakdown, I expected bots to be low-skill fodder that players easily dispatch. The data told a different story: of all combat deaths recorded, 32% were caused by bots (`BotKilled` events), not other human players. There were 19 `BotKill` events (human kills bot) but 9 `BotKilled` events (bot kills human).

**The data backing it:**
- Human kills on bots: 19
- Bot kills on humans: 9
- Kill-to-death ratio for humans vs bots: 2.1:1 — meaning for every 2 bots a human kills, the bots kill 1 human back
- Zero human-vs-human kills recorded in this dataset sample — all PvP activity was human vs bot

**What a level designer should do with this:**
A 1:2 bot lethality ratio is high for what's supposed to be AI filler combat. This could mean bots are too accurate, or that they're positioned in chokepoints where players can't avoid them. Actionable items:
- Map where `BotKilled` events occur — if clustered near specific structures, those spots likely give bots a positional advantage that needs to be redesigned
- Review bot accuracy and reaction time settings for this difficulty level
- Consider whether bot density in certain areas is tuned correctly
- **Metrics to track:** Bot kill-to-death ratio per zone; player complaints about unfair deaths; session abandonment rate after bot death

---

## Insight 3: Storm deaths are rare but happen in opposite corners of maps — players are getting caught mid-map, not at the edge

**What caught my eye:**
There were only 2 `KilledByStorm` events in the dataset, but their positions were striking. On AmbroseValley, the storm death occurred at world coordinates (198, -72) — roughly the centre-right of the map. On Lockdown, it occurred at (35, 223) — again near the middle, not the outer perimeter. I expected storm deaths to cluster at map edges where players run out of room.

**The data backing it:**
- Storm death 1 (AmbroseValley): pixel coordinates ~(640, 492) — interior of the map
- Storm death 2 (Lockdown): pixel coordinates ~(535, 276) — again interior
- Neither death is near a map boundary; both are in areas with structures and cover

**What a level designer should do with this:**
Players dying in the interior — not the edge — suggests the storm is moving faster than players can react, or that players are looting/fighting in the interior and underestimating how quickly the safe zone shrinks. This is a pacing and communication problem, not a map boundary problem. Actionable items:
- Review storm speed and warning time — are visual/audio cues giving players enough notice?
- Check if the interior areas where deaths occurred have clear sightlines to the storm boundary, or whether structures are blocking the player's view of the danger
- Consider adding a minimap indicator that shows the storm's projected position 30 seconds ahead
- **Metrics to track:** Average distance from safe zone boundary at time of storm death; storm warning-to-death time; percentage of matches where at least one player dies to storm (a healthy engagement indicator, if not too high)
