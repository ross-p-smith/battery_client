"use client";

import { useState } from "react";
import { useBattery } from "@/context/BatteryContext";

interface SlotData {
    start: string;
    finish: string;
    targetSoc: string;
}

function parseTimeSlot(timeStr: string): string {
    // GivTCP format: "HH:MM:SS" → "HH:MM"
    if (!timeStr || timeStr === "00:00:00") return "00:00";
    return timeStr.slice(0, 5);
}

function formatTimeForCommand(time: string): string {
    // "HH:MM" → "HHMM"
    return time.replace(":", "");
}

function SlotEditor({
    slotNumber,
    type,
    startTime,
    endTime,
    onSave,
}: {
    slotNumber: number;
    type: "charge" | "discharge";
    startTime: string;
    endTime: string;
    onSave: (slot: SlotData) => void;
}) {
    const [start, setStart] = useState(parseTimeSlot(startTime));
    const [finish, setFinish] = useState(parseTimeSlot(endTime));
    const [targetSoc, setTargetSoc] = useState("100");
    const [modified, setModified] = useState(false);

    const label = type === "charge" ? "Charge" : "Discharge";
    const color = type === "charge" ? "emerald" : "amber";

    return (
        <div className="rounded-lg bg-zinc-800 p-3">
            <div className={`mb-2 text-xs text-${color}-400`}>
                {label} Slot {slotNumber}
            </div>
            <div className="flex flex-wrap items-end gap-2">
                <div>
                    <label className="block text-xs text-zinc-500">Start</label>
                    <input
                        type="time"
                        value={start}
                        onChange={(e) => {
                            setStart(e.target.value);
                            setModified(true);
                        }}
                        className="rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-200"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500">End</label>
                    <input
                        type="time"
                        value={finish}
                        onChange={(e) => {
                            setFinish(e.target.value);
                            setModified(true);
                        }}
                        className="rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-200"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500">Target %</label>
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={targetSoc}
                        onChange={(e) => {
                            setTargetSoc(e.target.value);
                            setModified(true);
                        }}
                        className="w-16 rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-200 tabular-nums"
                    />
                </div>
                <button
                    onClick={() => {
                        onSave({
                            start: formatTimeForCommand(start),
                            finish: formatTimeForCommand(finish),
                            targetSoc,
                        });
                        setModified(false);
                    }}
                    disabled={!modified}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${modified
                            ? `bg-${color}-900/60 text-${color}-300 hover:bg-${color}-800`
                            : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                        }`}
                >
                    Save
                </button>
            </div>
            <div className="mt-1 text-xs text-zinc-600">
                Current: {parseTimeSlot(startTime)} — {parseTimeSlot(endTime)}
            </div>
        </div>
    );
}

export default function ScheduleManager() {
    const { timeslots, publishControl } = useBattery();

    const handleSaveChargeSlot = (slotNum: number, data: SlotData) => {
        const payload: Record<string, string> = {
            start: data.start,
            finish: data.finish,
        };
        if (data.targetSoc) {
            payload.chargeToPercent = data.targetSoc;
        }
        publishControl(`setChargeSlot${slotNum}`, JSON.stringify(payload));
    };

    const handleSaveDischargeSlot = (slotNum: number, data: SlotData) => {
        const payload: Record<string, string> = {
            start: data.start,
            finish: data.finish,
        };
        if (data.targetSoc) {
            payload.dischargeToPercent = data.targetSoc;
        }
        publishControl(`setDischargeSlot${slotNum}`, JSON.stringify(payload));
    };

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">
                Schedule Manager
            </h2>

            <div className="space-y-4">
                <div>
                    <h3 className="mb-2 text-sm font-medium text-emerald-400">
                        Charge Slots
                    </h3>
                    <div className="space-y-2">
                        <SlotEditor
                            slotNumber={1}
                            type="charge"
                            startTime={timeslots.Charge_start_time_slot_1 ?? ""}
                            endTime={timeslots.Charge_end_time_slot_1 ?? ""}
                            onSave={(data) => handleSaveChargeSlot(1, data)}
                        />
                        <SlotEditor
                            slotNumber={2}
                            type="charge"
                            startTime={timeslots.Charge_start_time_slot_2 ?? ""}
                            endTime={timeslots.Charge_end_time_slot_2 ?? ""}
                            onSave={(data) => handleSaveChargeSlot(2, data)}
                        />
                        <SlotEditor
                            slotNumber={3}
                            type="charge"
                            startTime={timeslots.Charge_start_time_slot_3 ?? ""}
                            endTime={timeslots.Charge_end_time_slot_3 ?? ""}
                            onSave={(data) => handleSaveChargeSlot(3, data)}
                        />
                    </div>
                </div>

                <div>
                    <h3 className="mb-2 text-sm font-medium text-amber-400">
                        Discharge Slots
                    </h3>
                    <div className="space-y-2">
                        <SlotEditor
                            slotNumber={1}
                            type="discharge"
                            startTime={timeslots.Discharge_start_time_slot_1 ?? ""}
                            endTime={timeslots.Discharge_end_time_slot_1 ?? ""}
                            onSave={(data) => handleSaveDischargeSlot(1, data)}
                        />
                        <SlotEditor
                            slotNumber={2}
                            type="discharge"
                            startTime={timeslots.Discharge_start_time_slot_2 ?? ""}
                            endTime={timeslots.Discharge_end_time_slot_2 ?? ""}
                            onSave={(data) => handleSaveDischargeSlot(2, data)}
                        />
                        <SlotEditor
                            slotNumber={3}
                            type="discharge"
                            startTime={timeslots.Discharge_start_time_slot_3 ?? ""}
                            endTime={timeslots.Discharge_end_time_slot_3 ?? ""}
                            onSave={(data) => handleSaveDischargeSlot(3, data)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
