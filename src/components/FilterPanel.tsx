import React, { useEffect, useMemo, useState } from "react";
import type { IndexData, MatchMeta } from "../types";

export type MapId = "AmbroseValley" | "GrandRift" | "Lockdown";
export type EventType =
  | "Position"
  | "BotPosition"
  | "Kill"
  | "Killed"
  | "BotKill"
  | "BotKilled"
  | "KilledByStorm"
  | "Loot";

export type HeatmapType = "kills" | "deaths" | "traffic" | "loot";

export type FilterPanelProps = {
  mapId: MapId;
  selectedDates: string[];
  matchId: string | null;
  selectedEventTypes: EventType[];
  showHeatmap: boolean;
  heatmapType: HeatmapType;

  onMapIdChange: (mapId: MapId) => void;
  onSelectedDatesChange: (dates: string[]) => void;
  onMatchIdChange: (matchId: string | null) => void;
  onSelectedEventTypesChange: (types: EventType[]) => void;
  onShowHeatmapChange: (show: boolean) => void;
  onHeatmapTypeChange: (type: HeatmapType) => void;

  indexData?: IndexData;
};

const MAPS: MapId[] = ["AmbroseValley", "GrandRift", "Lockdown"];
const EVENT_TYPES: EventType[] = [
  "Position",
  "BotPosition",
  "Kill",
  "Killed",
  "BotKill",
  "BotKilled",
  "KilledByStorm",
  "Loot",
];
const HEATMAP_TYPES: HeatmapType[] = ["kills", "deaths", "traffic", "loot"];

function LegendDot({
  color,
  hollow,
}: {
  color: string;
  hollow?: boolean;
}) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 999,
        display: "inline-block",
        boxSizing: "border-box",
        background: hollow ? "transparent" : color,
        border: hollow ? `2px solid ${color}` : "1px solid rgba(0,0,0,0.2)",
      }}
    />
  );
}

function toggleInList<T extends string>(list: readonly T[], value: T, nextOn: boolean): T[] {
  const set = new Set(list);
  if (nextOn) set.add(value);
  else set.delete(value);
  return Array.from(set);
}

function sortMatches(a: MatchMeta, b: MatchMeta) {
  return a.match_id_clean.localeCompare(b.match_id_clean);
}

export function FilterPanel(props: FilterPanelProps) {
  const {
    mapId,
    selectedDates,
    matchId,
    selectedEventTypes,
    showHeatmap,
    heatmapType,
    onMapIdChange,
    onSelectedDatesChange,
    onMatchIdChange,
    onSelectedEventTypesChange,
    onShowHeatmapChange,
    onHeatmapTypeChange,
    indexData,
  } = props;

  const [fetchedIndex, setFetchedIndex] = useState<IndexData | null>(null);

  useEffect(() => {
    if (indexData) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/index.json");
        if (!res.ok) throw new Error(`Failed to load index.json: ${res.status}`);
        const data = (await res.json()) as IndexData;
        if (!cancelled) setFetchedIndex(data);
      } catch {
        if (!cancelled) setFetchedIndex({ dates: [], maps: [], matches: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [indexData]);

  const index = indexData ?? fetchedIndex ?? { dates: [], maps: [], matches: [] };

  const matchOptions = useMemo(() => {
    const datesSet = new Set(selectedDates);
    return index.matches
      .filter((m) => m.map_id === mapId && (datesSet.size === 0 || datesSet.has(m.date)))
      .slice()
      .sort(sortMatches);
  }, [index.matches, mapId, selectedDates]);

  return (
    <div style={{ display: "grid", gap: 12, padding: 12, border: "1px solid #e5e7eb" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: "white",
          paddingBottom: 10,
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Map</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {MAPS.map((m) => (
            <label key={m} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input
                type="radio"
                name="map"
                value={m}
                checked={mapId === m}
                onChange={() => onMapIdChange(m)}
              />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Dates</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
          {index.dates.map((d) => {
            const checked = selectedDates.includes(d);
            return (
              <label key={d} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = toggleInList(selectedDates, d, e.target.checked);
                    onSelectedDatesChange(next);
                  }}
                />
                <span>{d}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Match</div>
        <select
          value={matchId ?? ""}
          onChange={(e) => onMatchIdChange(e.target.value ? e.target.value : null)}
          style={{ width: "100%", padding: 6 }}
        >
          <option value="">(select match)</option>
          {matchOptions.map((m) => (
            <option key={m.match_id} value={m.match_id}>
              {m.match_id_clean} — H:{m.human_players} B:{m.bot_players}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Event types</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
          {EVENT_TYPES.map((t) => {
            const checked = selectedEventTypes.includes(t);
            return (
              <label key={t} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = toggleInList(selectedEventTypes, t, e.target.checked);
                    onSelectedEventTypesChange(next);
                  }}
                />
                <span>{t}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 600 }}>Heatmap</div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(e) => onShowHeatmapChange(e.target.checked)}
          />
          <span>Show heatmap</span>
        </label>
        <select
          value={heatmapType}
          disabled={!showHeatmap}
          onChange={(e) => onHeatmapTypeChange(e.target.value as HeatmapType)}
          style={{ width: "100%", padding: 6 }}
        >
          {HEATMAP_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <div style={{ display: "grid", gap: 6, fontSize: 12, color: "#374151" }}>
          <div style={{ fontWeight: 600, color: "#111827" }}>Legend</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, rowGap: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <LegendDot color="#2b6cff" />
              blue dot = human path
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <LegendDot color="#9aa0a6" hollow />
              gray hollow = bot path
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <LegendDot color="#ff2e2e" />
              red = kill
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <LegendDot color="#ff8a00" />
              orange = death
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <LegendDot color="#ffd400" />
              yellow = loot
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <LegendDot color="#7c3aed" />
              purple = storm death
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FilterPanel;
