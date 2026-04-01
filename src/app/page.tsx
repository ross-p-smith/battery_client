"use client";

import ConnectionStatus from "@/components/ConnectionStatus";
import PowerFlowDiagram from "@/components/PowerFlowDiagram";
import BatteryGauge from "@/components/BatteryGauge";
import EnergyStats from "@/components/EnergyStats";
import BatteryControls from "@/components/BatteryControls";
import ScheduleManager from "@/components/ScheduleManager";
import NotificationArea from "@/components/NotificationArea";
import { config } from "@/lib/config";

export default function Home() {
  if (!config.inverterSerial) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-zinc-100">
            Battery Dashboard
          </h1>
          <p className="mb-4 text-zinc-400">
            Set your inverter serial number in{" "}
            <code className="rounded bg-zinc-800 px-2 py-0.5 text-sm text-emerald-400">
              .env.local
            </code>
          </p>
          <pre className="rounded-lg bg-zinc-800 p-4 text-left text-sm text-zinc-300">
            {`NEXT_PUBLIC_INVERTER_SERIAL=YOUR_SERIAL\nNEXT_PUBLIC_MQTT_URL=ws://localhost:9001`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-100">
            Battery Dashboard
          </h1>
          <ConnectionStatus />
        </div>
      </header>

      <NotificationArea />

      {/* Main content */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column — Battery & Power */}
          <div className="space-y-6">
            <BatteryGauge />
            <PowerFlowDiagram />
          </div>

          {/* Center column — Energy Stats */}
          <div className="space-y-6">
            <EnergyStats />
          </div>

          {/* Right column — Controls & Schedule */}
          <div className="space-y-6">
            <BatteryControls />
            <ScheduleManager />
          </div>
        </div>
      </main>
    </div>
  );
}
