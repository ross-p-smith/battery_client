"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import type {
  OctopusState,
  OctopusAction,
  OctopusDispatch,
  CompletedDispatch,
  OctopusTariffRates,
  OctopusDevice,
} from "@/lib/octopus-types";

// ---------------------------------------------------------------------------
// Polling intervals (ms)
// ---------------------------------------------------------------------------

const DISPATCH_POLL_MS = 300_000; // 5 minutes
const TARIFF_POLL_MS = 3_600_000; // 1 hour
const DEVICE_POLL_MS = 1_800_000; // 30 minutes

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const defaultState: OctopusState & { _refreshKey: number } = {
  plannedDispatches: [],
  completedDispatches: [],
  tariff: null,
  device: null,
  isLoading: true,
  error: null,
  lastFetched: null,
  _refreshKey: 0,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(
  state: typeof defaultState,
  action: OctopusAction,
): typeof defaultState {
  switch (action.type) {
    case "SET_DISPATCHES":
      return {
        ...state,
        plannedDispatches: action.planned,
        completedDispatches: action.completed,
        error: null,
        lastFetched: new Date().toISOString(),
      };
    case "SET_TARIFF":
      return {
        ...state,
        tariff: action.tariff,
        error: null,
        lastFetched: new Date().toISOString(),
      };
    case "SET_DEVICE":
      return {
        ...state,
        device: action.device,
        error: null,
        lastFetched: new Date().toISOString(),
      };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };
    case "REFRESH":
      return { ...state, isLoading: true, _refreshKey: state._refreshKey + 1 };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface OctopusContextValue extends OctopusState {
  refresh: () => void;
}

const OctopusContext = createContext<OctopusContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function OctopusProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const { _refreshKey } = state;
  const bustCache = _refreshKey > 0;

  const refresh = useCallback(() => dispatch({ type: "REFRESH" }), []);

  // Fetch dispatches
  useEffect(() => {
    let active = true;

    async function fetchDispatches() {
      try {
        const res = await fetch(
          "/api/octopus/dispatches",
          bustCache ? { cache: "no-store" } : undefined,
        );
        if (!res.ok) throw new Error("Failed to fetch dispatches");
        const data = (await res.json()) as {
          planned: OctopusDispatch[];
          completed: CompletedDispatch[];
        };
        if (active) {
          dispatch({
            type: "SET_DISPATCHES",
            planned: data.planned,
            completed: data.completed,
          });
        }
      } catch (err) {
        if (active) {
          dispatch({
            type: "SET_ERROR",
            error: err instanceof Error ? err.message : "Dispatch fetch error",
          });
        }
      }
    }

    fetchDispatches();
    const id = setInterval(fetchDispatches, DISPATCH_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [_refreshKey, bustCache]);

  // Fetch tariff
  useEffect(() => {
    let active = true;

    async function fetchTariff() {
      try {
        const res = await fetch(
          "/api/octopus/tariff",
          bustCache ? { cache: "no-store" } : undefined,
        );
        if (!res.ok) throw new Error("Failed to fetch tariff");
        const data = (await res.json()) as OctopusTariffRates;
        if (active) dispatch({ type: "SET_TARIFF", tariff: data });
      } catch (err) {
        if (active) {
          dispatch({
            type: "SET_ERROR",
            error: err instanceof Error ? err.message : "Tariff fetch error",
          });
        }
      }
    }

    fetchTariff();
    const id = setInterval(fetchTariff, TARIFF_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [_refreshKey, bustCache]);

  // Fetch device
  useEffect(() => {
    let active = true;

    async function fetchDevice() {
      try {
        const res = await fetch(
          "/api/octopus/device",
          bustCache ? { cache: "no-store" } : undefined,
        );
        if (!res.ok) throw new Error("Failed to fetch device");
        const data = (await res.json()) as { device: OctopusDevice };
        if (active) dispatch({ type: "SET_DEVICE", device: data.device });
      } catch (err) {
        if (active) {
          dispatch({
            type: "SET_ERROR",
            error: err instanceof Error ? err.message : "Device fetch error",
          });
        }
      }
    }

    fetchDevice();
    const id = setInterval(fetchDevice, DEVICE_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [_refreshKey, bustCache]);

  // Clear loading once first fetch cycle completes
  useEffect(() => {
    if (state.lastFetched || state.error) {
      dispatch({ type: "SET_LOADING", isLoading: false });
    }
  }, [state.lastFetched, state.error]);

  return (
    <OctopusContext.Provider value={{ ...state, refresh }}>
      {children}
    </OctopusContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOctopus(): OctopusContextValue {
  const ctx = useContext(OctopusContext);
  if (!ctx)
    throw new Error("useOctopus must be used within an OctopusProvider");
  return ctx;
}
