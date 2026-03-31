"use client";

import { useBattery } from "@/context/BatteryContext";

function FlowArrow({
    from,
    to,
    watts,
    color,
}: {
    from: string;
    to: string;
    watts: number;
    color: string;
}) {
    if (watts <= 0) return null;
    return (
        <div className={`flex items-center gap-2 text-sm ${color}`}>
            <span className="font-medium">{from}</span>
            <span className="text-xs">→</span>
            <span className="font-medium">{to}</span>
            <span className="ml-auto tabular-nums font-semibold">
                {watts >= 1000 ? `${(watts / 1000).toFixed(1)} kW` : `${watts} W`}
            </span>
        </div>
    );
}

export default function PowerFlowDiagram() {
    const { power } = useBattery();
    const { Flows } = power;

    const totalPV =
        Flows.Solar_to_House + Flows.Solar_to_Battery + Flows.Solar_to_Grid;
    const totalGrid = Flows.Grid_to_House + Flows.Grid_to_Battery;
    const totalBattery = Flows.Battery_to_House + Flows.Battery_to_Grid;

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">Power Flows</h2>

            {/* Summary badges */}
            <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-amber-950/40 p-3 text-center">
                    <div className="text-xs text-amber-400">Solar</div>
                    <div className="text-lg font-bold tabular-nums text-amber-300">
                        {totalPV >= 1000
                            ? `${(totalPV / 1000).toFixed(1)} kW`
                            : `${totalPV} W`}
                    </div>
                </div>
                <div className="rounded-lg bg-blue-950/40 p-3 text-center">
                    <div className="text-xs text-blue-400">Grid</div>
                    <div className="text-lg font-bold tabular-nums text-blue-300">
                        {power.Power.Import_Power > 0
                            ? `↓ ${power.Power.Import_Power >= 1000 ? `${(power.Power.Import_Power / 1000).toFixed(1)} kW` : `${power.Power.Import_Power} W`}`
                            : power.Power.Export_Power > 0
                                ? `↑ ${power.Power.Export_Power >= 1000 ? `${(power.Power.Export_Power / 1000).toFixed(1)} kW` : `${power.Power.Export_Power} W`}`
                                : "0 W"}
                    </div>
                </div>
                <div className="rounded-lg bg-emerald-950/40 p-3 text-center">
                    <div className="text-xs text-emerald-400">Battery</div>
                    <div className="text-lg font-bold tabular-nums text-emerald-300">
                        {power.Power.Charge_Power > 0
                            ? `↓ ${power.Power.Charge_Power >= 1000 ? `${(power.Power.Charge_Power / 1000).toFixed(1)} kW` : `${power.Power.Charge_Power} W`}`
                            : totalBattery > 0
                                ? `↑ ${totalBattery >= 1000 ? `${(totalBattery / 1000).toFixed(1)} kW` : `${totalBattery} W`}`
                                : "0 W"}
                    </div>
                </div>
            </div>

            {/* Flow lines */}
            <div className="space-y-2">
                <FlowArrow from="Solar" to="House" watts={Flows.Solar_to_House} color="text-amber-400" />
                <FlowArrow from="Solar" to="Battery" watts={Flows.Solar_to_Battery} color="text-amber-500" />
                <FlowArrow from="Solar" to="Grid" watts={Flows.Solar_to_Grid} color="text-amber-600" />
                <FlowArrow from="Grid" to="House" watts={Flows.Grid_to_House} color="text-blue-400" />
                <FlowArrow from="Grid" to="Battery" watts={Flows.Grid_to_Battery} color="text-blue-500" />
                <FlowArrow from="Battery" to="House" watts={Flows.Battery_to_House} color="text-emerald-400" />
                <FlowArrow from="Battery" to="Grid" watts={Flows.Battery_to_Grid} color="text-emerald-500" />
            </div>

            {/* House load */}
            <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-center">
                <div className="text-xs text-zinc-400">House Load</div>
                <div className="text-xl font-bold tabular-nums text-zinc-100">
                    {power.Power.Load_Power >= 1000
                        ? `${(power.Power.Load_Power / 1000).toFixed(1)} kW`
                        : `${power.Power.Load_Power} W`}
                </div>
            </div>

            {/* Grid details */}
            <div className="mt-3 flex justify-between text-xs text-zinc-500">
                <span>{power.Power.Grid_Voltage.toFixed(1)} V</span>
                <span>{power.Power.Grid_Frequency.toFixed(2)} Hz</span>
                <span>{power.Power.Grid_Current.toFixed(1)} A</span>
            </div>
        </div>
    );
}
