"use client";

import {
    createContext,
    useContext,
    useEffect,
    useReducer,
    useCallback,
    type ReactNode,
} from "react";
import { useMqtt } from "@/lib/mqtt";
import { dataTopics, controlTopics, parseTopicPath } from "@/lib/topics";
import type {
    BatteryState,
    PowerFlows,
    PowerReadings,
    EnergyToday,
    EnergyTotal,
    EnergyRates,
    ControlData,
    Timeslots,
    StatsData,
} from "@/lib/types";

const defaultPowerFlows: PowerFlows = {
    Battery_to_Grid: 0,
    Battery_to_House: 0,
    Grid_to_Battery: 0,
    Grid_to_House: 0,
    Solar_to_Battery: 0,
    Solar_to_Grid: 0,
    Solar_to_House: 0,
};

const defaultPowerReadings: PowerReadings = {
    AC_Charge_Power: 0,
    Battery_Power: 0,
    Battery_Voltage: 0,
    Charge_Power: 0,
    Charge_Time_Remaining: 0,
    Discharge_Power: 0,
    Discharge_Time_Remaining: 0,
    EPS_Power: 0,
    Export_Power: 0,
    Grid_Current: 0,
    Grid_Frequency: 0,
    Grid_Power: 0,
    Grid_Voltage: 0,
    Import_Power: 0,
    Invertor_Power: 0,
    Load_Power: 0,
    PV_Power: 0,
    PV_Power_String_1: 0,
    PV_Power_String_2: 0,
    SOC: 0,
    SOC_kWh: 0,
    Self_Consumption_Power: 0,
};

const defaultState: BatteryState = {
    power: { Flows: defaultPowerFlows, Power: defaultPowerReadings },
    energy: {
        Today: {} as EnergyToday,
        Total: {} as EnergyTotal,
        Rates: {} as EnergyRates,
    },
    control: {} as ControlData,
    battery: {},
    timeslots: {} as Timeslots,
    inverter: {
        Battery_Capacity_kWh: 0,
        Battery_Type: "",
        Export_Limit: 0,
        Invertor_Firmware: "",
        Invertor_Max_Bat_Rate: 0,
        Invertor_Max_Inv_Rate: 0,
        Invertor_Serial_Number: "",
        Invertor_Temperature: 0,
        Invertor_Type: "",
    },
    stats: {
        GivTCP_Version: "",
        Last_Updated_Time: "",
        Time_Since_Last_Update: 0,
        status: "offline",
    },
    isConnected: false,
    lastUpdate: null,
};

type Action =
    | { type: "SET_CONNECTED"; connected: boolean }
    | { type: "MQTT_MESSAGE"; path: string[]; value: string };

function tryParseValue(raw: string): string | number | boolean {
    if (raw === "true") return true;
    if (raw === "false") return false;
    const num = Number(raw);
    if (!isNaN(num) && raw.trim() !== "") return num;
    return raw;
}

function reducer(state: BatteryState, action: Action): BatteryState {
    switch (action.type) {
        case "SET_CONNECTED":
            return { ...state, isConnected: action.connected };

        case "MQTT_MESSAGE": {
            const { path, value } = action;
            const parsed = tryParseValue(value);
            const now = new Date().toISOString();

            // Route based on first path segment
            const category = path[0];

            switch (category) {
                case "Power": {
                    const sub = path[1]; // "Power" or "Flows"
                    const key = path[2];
                    if (sub === "Flows" && key) {
                        return {
                            ...state,
                            lastUpdate: now,
                            power: {
                                ...state.power,
                                Flows: { ...state.power.Flows, [key]: parsed as number },
                            },
                        };
                    }
                    if (sub === "Power" && key) {
                        return {
                            ...state,
                            lastUpdate: now,
                            power: {
                                ...state.power,
                                Power: { ...state.power.Power, [key]: parsed },
                            },
                        };
                    }
                    return state;
                }

                case "Energy": {
                    const sub = path[1]; // "Today", "Total", or "Rates"
                    const key = path[2];
                    if (!key) return state;
                    if (sub === "Today") {
                        return {
                            ...state,
                            lastUpdate: now,
                            energy: {
                                ...state.energy,
                                Today: { ...state.energy.Today, [key]: parsed },
                            },
                        };
                    }
                    if (sub === "Total") {
                        return {
                            ...state,
                            lastUpdate: now,
                            energy: {
                                ...state.energy,
                                Total: { ...state.energy.Total, [key]: parsed },
                            },
                        };
                    }
                    if (sub === "Rates") {
                        return {
                            ...state,
                            lastUpdate: now,
                            energy: {
                                ...state.energy,
                                Rates: { ...state.energy.Rates, [key]: parsed },
                            },
                        };
                    }
                    return state;
                }

                case "Control": {
                    const key = path[1];
                    if (!key) return state;
                    return {
                        ...state,
                        lastUpdate: now,
                        control: { ...state.control, [key]: parsed },
                    };
                }

                case "Battery_Details": {
                    // Battery_Details/Battery_Stack_1/<serial>/key
                    return {
                        ...state,
                        lastUpdate: now,
                        battery: deepSet(state.battery, path.slice(1), parsed),
                    };
                }

                case "Timeslots": {
                    const key = path[1];
                    if (!key) return state;
                    return {
                        ...state,
                        lastUpdate: now,
                        timeslots: { ...state.timeslots, [key]: value },
                    };
                }

                case "Stats": {
                    const key = path[1];
                    if (!key) return state;
                    return {
                        ...state,
                        lastUpdate: now,
                        stats: { ...state.stats, [key]: parsed } as StatsData,
                    };
                }

                default:
                    return state;
            }
        }

        default:
            return state;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepSet(obj: any, path: string[], value: unknown): any {
    if (path.length === 0) return value;
    if (path.length === 1) {
        return { ...obj, [path[0]]: value };
    }
    const [head, ...rest] = path;
    return {
        ...obj,
        [head]: deepSet(obj?.[head] ?? {}, rest, value),
    };
}

interface BatteryContextValue extends BatteryState {
    publishControl: (command: string, payload: string) => void;
}

const BatteryContext = createContext<BatteryContextValue | null>(null);

export function BatteryProvider({ children }: { children: ReactNode }) {
    const { status, subscribe, publish } = useMqtt();
    const [state, dispatch] = useReducer(reducer, defaultState);

    useEffect(() => {
        dispatch({ type: "SET_CONNECTED", connected: status === "connected" });
    }, [status]);

    useEffect(() => {
        if (status !== "connected") return;

        const topics = dataTopics();
        const unsub = subscribe(topics.all, (topic, message) => {
            const path = parseTopicPath(topic);
            dispatch({ type: "MQTT_MESSAGE", path, value: message });
        });

        return unsub;
    }, [status, subscribe]);

    const publishControl = useCallback(
        (command: string, payload: string) => {
            const topics = controlTopics();
            const topic = topics[command as keyof typeof topics];
            if (topic) {
                publish(topic, payload);
            }
        },
        [publish],
    );

    return (
        <BatteryContext.Provider value={{ ...state, publishControl }}>
            {children}
        </BatteryContext.Provider>
    );
}

export function useBattery(): BatteryContextValue {
    const ctx = useContext(BatteryContext);
    if (!ctx) {
        throw new Error("useBattery must be used within a BatteryProvider");
    }
    return ctx;
}
