"use client";

import { useBattery } from "@/context/BatteryContext";

function socColor(soc: number): string {
    if (soc >= 80) return "bg-emerald-500";
    if (soc >= 50) return "bg-emerald-400";
    if (soc >= 20) return "bg-amber-500";
    return "bg-red-500";
}

function socTextColor(soc: number): string {
    if (soc >= 80) return "text-emerald-400";
    if (soc >= 50) return "text-emerald-300";
    if (soc >= 20) return "text-amber-400";
    return "text-red-400";
}

export default function BatteryGauge() {
    const { power } = useBattery();
    const { SOC, SOC_kWh, Battery_Power, Battery_Voltage } = power.Power;

    const isCharging = power.Flows.Grid_to_Battery > 0 || power.Flows.Solar_to_Battery > 0;
    const isDischarging = power.Flows.Battery_to_House > 0 || power.Flows.Battery_to_Grid > 0;

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">Battery</h2>

            {/* SOC display */}
            <div className="mb-4 text-center">
                <div className={`text-5xl font-bold tabular-nums ${socTextColor(SOC)}`}>
                    {SOC}%
                </div>
                <div className="mt-1 text-sm text-zinc-400 tabular-nums">
                    {SOC_kWh.toFixed(2)} kWh
                </div>
            </div>

            {/* SOC bar */}
            <div className="mb-4 h-6 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${socColor(SOC)}`}
                    style={{ width: `${Math.min(100, Math.max(0, SOC))}%` }}
                />
            </div>

            {/* Status */}
            <div className="mb-4 text-center">
                {isCharging && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/50 px-3 py-1 text-sm text-blue-400">
                        <span className="animate-pulse">⚡</span> Charging
                    </span>
                )}
                {isDischarging && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/50 px-3 py-1 text-sm text-emerald-400">
                        <span className="animate-pulse">🔋</span> Discharging
                    </span>
                )}
                {!isCharging && !isDischarging && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-400">
                        Idle
                    </span>
                )}
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-zinc-800 p-3">
                    <div className="text-xs text-zinc-500">Power</div>
                    <div className="tabular-nums font-semibold text-zinc-200">
                        {Battery_Power >= 1000
                            ? `${(Battery_Power / 1000).toFixed(1)} kW`
                            : `${Battery_Power} W`}
                    </div>
                </div>
                <div className="rounded-lg bg-zinc-800 p-3">
                    <div className="text-xs text-zinc-500">Voltage</div>
                    <div className="tabular-nums font-semibold text-zinc-200">
                        {Battery_Voltage.toFixed(1)} V
                    </div>
                </div>
                <div className="rounded-lg bg-zinc-800 p-3">
                    <div className="text-xs text-zinc-500">Charge Time</div>
                    <div className="tabular-nums font-semibold text-zinc-200">
                        {power.Power.Charge_Time_Remaining > 0
                            ? `${power.Power.Charge_Time_Remaining} min`
                            : "—"}
                    </div>
                </div>
                <div className="rounded-lg bg-zinc-800 p-3">
                    <div className="text-xs text-zinc-500">Discharge Time</div>
                    <div className="tabular-nums font-semibold text-zinc-200">
                        {power.Power.Discharge_Time_Remaining > 0
                            ? `${power.Power.Discharge_Time_Remaining} min`
                            : "—"}
                    </div>
                </div>
            </div>
        </div>
    );
}
