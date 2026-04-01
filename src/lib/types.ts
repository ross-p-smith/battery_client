/** Power flow directions between sources */
export interface PowerFlows {
    Battery_to_Grid: number;
    Battery_to_House: number;
    Grid_to_Battery: number;
    Grid_to_House: number;
    Solar_to_Battery: number;
    Solar_to_Grid: number;
    Solar_to_House: number;
}

/** Real-time power readings */
export interface PowerReadings {
    AC_Charge_Power: number;
    Battery_Power: number;
    Battery_Voltage: number;
    Charge_Power: number;
    Charge_Time_Remaining: number;
    Discharge_Power: number;
    Discharge_Time_Remaining: number;
    EPS_Power: number;
    Export_Power: number;
    Grid_Current: number;
    Grid_Frequency: number;
    Grid_Power: number;
    Grid_Voltage: number;
    Import_Power: number;
    Invertor_Power: number;
    Load_Power: number;
    PV_Power: number;
    PV_Power_String_1: number;
    PV_Power_String_2: number;
    SOC: number;
    SOC_kWh: number;
    Self_Consumption_Power: number;
}

export interface PowerData {
    Flows: PowerFlows;
    Power: PowerReadings;
}

/** Energy statistics for today */
export interface EnergyToday {
    AC_Charge_Energy_Today_kWh: number;
    Battery_Charge_Energy_Today_kWh: number;
    Battery_Discharge_Energy_Today_kWh: number;
    Battery_Throughput_Today_kWh: number;
    Export_Energy_Today_kWh: number;
    Import_Energy_Today_kWh: number;
    Invertor_Energy_Today_kWh: number;
    Load_Energy_Today_kWh: number;
    PV_Energy_Today_kWh: number;
    Self_Consumption_Energy_Today_kWh: number;
}

/** Cumulative energy totals */
export interface EnergyTotal {
    AC_Charge_Energy_Total_kWh: number;
    Battery_Charge_Energy_Total_kWh: number;
    Battery_Discharge_Energy_Total_kWh: number;
    Battery_Throughput_Total_kWh: number;
    Export_Energy_Total_kWh: number;
    Import_Energy_Total_kWh: number;
    Invertor_Energy_Total_kWh: number;
    Load_Energy_Total_kWh: number;
    PV_Energy_Total_kWh: number;
    Self_Consumption_Energy_Total_kWh: number;
}

export interface EnergyRates {
    Current_Rate: number;
    Current_Rate_Type: string;
    Day_Rate: number;
    Night_Rate: number;
    Export_Rate: number;
    Day_Cost: number;
    Night_Cost: number;
    Import_ppkwh_Today: number;
}

export interface EnergyData {
    Today: EnergyToday;
    Total: EnergyTotal;
    Rates: EnergyRates;
}

/** Battery control settings as reported by GivTCP */
export interface ControlData {
    Active_Power_Rate: number;
    Battery_Charge_Rate: number;
    Battery_Charge_Rate_AC: number;
    Battery_Discharge_Rate: number;
    Battery_Discharge_Rate_AC: number;
    Battery_Power_Cutoff: number;
    Battery_Power_Reserve: number;
    Battery_pause_mode: string;
    Eco_Mode: string;
    Enable_Charge_Schedule: string;
    Enable_Charge_Target: string;
    Enable_Discharge_Schedule: string;
    Force_Charge: string;
    Force_Charge_Num: number;
    Force_Export: string;
    Force_Export_Num: number;
    Mode: string;
    Target_SOC: number;
    Temp_Pause_Charge: string;
    Temp_Pause_Charge_Num: number;
    Temp_Pause_Discharge: string;
    Temp_Pause_Discharge_Num: number;
}

/** Battery cell/stack details */
export interface BatteryInfo {
    Battery_Capacity: number;
    Battery_Cells: number;
    Battery_Cycles: number;
    Battery_Design_Capacity: number;
    Battery_Remaining_Capacity: number;
    Battery_SOC: number;
    Battery_Serial_Number: string;
    Battery_Temperature: number;
    Battery_Voltage: number;
}

export interface BatteryStack {
    BMS_Temperature?: number;
    BMS_Voltage?: number;
    batteries: Record<string, BatteryInfo>;
}

export type BatteryDetails = Record<string, BatteryStack>;

/** Charge/discharge timeslot schedule */
export interface Timeslots {
    Battery_pause_start_time_slot: string;
    Battery_pause_end_time_slot: string;
    Charge_start_time_slot_1: string;
    Charge_end_time_slot_1: string;
    Discharge_start_time_slot_1: string;
    Discharge_end_time_slot_1: string;
    Discharge_start_time_slot_2: string;
    Discharge_end_time_slot_2: string;
    [key: string]: string;
}

/** Inverter metadata */
export interface InverterInfo {
    Battery_Capacity_kWh: number;
    Battery_Type: string;
    Export_Limit: number;
    Invertor_Firmware: string;
    Invertor_Max_Bat_Rate: number;
    Invertor_Max_Inv_Rate: number;
    Invertor_Serial_Number: string;
    Invertor_Temperature: number;
    Invertor_Type: string;
}

export interface StatsData {
    GivTCP_Version: string;
    Last_Updated_Time: string;
    Time_Since_Last_Update: number;
    status: string;
}

/** Complete battery state aggregated from all MQTT topics */
export interface BatteryState {
    power: PowerData;
    energy: EnergyData;
    control: ControlData;
    battery: BatteryDetails;
    timeslots: Timeslots;
    inverter: InverterInfo;
    stats: StatsData;
    isConnected: boolean;
    lastUpdate: string | null;
    notifications: CommandNotification[];
}

export type NotificationStatus = "pending" | "success" | "timeout" | "error";

export interface CommandNotification {
  id: string;
  command: string;
  label: string;
  status: NotificationStatus;
  timestamp: number;
  /** The control key(s) to watch for confirmation */
  watchKeys: string[];
}
