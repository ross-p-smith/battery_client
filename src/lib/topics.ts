import { config } from "./config";

const serial = () => config.inverterSerial;

/** Data topics — GivTCP publishes individual values to leaf topics */
export const dataTopics = () => ({
  /** Subscribe to all data for this inverter */
  all: `GivEnergy/${serial()}/#`,
  power: `GivEnergy/${serial()}/Power/Power/#`,
  flows: `GivEnergy/${serial()}/Power/Flows/#`,
  energyToday: `GivEnergy/${serial()}/Energy/Today/#`,
  energyTotal: `GivEnergy/${serial()}/Energy/Total/#`,
  energyRates: `GivEnergy/${serial()}/Energy/Rates/#`,
  control: `GivEnergy/${serial()}/Control/#`,
  batteryDetails: `GivEnergy/${serial()}/Battery_Details/#`,
  timeslots: `GivEnergy/${serial()}/Timeslots/#`,
  inverter: `GivEnergy/${serial()}/${serial()}/#`,
  stats: `GivEnergy/${serial()}/Stats/#`,
});

/** Control topics — publish payloads to these to control the inverter */
export const controlTopics = () => {
  const root = `GivEnergy/control/${serial()}`;
  return {
    enableChargeTarget: `${root}/enableChargeTarget`,
    disableChargeTarget: `${root}/disableChargeTarget`,
    enableChargeSchedule: `${root}/enableChargeSchedule`,
    enableDischargeSchedule: `${root}/enableDischargeSchedule`,
    enableDischarge: `${root}/enableDischarge`,
    setChargeRate: `${root}/setChargeRate`,
    setDischargeRate: `${root}/setDischargeRate`,
    setChargeTarget: `${root}/setChargeTarget`,
    setBatteryReserve: `${root}/setBatteryReserve`,
    setChargeSlot1: `${root}/setChargeSlot1`,
    setChargeSlot2: `${root}/setChargeSlot2`,
    setChargeSlot3: `${root}/setChargeSlot3`,
    setDischargeSlot1: `${root}/setDischargeSlot1`,
    setDischargeSlot2: `${root}/setDischargeSlot2`,
    setDischargeSlot3: `${root}/setDischargeSlot3`,
    setBatteryMode: `${root}/setBatteryMode`,
    setBatteryPauseMode: `${root}/setBatteryPauseMode`,
    setPauseStart: `${root}/setPauseStart`,
    setPauseEnd: `${root}/setPauseEnd`,
    setEcoMode: `${root}/setEcoMode`,
    forceCharge: `${root}/forceCharge`,
    forceExport: `${root}/forceExport`,
    tempPauseCharge: `${root}/tempPauseCharge`,
    tempPauseDischarge: `${root}/tempPauseDischarge`,
  } as const;
};

/**
 * Parse a GivTCP MQTT topic to extract the data path.
 * e.g. "GivEnergy/SA2047G098/Power/Power/SOC" → ["Power", "Power", "SOC"]
 */
export function parseTopicPath(topic: string): string[] {
  const parts = topic.split("/");
  // Skip "GivEnergy" and serial number
  return parts.slice(2);
}

export interface CommandMeta {
  label: string;
  watchKeys: string[];
}

export const commandMeta: Record<string, CommandMeta> = {
  setBatteryMode: { label: "Battery Mode", watchKeys: ["Mode"] },
  setEcoMode: { label: "Eco Mode", watchKeys: ["Eco_Mode"] },
  setBatteryPauseMode: {
    label: "Pause Mode",
    watchKeys: ["Battery_pause_mode"],
  },
  setChargeRate: { label: "Charge Rate", watchKeys: ["Battery_Charge_Rate"] },
  setDischargeRate: {
    label: "Discharge Rate",
    watchKeys: ["Battery_Discharge_Rate"],
  },
  setBatteryReserve: {
    label: "Battery Reserve",
    watchKeys: ["Battery_Power_Reserve"],
  },
  setChargeTarget: { label: "Charge Target", watchKeys: ["Target_SOC"] },
  enableChargeSchedule: {
    label: "Charge Schedule",
    watchKeys: ["Enable_Charge_Schedule"],
  },
  enableDischargeSchedule: {
    label: "Discharge Schedule",
    watchKeys: ["Enable_Discharge_Schedule"],
  },
  enableChargeTarget: {
    label: "Charge Target",
    watchKeys: ["Enable_Charge_Target"],
  },
  disableChargeTarget: {
    label: "Charge Target",
    watchKeys: ["Enable_Charge_Target"],
  },
  forceCharge: { label: "Force Charge", watchKeys: ["Force_Charge"] },
  forceExport: { label: "Force Export", watchKeys: ["Force_Export"] },
  tempPauseCharge: {
    label: "Temp Pause Charge",
    watchKeys: ["Temp_Pause_Charge"],
  },
  tempPauseDischarge: {
    label: "Temp Pause Discharge",
    watchKeys: ["Temp_Pause_Discharge"],
  },
  setPauseStart: {
    label: "Pause Start",
    watchKeys: ["Battery_pause_start_time_slot"],
  },
  setPauseEnd: {
    label: "Pause End",
    watchKeys: ["Battery_pause_end_time_slot"],
  },
  setChargeSlot1: {
    label: "Charge Slot 1",
    watchKeys: ["Charge_start_time_slot_1", "Charge_end_time_slot_1"],
  },
  setChargeSlot2: {
    label: "Charge Slot 2",
    watchKeys: ["Charge_start_time_slot_2", "Charge_end_time_slot_2"],
  },
  setChargeSlot3: {
    label: "Charge Slot 3",
    watchKeys: ["Charge_start_time_slot_3", "Charge_end_time_slot_3"],
  },
  setDischargeSlot1: {
    label: "Discharge Slot 1",
    watchKeys: ["Discharge_start_time_slot_1", "Discharge_end_time_slot_1"],
  },
  setDischargeSlot2: {
    label: "Discharge Slot 2",
    watchKeys: ["Discharge_start_time_slot_2", "Discharge_end_time_slot_2"],
  },
  setDischargeSlot3: {
    label: "Discharge Slot 3",
    watchKeys: ["Discharge_start_time_slot_3", "Discharge_end_time_slot_3"],
  },
  enableDischarge: {
    label: "Enable Discharge",
    watchKeys: ["Enable_Discharge_Schedule"],
  },
};
