import { commandMeta } from "./topics";
import type { CommandNotification, InverterInfo } from "./types";

export function validMaxBatteryRate(max: unknown): max is number {
  return typeof max === "number" && Number.isFinite(max) && max > 0;
}

export function batteryRateValue(max: unknown, rate: unknown): number | null {
  return validMaxBatteryRate(max) &&
    typeof rate === "number" &&
    Number.isFinite(rate) &&
    rate >= 0 &&
    rate <= max
    ? rate
    : null;
}

export function rateCommandError(
  command: string,
  payload: string,
  max: InverterInfo["Invertor_Max_Bat_Rate"],
): string | null {
  if (command !== "setChargeRate" && command !== "setDischargeRate") return null;
  if (!validMaxBatteryRate(max)) {
    return "Not sent: GivTCP maximum battery power is missing or invalid.";
  }
  const rate = payload.trim() === "" ? NaN : Number(payload);
  if (!Number.isFinite(rate) || rate < 0 || rate > max) {
    return `Not sent: battery rate must be between 0 and ${max} W.`;
  }
  return null;
}

export function confirmationMessage(command: string, payload: string): string | undefined {
  if (commandMeta[command]?.confirmation === "unavailable" ||
      (commandMeta[command]?.confirmation === "duration" && payload !== "Cancel")) {
    return "Sent; requested value cannot be reliably verified from telemetry.";
  }
}

export function commandMatchesTelemetry(
  notification: CommandNotification,
  category: "Control" | "Timeslots",
  key: string,
  value: string,
  max: InverterInfo["Invertor_Max_Bat_Rate"],
): boolean {
  if (notification.status !== "pending" || !notification.watchKeys.includes(key)) return false;
  const meta = commandMeta[notification.command];
  if (!meta || confirmationMessage(notification.command, notification.payload)) return false;

  const kind = meta.confirmation ?? "text";
  if (category === "Timeslots" && kind !== "time" && !key.includes("_Target_SOC_")) return false;
  const expected = notification.command === "disableChargeTarget"
    ? "disable"
    : notification.command === "enableChargeTarget"
      ? "enable"
      : notification.payload;

  if (kind === "duration") return value === "Normal" && expected === "Cancel";
  if (kind === "time") {
    const time = /^([01]\d|2[0-3]):[0-5]\d(?::00)?$/;
    return time.test(value) && time.test(expected) && value.slice(0, 5) === expected.slice(0, 5);
  }
  if (kind === "number") {
    if (rateCommandError(notification.command, expected, max)) return false;
    return expected.trim() !== "" && value.trim() !== "" &&
      Number.isFinite(Number(expected)) && Number.isFinite(Number(value)) &&
      Number(value) === Number(expected);
  }
  return value === expected;
}
