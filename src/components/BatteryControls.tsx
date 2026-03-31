"use client";

import { useState } from "react";
import { useBattery } from "@/context/BatteryContext";

function SliderControl({
    label,
    value,
    min,
    max,
    step,
    unit,
    onCommit,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onCommit: (v: number) => void;
}) {
    const [local, setLocal] = useState<number | null>(null);
    const display = local ?? value;

    return (
        <div className="rounded-lg bg-zinc-800 p-3">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-zinc-400">{label}</span>
                <span className="tabular-nums text-sm font-semibold text-zinc-200">
                    {display}
                    {unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={display}
                onChange={(e) => setLocal(Number(e.target.value))}
                onMouseUp={() => {
                    if (local !== null) onCommit(local);
                    setLocal(null);
                }}
                onTouchEnd={() => {
                    if (local !== null) onCommit(local);
                    setLocal(null);
                }}
                className="w-full accent-emerald-500"
            />
        </div>
    );
}

function DurationButton({
    label,
    command,
    publishControl,
    activeValue,
    activeNum,
}: {
    label: string;
    command: string;
    publishControl: (cmd: string, payload: string) => void;
    activeValue: string;
    activeNum: number;
}) {
    const [duration, setDuration] = useState("30");
    const isActive = activeValue !== "Normal" && activeNum > 0;

    return (
        <div className="rounded-lg bg-zinc-800 p-3">
            <div className="mb-2 text-xs text-zinc-400">{label}</div>
            {isActive ? (
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-400 tabular-nums">
                        {activeNum} min remaining
                    </span>
                    <button
                        onClick={() => publishControl(command, "Cancel")}
                        className="ml-auto rounded bg-red-900/60 px-3 py-1 text-xs text-red-300 hover:bg-red-800"
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={1}
                        max={1440}
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-20 rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-200 tabular-nums"
                    />
                    <span className="text-xs text-zinc-500">min</span>
                    <button
                        onClick={() => publishControl(command, duration)}
                        className="ml-auto rounded bg-emerald-900/60 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-800"
                    >
                        Start
                    </button>
                </div>
            )}
        </div>
    );
}

export default function BatteryControls() {
    const { control, inverter, publishControl } = useBattery();

    const maxBatRate = inverter.Invertor_Max_Bat_Rate || 2600;

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">
                Battery Controls
            </h2>

            {/* Battery Mode */}
            <div className="mb-4">
                <div className="mb-2 text-xs text-zinc-400">Battery Mode</div>
                <div className="flex gap-2">
                    {["Eco", "Timed Demand", "Timed Export"].map((mode) => (
                        <button
                            key={mode}
                            onClick={() =>
                                publishControl(
                                    "setBatteryMode",
                                    JSON.stringify({ mode }),
                                )
                            }
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${control.Mode === mode
                                    ? "bg-emerald-600 text-white"
                                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* Eco Mode Toggle */}
            <div className="mb-4 flex items-center justify-between rounded-lg bg-zinc-800 p-3">
                <span className="text-sm text-zinc-300">Eco Mode</span>
                <button
                    onClick={() =>
                        publishControl(
                            "setEcoMode",
                            JSON.stringify({
                                state: control.Eco_Mode === "enable" ? "disable" : "enable",
                            }),
                        )
                    }
                    className={`relative h-6 w-11 rounded-full transition-colors ${control.Eco_Mode === "enable" ? "bg-emerald-600" : "bg-zinc-600"
                        }`}
                >
                    <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${control.Eco_Mode === "enable"
                                ? "translate-x-5"
                                : "translate-x-0.5"
                            }`}
                    />
                </button>
            </div>

            {/* Battery Pause Mode */}
            <div className="mb-4">
                <div className="mb-2 text-xs text-zinc-400">Pause Mode</div>
                <div className="flex flex-wrap gap-2">
                    {["Disabled", "PauseCharge", "PauseDischarge", "PauseBoth"].map(
                        (mode) => (
                            <button
                                key={mode}
                                onClick={() =>
                                    publishControl(
                                        "setBatteryPauseMode",
                                        JSON.stringify({ state: mode }),
                                    )
                                }
                                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${control.Battery_pause_mode === mode
                                        ? "bg-amber-600 text-white"
                                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                    }`}
                            >
                                {mode}
                            </button>
                        ),
                    )}
                </div>
            </div>

            {/* Rate Sliders */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SliderControl
                    label="Charge Rate"
                    value={control.Battery_Charge_Rate ?? 0}
                    min={0}
                    max={maxBatRate}
                    step={100}
                    unit=" W"
                    onCommit={(v) =>
                        publishControl(
                            "setChargeRate",
                            JSON.stringify({ chargeRate: String(v) }),
                        )
                    }
                />
                <SliderControl
                    label="Discharge Rate"
                    value={control.Battery_Discharge_Rate ?? 0}
                    min={0}
                    max={maxBatRate}
                    step={100}
                    unit=" W"
                    onCommit={(v) =>
                        publishControl(
                            "setDischargeRate",
                            JSON.stringify({ dischargeRate: String(v) }),
                        )
                    }
                />
                <SliderControl
                    label="Battery Reserve"
                    value={control.Battery_Power_Reserve ?? 4}
                    min={4}
                    max={100}
                    step={1}
                    unit="%"
                    onCommit={(v) =>
                        publishControl(
                            "setBatteryReserve",
                            JSON.stringify({ reservePercent: String(v) }),
                        )
                    }
                />
                <SliderControl
                    label="Charge Target SOC"
                    value={control.Target_SOC ?? 100}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onCommit={(v) =>
                        publishControl(
                            "setChargeTarget",
                            JSON.stringify({ chargeToPercent: String(v) }),
                        )
                    }
                />
            </div>

            {/* Schedule Toggles */}
            <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-lg bg-zinc-800 p-3">
                    <span className="text-xs text-zinc-400">Charge Schedule</span>
                    <button
                        onClick={() =>
                            publishControl(
                                "enableChargeSchedule",
                                JSON.stringify({
                                    state:
                                        control.Enable_Charge_Schedule === "enable"
                                            ? "disable"
                                            : "enable",
                                }),
                            )
                        }
                        className={`relative h-5 w-9 rounded-full transition-colors ${control.Enable_Charge_Schedule === "enable"
                                ? "bg-emerald-600"
                                : "bg-zinc-600"
                            }`}
                    >
                        <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${control.Enable_Charge_Schedule === "enable"
                                    ? "translate-x-4"
                                    : "translate-x-0.5"
                                }`}
                        />
                    </button>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-zinc-800 p-3">
                    <span className="text-xs text-zinc-400">Discharge Schedule</span>
                    <button
                        onClick={() =>
                            publishControl(
                                "enableDischargeSchedule",
                                JSON.stringify({
                                    state:
                                        control.Enable_Discharge_Schedule === "enable"
                                            ? "disable"
                                            : "enable",
                                }),
                            )
                        }
                        className={`relative h-5 w-9 rounded-full transition-colors ${control.Enable_Discharge_Schedule === "enable"
                                ? "bg-emerald-600"
                                : "bg-zinc-600"
                            }`}
                    >
                        <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${control.Enable_Discharge_Schedule === "enable"
                                    ? "translate-x-4"
                                    : "translate-x-0.5"
                                }`}
                        />
                    </button>
                </div>
            </div>

            {/* Force Charge / Export / Pause */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DurationButton
                    label="Force Charge"
                    command="forceCharge"
                    publishControl={publishControl}
                    activeValue={control.Force_Charge ?? "Normal"}
                    activeNum={control.Force_Charge_Num ?? 0}
                />
                <DurationButton
                    label="Force Export"
                    command="forceExport"
                    publishControl={publishControl}
                    activeValue={control.Force_Export ?? "Normal"}
                    activeNum={control.Force_Export_Num ?? 0}
                />
                <DurationButton
                    label="Temp Pause Charge"
                    command="tempPauseCharge"
                    publishControl={publishControl}
                    activeValue={control.Temp_Pause_Charge ?? "Normal"}
                    activeNum={control.Temp_Pause_Charge_Num ?? 0}
                />
                <DurationButton
                    label="Temp Pause Discharge"
                    command="tempPauseDischarge"
                    publishControl={publishControl}
                    activeValue={control.Temp_Pause_Discharge ?? "Normal"}
                    activeNum={control.Temp_Pause_Discharge_Num ?? 0}
                />
            </div>
        </div>
    );
}
