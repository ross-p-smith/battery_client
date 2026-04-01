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
    setChargeStart1: `${root}/setChargeStart1`,
    setChargeEnd1: `${root}/setChargeEnd1`,
    setChargeStart2: `${root}/setChargeStart2`,
    setChargeEnd2: `${root}/setChargeEnd2`,
    setChargeStart3: `${root}/setChargeStart3`,
    setChargeEnd3: `${root}/setChargeEnd3`,
    setDischargeStart1: `${root}/setDischargeStart1`,
    setDischargeEnd1: `${root}/setDischargeEnd1`,
    setDischargeStart2: `${root}/setDischargeStart2`,
    setDischargeEnd2: `${root}/setDischargeEnd2`,
    setDischargeStart3: `${root}/setDischargeStart3`,
    setDischargeEnd3: `${root}/setDischargeEnd3`,
    setChargeTarget1: `${root}/setChargeTarget1`,
    setChargeTarget2: `${root}/setChargeTarget2`,
    setChargeTarget3: `${root}/setChargeTarget3`,
    setDischargeTarget1: `${root}/setDischargeTarget1`,
    setDischargeTarget2: `${root}/setDischargeTarget2`,
    setDischargeTarget3: `${root}/setDischargeTarget3`,
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
  setChargeStart1: {
    label: "Charge Slot 1 Start",
    watchKeys: ["Charge_start_time_slot_1"],
  },
  setChargeEnd1: {
    label: "Charge Slot 1 End",
    watchKeys: ["Charge_end_time_slot_1"],
  },
  setChargeStart2: {
    label: "Charge Slot 2 Start",
    watchKeys: ["Charge_start_time_slot_2"],
  },
  setChargeEnd2: {
    label: "Charge Slot 2 End",
    watchKeys: ["Charge_end_time_slot_2"],
  },
  setChargeStart3: {
    label: "Charge Slot 3 Start",
    watchKeys: ["Charge_start_time_slot_3"],
  },
  setChargeEnd3: {
    label: "Charge Slot 3 End",
    watchKeys: ["Charge_end_time_slot_3"],
  },
  setDischargeStart1: {
    label: "Discharge Slot 1 Start",
    watchKeys: ["Discharge_start_time_slot_1"],
  },
  setDischargeEnd1: {
    label: "Discharge Slot 1 End",
    watchKeys: ["Discharge_end_time_slot_1"],
  },
  setDischargeStart2: {
    label: "Discharge Slot 2 Start",
    watchKeys: ["Discharge_start_time_slot_2"],
  },
  setDischargeEnd2: {
    label: "Discharge Slot 2 End",
    watchKeys: ["Discharge_end_time_slot_2"],
  },
  setDischargeStart3: {
    label: "Discharge Slot 3 Start",
    watchKeys: ["Discharge_start_time_slot_3"],
  },
  setDischargeEnd3: {
    label: "Discharge Slot 3 End",
    watchKeys: ["Discharge_end_time_slot_3"],
  },
  setChargeTarget1: {
    label: "Charge Target 1",
    watchKeys: ["Charge_Target_SOC_1"],
  },
  setChargeTarget2: {
    label: "Charge Target 2",
    watchKeys: ["Charge_Target_SOC_2"],
  },
  setChargeTarget3: {
    label: "Charge Target 3",
    watchKeys: ["Charge_Target_SOC_3"],
  },
  setDischargeTarget1: {
    label: "Discharge Target 1",
    watchKeys: ["Discharge_Target_SOC_1"],
  },
  setDischargeTarget2: {
    label: "Discharge Target 2",
    watchKeys: ["Discharge_Target_SOC_2"],
  },
  setDischargeTarget3: {
    label: "Discharge Target 3",
    watchKeys: ["Discharge_Target_SOC_3"],
  },
  enableDischarge: {
    label: "Enable Discharge",
    watchKeys: ["Enable_Discharge_Schedule"],
  },
};
