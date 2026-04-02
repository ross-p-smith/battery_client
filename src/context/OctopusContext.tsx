"use client";

import {
  createContext,
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

const defaultState: OctopusState = {
  plannedDispatches: [],
  completedDispatches: [],
  tariff: null,
  device: null,
  isLoading: true,
  error: null,
  lastFetched: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: OctopusState, action: OctopusAction): OctopusState {
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
      return { ...state, tariff: action.tariff, error: null };
    case "SET_DEVICE":
      return { ...state, device: action.device, error: null };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OctopusContext = createContext<OctopusState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function OctopusProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);

  // Fetch dispatches
  useEffect(() => {
    let active = true;

    async function fetchDispatches() {
      try {
        const res = await fetch("/api/octopus/dispatches");
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
  }, []);

  // Fetch tariff
  useEffect(() => {
    let active = true;

    async function fetchTariff() {
      try {
        const res = await fetch("/api/octopus/tariff");
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
  }, []);

  // Fetch device
  useEffect(() => {
    let active = true;

    async function fetchDevice() {
      try {
        const res = await fetch("/api/octopus/device");
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
  }, []);

  // Clear loading once first fetch cycle completes
  useEffect(() => {
    if (state.lastFetched || state.error) {
      dispatch({ type: "SET_LOADING", isLoading: false });
    }
  }, [state.lastFetched, state.error]);

  return (
    <OctopusContext.Provider value={state}>{children}</OctopusContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOctopus(): OctopusState {
  const ctx = useContext(OctopusContext);
  if (!ctx)
    throw new Error("useOctopus must be used within an OctopusProvider");
  return ctx;
}
