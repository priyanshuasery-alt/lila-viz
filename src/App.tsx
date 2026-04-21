import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import FilterPanel, { type EventType, type HeatmapType, type MapId } from "./components/FilterPanel";
import MapViewer from "./components/MapViewer";
import Timeline from "./components/Timeline";
import type { IndexData, MapEvent, MatchMeta } from "./types";

type RawEvent = Partial<MapEvent> & {
  match_id_clean?: string;
};

type RawMapData = {
  map_id: string;
  total_events: number;
  events: RawEvent[];
  heatmaps?: Record<string, unknown>;
};

type RawMatchData = {
  match_id: string;
  map_id: string;
  duration_ms: number;
  events: Omit<MapEvent, "match_id" | "date">[];
};

function normalizeEvent(raw: RawEvent, fallback: { matchId: string; date: string }): MapEvent {
  return {
    user_id: raw.user_id ?? "",
    match_id: raw.match_id ?? raw.match_id_clean ?? fallback.matchId,
    event: raw.event ?? "",
    category: raw.category ?? "",
    px: Number(raw.px ?? 0),
    py: Number(raw.py ?? 0),
    ts_relative: Number(raw.ts_relative ?? 0),
    is_bot: Boolean(raw.is_bot),
    date: raw.date ?? fallback.date,
  };
}

function Spinner() {
  return (
    <div
      aria-label="Loading"
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: "3px solid rgba(0,0,0,0.15)",
        borderTopColor: "rgba(0,0,0,0.55)",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

function App() {
  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const [mapId, setMapId] = useState<MapId>("AmbroseValley");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [selectedEventTypes, setSelectedEventTypes] = useState<EventType[]>([
    "Position",
    "BotPosition",
    "Kill",
    "Killed",
    "BotKill",
    "BotKilled",
    "KilledByStorm",
    "Loot",
  ]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapType, setHeatmapType] = useState<HeatmapType>("traffic");
  const [currentTime, setCurrentTime] = useState(0);

  const [mapData, setMapData] = useState<RawMapData | null>(null);
  const [matchData, setMatchData] = useState<RawMatchData | null>(null);

  const [loadingIndex, setLoadingIndex] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingIndex(true);
    fetch("/data/index.json")
      .then((r) => {
        if (!r.ok) throw new Error(`index.json ${r.status}`);
        return r.json();
      })
      .then((data: IndexData) => {
        if (cancelled) return;
        setIndexData(data);
        if (data.dates?.length) setSelectedDates([data.dates[0]]);
        const maybeMap = (data.maps?.[0] as MapId | undefined) ?? "AmbroseValley";
        setMapId(maybeMap);
      })
      .catch(() => {
        if (cancelled) return;
        setIndexData({ dates: [], maps: [], matches: [] });
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingIndex(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setLoadingMap(true);
    setMapData(null);
    setMatchData(null);
    setMatchId(null);
    setCurrentTime(0);

    fetch(`/data/${mapId}.json`, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`${mapId}.json ${r.status}`);
        return r.json();
      })
      .then((data: RawMapData) => {
        setMapData(data);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setMapData({ map_id: mapId, total_events: 0, events: [], heatmaps: {} });
      })
      .finally(() => {
        if (ac.signal.aborted) return;
        setLoadingMap(false);
      });

    return () => ac.abort();
  }, [mapId]);

  const selectedMatchMeta: MatchMeta | null = useMemo(() => {
    if (!indexData || !matchId) return null;
    return indexData.matches.find((m) => m.match_id === matchId) ?? null;
  }, [indexData, matchId]);

  useEffect(() => {
    if (!matchId) {
      setMatchData(null);
      setLoadingMatch(false);
      setCurrentTime(0);
      return;
    }

    const ac = new AbortController();
    setLoadingMatch(true);
    setMatchData(null);
    setCurrentTime(0);

    fetch(`/data/matches/${matchId}.json`, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`match ${r.status}`);
        return r.json();
      })
      .then((data: RawMatchData) => {
        setMatchData(data);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setMatchData({
          match_id: matchId,
          map_id: mapId,
          duration_ms: 0,
          events: [],
        });
      })
      .finally(() => {
        if (ac.signal.aborted) return;
        setLoadingMatch(false);
      });

    return () => ac.abort();
  }, [mapId, matchId]);

  const baseEvents: MapEvent[] = useMemo(() => {
    if (matchData) {
      const date = selectedMatchMeta?.date ?? selectedDates[0] ?? "";
      return (matchData.events as unknown as RawEvent[]).map((e) =>
        normalizeEvent(e, { matchId: matchData.match_id, date })
      );
    }

    if (!mapData) return [];
    const fallbackDate = selectedDates[0] ?? "";
    return (mapData.events ?? []).map((e) => normalizeEvent(e, { matchId: e.match_id_clean ?? "", date: fallbackDate }));
  }, [mapData, matchData, selectedDates, selectedMatchMeta]);

  const filteredEvents: MapEvent[] = useMemo(() => {
    const dateSet = new Set(selectedDates);
    const typeSet = new Set(selectedEventTypes);
    return baseEvents.filter((e) => {
      if (selectedDates.length > 0 && !dateSet.has(e.date)) return false;
      if (selectedEventTypes.length > 0 && !typeSet.has(e.event as EventType)) return false;
      if (e.ts_relative > currentTime) return false;
      return true;
    });
  }, [baseEvents, currentTime, selectedDates, selectedEventTypes]);

  const timelineDuration = useMemo(() => {
    const fromMatch = matchData?.duration_ms ?? 0;
    if (fromMatch > 0) return fromMatch;
    let max = 0;
    for (const e of baseEvents) max = Math.max(max, e.ts_relative);
    return max;
  }, [baseEvents, matchData?.duration_ms]);

  const matchesForUi = useMemo(() => {
    if (!indexData) return [];
    const datesSet = new Set(selectedDates);
    return indexData.matches.filter(
      (m) => m.map_id === mapId && (datesSet.size === 0 || datesSet.has(m.date))
    );
  }, [indexData, mapId, selectedDates]);

  const anyLoading = loadingIndex || loadingMap || loadingMatch;

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateRows: "48px 1fr" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 48,
          padding: "0 16px",
          borderBottom: "1px solid #e5e7eb",
          background: "#0b0f19",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
            LILA BLACK — Player Journey Visualizer
          </div>
          <div style={{ opacity: 0.85, fontWeight: 600, whiteSpace: "nowrap" }}>{mapId}</div>
        </div>
        {anyLoading ? <Spinner /> : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: 0 }}>
        <div style={{ borderRight: "1px solid #e5e7eb", overflow: "auto" }}>
          <FilterPanel
            mapId={mapId}
            selectedDates={selectedDates}
            matchId={matchId}
            selectedEventTypes={selectedEventTypes}
            showHeatmap={showHeatmap}
            heatmapType={heatmapType}
            onMapIdChange={(m) => {
              setMapId(m);
            }}
            onSelectedDatesChange={(dates) => {
              setSelectedDates(dates);
              setMatchId(null);
              setCurrentTime(0);
            }}
            onMatchIdChange={(m) => setMatchId(m)}
            onSelectedEventTypesChange={(types) => setSelectedEventTypes(types)}
            onShowHeatmapChange={(show) => setShowHeatmap(show)}
            onHeatmapTypeChange={(t) => setHeatmapType(t)}
            indexData={
              indexData
                ? {
                    ...indexData,
                    matches: matchesForUi,
                  }
                : undefined
            }
          />
        </div>

        <div style={{ padding: 16, overflow: "auto" }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <MapViewer
                mapId={mapId}
                events={filteredEvents}
                showHeatmap={showHeatmap}
                heatmapType={heatmapType}
                heatmaps={(mapData?.heatmaps as any) ?? undefined}
              />
            </div>
            <Timeline events={baseEvents} duration_ms={timelineDuration} onChange={setCurrentTime} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
