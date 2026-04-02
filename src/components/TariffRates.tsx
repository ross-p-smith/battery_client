"use client";

import { useOctopus } from "@/context/OctopusContext";

export default function TariffRates() {
  const { tariff } = useOctopus();

  if (!tariff) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-lg font-semibold text-zinc-100">
        Intelligent Go Tariff
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {/* Off-peak rate */}
        <div className="rounded-lg bg-zinc-800 p-3">
          <div className="mb-1 text-xs text-zinc-500">EV Off-Peak Rate</div>
          <div className="tabular-nums text-lg font-bold text-emerald-400">
            {tariff.evOffPeakRate.toFixed(2)}p/kWh
          </div>
        </div>

        {/* Peak rate */}
        <div className="rounded-lg bg-zinc-800 p-3">
          <div className="mb-1 text-xs text-zinc-500">EV Peak Rate</div>
          <div className="tabular-nums text-lg font-bold text-zinc-200">
            {tariff.evPeakRate.toFixed(2)}p/kWh
          </div>
        </div>

        {/* Standing charge */}
        <div className="rounded-lg bg-zinc-800 p-3">
          <div className="mb-1 text-xs text-zinc-500">Standing Charge</div>
          <div className="tabular-nums text-lg font-bold text-zinc-200">
            {tariff.standingCharge.toFixed(2)}p/day
          </div>
        </div>

        {/* Off-peak window */}
        <div className="rounded-lg bg-zinc-800 p-3">
          <div className="mb-1 text-xs text-zinc-500">Off-Peak Window</div>
          <div className="tabular-nums text-lg font-bold text-emerald-400">
            {tariff.offPeakWindow.start} – {tariff.offPeakWindow.end}
          </div>
        </div>
      </div>
    </div>
  );
}
