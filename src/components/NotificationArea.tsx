"use client";

import { useBattery } from "@/context/BatteryContext";
import type { NotificationStatus } from "@/lib/types";

const statusConfig: Record<
  NotificationStatus,
  { icon: string; color: string; text: string }
> = {
  pending: {
    icon: "⏳",
    color: "bg-cyan-900/60 text-cyan-300 border-cyan-800",
    text: "Sending...",
  },
  success: {
    icon: "✓",
    color: "bg-emerald-900/60 text-emerald-300 border-emerald-800",
    text: "Confirmed",
  },
  timeout: {
    icon: "⚠",
    color: "bg-amber-900/60 text-amber-300 border-amber-800",
    text: "No response",
  },
  error: {
    icon: "✗",
    color: "bg-red-900/60 text-red-300 border-red-800",
    text: "Error",
  },
};

export default function NotificationArea() {
  const { notifications, dismissNotification } = useBattery();

  if (notifications.length === 0) return null;

  return (
    <div className="border-b border-zinc-800 px-6 py-2">
      <div className="mx-auto max-w-7xl space-y-1">
        {notifications.slice(-5).map((n) => {
          const config = statusConfig[n.status];
          return (
            <div
              key={n.id}
              className={`flex items-center justify-between rounded px-3 py-1.5 text-xs border ${config.color} ${n.status === "pending" ? "animate-pulse" : ""}`}
            >
              <span>
                <span className="mr-2">{config.icon}</span>
                <span className="font-medium">{n.label}</span>
                <span className="ml-2 opacity-75">{config.text}</span>
              </span>
              <button
                onClick={() => dismissNotification(n.id)}
                className="ml-4 opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
