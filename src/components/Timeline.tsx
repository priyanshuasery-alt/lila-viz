import React, { useEffect, useMemo, useRef, useState } from "react";
import type { MapEvent } from "../types";

export type TimelineProps = {
  events: MapEvent[];
  duration_ms: number;
  onChange: (currentTime: number) => void;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatMMSS(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function LegendSwatch({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: 2,
        background: color,
        border: "1px solid rgba(0,0,0,0.15)",
      }}
    />
  );
}

export function Timeline({ events, duration_ms, onChange }: TimelineProps) {
  const safeDuration = Math.max(0, Math.floor(duration_ms || 0));

  const maxEventTime = useMemo(() => {
    let max = 0;
    for (const e of events) max = Math.max(max, e.ts_relative || 0);
    return max;
  }, [events]);

  const effectiveMax = Math.max(safeDuration, maxEventTime);

  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    onChange(currentTime);
  }, [currentTime, onChange]);

  useEffect(() => {
    if (!playing) {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    tickRef.current = window.setInterval(() => {
      setCurrentTime((t) => {
        const next = clamp(t + 1000, 0, effectiveMax);
        return next;
      });
    }, 100);

    return () => {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [effectiveMax, playing]);

  useEffect(() => {
    if (currentTime >= effectiveMax && playing) setPlaying(false);
  }, [currentTime, effectiveMax, playing]);

  return (
    <div style={{ display: "grid", gap: 10, padding: 12, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          style={{ padding: "6px 10px" }}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <div style={{ fontVariantNumeric: "tabular-nums", minWidth: 60 }}>
          {formatMMSS(currentTime)}
        </div>
        <input
          type="range"
          min={0}
          max={effectiveMax}
          step={100}
          value={currentTime}
          onChange={(e) => {
            setCurrentTime(Number(e.target.value));
          }}
          style={{ flex: 1 }}
        />
        <div style={{ fontVariantNumeric: "tabular-nums", minWidth: 60, textAlign: "right" }}>
          {formatMMSS(effectiveMax)}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LegendSwatch color="#2b6cff" />
          blue=human path
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LegendSwatch color="#9aa0a6" />
          gray=bot path
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LegendSwatch color="#ff2e2e" />
          red=kill
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LegendSwatch color="#ff8a00" />
          orange=death
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LegendSwatch color="#7c3aed" />
          purple=storm
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LegendSwatch color="#ffd400" />
          yellow=loot
        </span>
      </div>
    </div>
  );
}

export default Timeline;
