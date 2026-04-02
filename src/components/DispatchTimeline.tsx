"use client";

import { useOctopus } from "@/context/OctopusContext";
import type { OctopusDispatch, CompletedDispatch } from "@/lib/octopus-types";

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const absMins = Math.round(Math.abs(diff) / 60_000);

  if (absMins < 1) return "now";
  if (absMins < 60) {
    const label = `${absMins}m`;
    return diff > 0 ? `in ${label}` : `${label} ago`;
  }

  const hours = Math.floor(absMins / 60);
  const mins = absMins % 60;
  const label = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return diff > 0 ? `in ${label}` : `${label} ago`;
}

function durationMins(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60_000,
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DispatchCard({ d }: { d: OctopusDispatch }) {
  const color =
    d.type === "BOOST"
      ? "border-amber-500/50 bg-amber-500/10"
      : "border-emerald-500/50 bg-emerald-500/10";

  const badge =
    d.type === "BOOST"
      ? "bg-amber-500/20 text-amber-400"
      : "bg-emerald-500/20 text-emerald-400";

  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-center justify-between">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge}`}>
          {d.type}
        </span>
        <span className="text-xs text-zinc-500">{relativeTime(d.start)}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2 tabular-nums">
        <span className="text-sm font-semibold text-zinc-200">
          {formatTime(d.start)} – {formatTime(d.end)}
        </span>
        <span className="text-xs text-zinc-500">
          ({durationMins(d.start, d.end)} min)
        </span>
      </div>
      {d.energyAddedKwh > 0 && (
        <div className="mt-1 text-xs tabular-nums text-zinc-400">
          +{d.energyAddedKwh.toFixed(1)} kWh
        </div>
      )}
    </div>
  );
}

function CompletedCard({ d }: { d: CompletedDispatch }) {
  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="text-sm text-zinc-400">
          {formatTime(d.start)} – {formatTime(d.end)}
        </span>
        <span className="text-xs text-zinc-500">
          ({durationMins(d.start, d.end)} min)
        </span>
      </div>
      <div className="mt-1 text-xs tabular-nums text-zinc-500">
        Δ {d.delta}
      </div>
    </div>
  );
}

export default function DispatchTimeline() {
  const { plannedDispatches, completedDispatches, device } = useOctopus();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-1 text-lg font-semibold text-zinc-100">
        Charging Schedule
      </h2>
      {device && (
        <p className="mb-4 text-xs text-zinc-500">
          {device.make} {device.model}
        </p>
      )}

      {/* Planned dispatches */}
      {plannedDispatches.length === 0 ? (
        <p className="text-sm text-zinc-500">No planned dispatches</p>
      ) : (
        <div className="space-y-2">
          {plannedDispatches.map((d, i) => (
            <DispatchCard key={`${d.start}-${i}`} d={d} />
          ))}
        </div>
      )}

      {/* Completed dispatches */}
      {completedDispatches.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-400">
            Completed ({completedDispatches.length})
          </summary>
          <div className="mt-2 space-y-2">
            {completedDispatches.map((d, i) => (
              <CompletedCard key={`${d.start}-${i}`} d={d} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
