"use client";

import { useOctopus } from "@/context/OctopusContext";
import TariffRates from "./TariffRates";
import DispatchTimeline from "./DispatchTimeline";

export default function OctopusIntelligent() {
  const { isLoading, error, tariff, refresh } = useOctopus();

  if (isLoading && !tariff) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 h-5 w-48 rounded bg-zinc-800" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-zinc-800" />
            ))}
          </div>
        </div>
        <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 h-5 w-40 rounded bg-zinc-800" />
          <div className="h-20 rounded-lg bg-zinc-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Intelligent Go</h2>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
          title="Refresh Octopus data"
        >
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <TariffRates />
      <DispatchTimeline />
    </div>
  );
}
