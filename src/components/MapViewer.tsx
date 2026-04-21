import React, { useEffect, useMemo, useRef } from "react";
import type { MapEvent } from "../types";

export type HeatmapType = "kills" | "deaths" | "traffic" | "loot";

type HeatmapGrid = number[][];

export type MapViewerProps = {
  mapId: string;
  events: MapEvent[];
  showHeatmap: boolean;
  heatmapType: HeatmapType;
  heatmaps?: Partial<Record<HeatmapType, HeatmapGrid>>;
};

const DISPLAY_SIZE = 600;
const SOURCE_SIZE = 1024;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function eventKind(e: MapEvent): string {
  return (e.event || e.category || "").trim();
}

function dotStyle(kind: string) {
  switch (kind) {
    case "Position":
      return { color: "#2b6cff", r: 2 };
    case "BotPosition":
      return { color: "#9aa0a6", r: 2 };
    case "Kill":
    case "BotKill":
      return { color: "#ff2e2e", r: 5 };
    case "Killed":
    case "BotKilled":
      return { color: "#ff8a00", r: 5 };
    case "KilledByStorm":
      return { color: "#7c3aed", r: 6 };
    case "Loot":
      return { color: "#ffd400", r: 4 };
    default:
      return { color: "#ffffff", r: 2 };
  }
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  filled: boolean
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function heatColor(t: number) {
  // Simple blue->red ramp
  const tt = clamp01(t);
  const r = Math.round(255 * tt);
  const g = Math.round(80 * (1 - tt));
  const b = Math.round(255 * (1 - tt));
  return `rgb(${r},${g},${b})`;
}

export function MapViewer({
  mapId,
  events,
  showHeatmap,
  heatmapType,
  heatmaps,
}: MapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const minimapSrc = useMemo(() => {
    const isLockdown = mapId.trim().toLowerCase() === "lockdown";
    const ext = isLockdown ? "jpg" : "png";
    return `/minimaps/${mapId}_Minimap.${ext}`;
  }, [mapId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(DISPLAY_SIZE * dpr);
    canvas.height = Math.round(DISPLAY_SIZE * dpr);
    canvas.style.width = `${DISPLAY_SIZE}px`;
    canvas.style.height = `${DISPLAY_SIZE}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);

    if (showHeatmap) {
      const grid = heatmaps?.[heatmapType];
      if (grid && grid.length > 0 && grid[0]?.length) {
        let max = 0;
        for (let y = 0; y < grid.length; y++) {
          const row = grid[y] ?? [];
          for (let x = 0; x < row.length; x++) max = Math.max(max, row[x] ?? 0);
        }

        const rows = grid.length;
        const cols = grid[0].length;
        const cellW = DISPLAY_SIZE / cols;
        const cellH = DISPLAY_SIZE / rows;

        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        for (let gy = 0; gy < rows; gy++) {
          const row = grid[gy] ?? [];
          for (let gx = 0; gx < cols; gx++) {
            const v = row[gx] ?? 0;
            if (v <= 0 || max <= 0) continue;
            const t = v / max;
            ctx.globalAlpha = 0.55 * clamp01(t);
            ctx.fillStyle = heatColor(t);
            ctx.fillRect(gx * cellW, gy * cellH, cellW, cellH);
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    for (const e of events) {
      const x = (e.px / SOURCE_SIZE) * DISPLAY_SIZE;
      const y = (e.py / SOURCE_SIZE) * DISPLAY_SIZE;
      const kind = eventKind(e);
      const { color, r } = dotStyle(kind);
      drawDot(ctx, x, y, r, color, !e.is_bot);
    }
  }, [events, heatmapType, heatmaps, showHeatmap]);

  return (
    <div style={{ position: "relative", width: DISPLAY_SIZE, height: DISPLAY_SIZE }}>
      <img
        src={minimapSrc}
        alt={`${mapId} minimap`}
        width={DISPLAY_SIZE}
        height={DISPLAY_SIZE}
        style={{
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE,
          position: "absolute",
          inset: 0,
          objectFit: "contain",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
      />
    </div>
  );
}

export default MapViewer;
