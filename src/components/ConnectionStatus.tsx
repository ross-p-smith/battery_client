"use client";

import { useBattery } from "@/context/BatteryContext";

export default function ConnectionStatus() {
    const { isConnected, lastUpdate, stats } = useBattery();

    const statusColor = isConnected ? "bg-emerald-500" : "bg-red-500";
    const statusText = isConnected ? "Connected" : "Disconnected";

    return (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm">
            <div className="flex items-center gap-2">
                <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor} ${isConnected ? "animate-pulse" : ""
                        }`}
                />
                <span className="text-zinc-300">{statusText}</span>
            </div>

            {lastUpdate && (
                <span className="text-zinc-500">
                    Last update:{" "}
                    {new Date(lastUpdate).toLocaleTimeString()}
                </span>
            )}

            {stats.GivTCP_Version && (
                <span className="text-zinc-600">
                    GivTCP {stats.GivTCP_Version}
                </span>
            )}

            {stats.status && (
                <span
                    className={`ml-auto text-xs ${stats.status === "online" ? "text-emerald-400" : "text-red-400"
                        }`}
                >
                    Inverter: {stats.status}
                </span>
            )}
        </div>
    );
}
