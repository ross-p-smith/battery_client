/** Planned charging dispatch from Octopus Intelligent Go */
export interface OctopusDispatch {
  start: string;
  end: string;
  delta: string;
  meta?: { location?: string };
}

/** Completed charging dispatch */
export interface CompletedDispatch {
  start: string;
  end: string;
  delta: string;
  meta?: { location?: string };
}

/** Tariff rates for Intelligent Go */
export interface OctopusTariffRates {
  evOffPeakRate: number;
  evPeakRate: number;
  standingCharge: number;
  offPeakWindow: { start: string; end: string };
}

/** SmartFlex device info */
export interface OctopusDevice {
  id: string;
  provider: "SMARTCAR" | "ENODE";
  make?: string;
  model?: string;
  status?: { current: string };
  chargingPreferences?: {
    weekdayTargetTime: string;
    weekdayTargetSoc: number;
    weekendTargetTime: string;
    weekendTargetSoc: number;
  };
}

/** Client-side state for Octopus data */
export interface OctopusState {
  plannedDispatches: OctopusDispatch[];
  completedDispatches: CompletedDispatch[];
  tariff: OctopusTariffRates | null;
  device: OctopusDevice | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: string | null;
}

/** Reducer actions for OctopusState */
export type OctopusAction =
  | {
      type: "SET_DISPATCHES";
      planned: OctopusDispatch[];
      completed: CompletedDispatch[];
    }
  | { type: "SET_TARIFF"; tariff: OctopusTariffRates }
  | { type: "SET_DEVICE"; device: OctopusDevice }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "REFRESH" };
