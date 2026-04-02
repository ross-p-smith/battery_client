"use client";

import { useOctopus } from "@/context/OctopusContext";
import TariffRates from "./TariffRates";
import DispatchTimeline from "./DispatchTimeline";

export default function OctopusIntelligent() {
  const { isLoading, error } = useOctopus();

  if (isLoading) {
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

  if (error) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-2 text-lg font-semibold text-zinc-100">
          Intelligent Go
        </h2>
        <p className="text-sm text-red-400">{error}</p>
        <button
          className="mt-3 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TariffRates />
      <DispatchTimeline />
    </div>
  );
}
