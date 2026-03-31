"use client";

import { useBattery } from "@/context/BatteryContext";

function StatCard({
    label,
    today,
    total,
    unit = "kWh",
    color = "text-zinc-200",
}: {
    label: string;
    today: number;
    total: number;
    unit?: string;
    color?: string;
}) {
    return (
        <div className="rounded-lg bg-zinc-800 p-3">
            <div className="mb-1 text-xs text-zinc-500">{label}</div>
            <div className={`tabular-nums text-lg font-bold ${color}`}>
                {(today ?? 0).toFixed(1)} {unit}
            </div>
            <div className="mt-1 text-xs tabular-nums text-zinc-500">
                Total: {(total ?? 0).toFixed(1)} {unit}
            </div>
        </div>
    );
}

export default function EnergyStats() {
    const { energy } = useBattery();
    const { Today, Total } = energy;

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">
                Energy Statistics
            </h2>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatCard
                    label="Solar Generation"
                    today={Today.PV_Energy_Today_kWh}
                    total={Total.PV_Energy_Total_kWh}
                    color="text-amber-400"
                />
                <StatCard
                    label="Grid Import"
                    today={Today.Import_Energy_Today_kWh}
                    total={Total.Import_Energy_Total_kWh}
                    color="text-blue-400"
                />
                <StatCard
                    label="Grid Export"
                    today={Today.Export_Energy_Today_kWh}
                    total={Total.Export_Energy_Total_kWh}
                    color="text-purple-400"
                />
                <StatCard
                    label="Battery Charge"
                    today={Today.Battery_Charge_Energy_Today_kWh}
                    total={Total.Battery_Charge_Energy_Total_kWh}
                    color="text-emerald-400"
                />
                <StatCard
                    label="Battery Discharge"
                    today={Today.Battery_Discharge_Energy_Today_kWh}
                    total={Total.Battery_Discharge_Energy_Total_kWh}
                    color="text-emerald-300"
                />
                <StatCard
                    label="House Load"
                    today={Today.Load_Energy_Today_kWh}
                    total={Total.Load_Energy_Total_kWh}
                    color="text-zinc-200"
                />
                <StatCard
                    label="Self Consumption"
                    today={Today.Self_Consumption_Energy_Today_kWh}
                    total={Total.Self_Consumption_Energy_Total_kWh}
                    color="text-teal-400"
                />
                <StatCard
                    label="Inverter Output"
                    today={Today.Invertor_Energy_Today_kWh}
                    total={Total.Invertor_Energy_Total_kWh}
                    color="text-zinc-300"
                />
                <StatCard
                    label="Battery Throughput"
                    today={Today.Battery_Throughput_Today_kWh}
                    total={Total.Battery_Throughput_Total_kWh}
                    color="text-zinc-400"
                />
            </div>

            {/* Rate info */}
            {energy.Rates?.Current_Rate != null && (
                <div className="mt-4 flex items-center gap-4 rounded-lg bg-zinc-800 p-3 text-sm">
                    <span className="text-zinc-400">Current Rate:</span>
                    <span className="font-semibold text-zinc-200 tabular-nums">
                        {energy.Rates.Current_Rate}p/kWh
                    </span>
                    <span className="text-zinc-500">
                        ({energy.Rates.Current_Rate_Type})
                    </span>
                    <span className="ml-auto text-zinc-400">
                        Import avg: {(energy.Rates.Import_ppkwh_Today ?? 0).toFixed(3)}p/kWh
                    </span>
                </div>
            )}
        </div>
    );
}
