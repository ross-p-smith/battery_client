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
