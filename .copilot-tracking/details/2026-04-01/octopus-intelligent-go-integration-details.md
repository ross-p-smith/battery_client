<!-- markdownlint-disable-file -->
# Implementation Details: Octopus Intelligent Go API Integration

## Context Reference

Sources: .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md, .copilot-tracking/research/subagents/2026-04-01/octopus-intelligent-go-api.md, .copilot-tracking/research/subagents/2026-04-01/octopus-graphql-deep-dive.md

## Implementation Phase 1: Server-Side Types and API Client

<!-- parallelizable: false -->

### Step 1.1: Create Octopus TypeScript type definitions

Create a new file `src/lib/octopus-types.ts` containing all TypeScript interfaces for Octopus API responses and client-side state. These types are shared between server (API routes) and client (OctopusContext).

Types to define:

* `OctopusDispatch` — Planned dispatch: `start` (ISO string), `end` (ISO string), `type` ("SMART" | "BOOST" | "TEST"), `energyAddedKwh` (number)
* `CompletedDispatch` — Completed dispatch: `start`, `end`, `delta` (string energy delta), `meta` (optional metadata object)
* `OctopusTariffRates` — Tariff rates: `evOffPeakRate` (p/kWh inc VAT), `evPeakRate` (p/kWh inc VAT), `standingCharge` (p/day inc VAT), `offPeakWindow` ({ start: string, end: string })
* `OctopusDevice` — Device info: `id`, `make`, `model`, `provider` ("SMARTCAR" | "ENODE"), `status`, `chargingPreferences` ({ weekdayTargetTime, weekdayTargetSoc, weekendTargetTime, weekendTargetSoc })
* `OctopusState` — Client state: `plannedDispatches`, `completedDispatches`, `tariff`, `device`, `isLoading`, `error`, `lastFetched`
* `OctopusAction` — Reducer action union type for state updates

Files:
* src/lib/octopus-types.ts - New file: all Octopus-related TypeScript interfaces

Discrepancy references:
* None — types match research data structures exactly

Success criteria:
* File compiles with `npx tsc --noEmit` and no errors
* All API response shapes from research are covered

Context references:
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 336-380) - Data structure definitions
* src/lib/types.ts (lines 72-81) - Existing EnergyRates pattern for reference

Dependencies:
* None

### Step 1.2: Create server-side Octopus API client library

Create `src/lib/octopus.ts` — a server-side-only module that handles all Octopus Energy API communication. This file must NOT be imported from client components (no `"use client"` directive, and should only be imported from `src/app/api/` routes).

Functions to implement:

1. **Token management** — `getToken(): Promise<string>`
   * Obtain JWT via `obtainKrakenToken` mutation using `OCTOPUS_API_KEY` env var
   * Cache token in module-level variable with 55-minute TTL (tokens expire at 60 min)
   * Use refresh token when available and valid (7-day expiry)
   * GraphQL endpoint: `https://api.octopus.energy/v1/graphql/`

2. **Account discovery** — `getAccountInfo(): Promise<AccountInfo>`
   * REST call to `https://api.octopus.energy/v1/accounts/{OCTOPUS_ACCOUNT}/`
   * Basic Auth with API key as username, empty password
   * Extract `product_code` and `tariff_code` from `properties[0].electricity_meter_points[0].agreements` (current agreement)
   * Cache result (account info rarely changes)

3. **Planned dispatches** — `getPlannedDispatches(deviceId: string): Promise<OctopusDispatch[]>`
   * GraphQL query `flexPlannedDispatches(deviceId: $deviceId)` with JWT auth
   * Returns array of `{ start, end, type, energyAddedKwh }`

4. **Completed dispatches** — `getCompletedDispatches(deviceId: string): Promise<CompletedDispatch[]>`
   * GraphQL query `completedDispatches(deviceId: $deviceId)` with JWT auth
   * Returns array of `{ start, end, delta, meta }`

5. **Device discovery** — `getDevices(): Promise<OctopusDevice[]>`
   * GraphQL query `devices` with JWT auth
   * Returns SmartFlex devices (EV, charger) with make, model, status, chargingPreferences

6. **Tariff rates** — `getTariffRates(productCode: string, tariffCode: string): Promise<OctopusTariffRates>`
   * REST calls to `/v1/products/{product}/electricity-tariffs/{tariff}/ev-device-off-peak-unit-rates/`, `/ev-device-peak-unit-rates/`, `/standing-charges/`
   * No auth required for tariff endpoints
   * Extract latest rate from `results[0].value_inc_vat`

7. **Helper** — `graphqlQuery(query: string, variables?: Record<string, unknown>): Promise<unknown>`
   * Shared fetch wrapper for GraphQL with token injection and error handling
   * Validates response for `errors` array and throws descriptive error

Security considerations:
* All environment variable access via `process.env` (server-only)
* Token cache is module-scoped (per-process, not shared across requests in edge runtime)
* Never return raw API key in responses or errors

Files:
* src/lib/octopus.ts - New file: server-side Octopus API client

Discrepancy references:
* DR-01: WebSocket subscriptions not implemented (polling approach selected instead)

Success criteria:
* File compiles with `npx tsc --noEmit` and no errors
* Functions match Octopus API surface documented in research
* Token caching logic prevents redundant auth calls

Context references:
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 150-225) - Authentication flow and query examples
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 227-265) - REST and GraphQL API surface table

Dependencies:
* Step 1.1 completion (imports types)
* `OCTOPUS_API_KEY` and `OCTOPUS_ACCOUNT` env vars set in `.env.local`

### Step 1.3: Validate phase changes

Run `npx tsc --noEmit` for type checking on new files. Skip lint validation as there are no components to render yet.

Validation commands:
* `npx tsc --noEmit` - TypeScript compilation check for src/lib/octopus.ts and src/lib/octopus-types.ts

## Implementation Phase 2: Next.js API Routes

<!-- parallelizable: false -->

### Step 2.1: Create account discovery API route

Create `src/app/api/octopus/account/route.ts` — a GET endpoint that returns the user's account info including auto-discovered product code, tariff code, and device ID.

Behavior:
* Call `getAccountInfo()` to get product/tariff codes from the account's current agreement
* Call `getDevices()` to discover the EV device ID
* Return combined JSON: `{ account, productCode, tariffCode, devices }`
* Cache account data aggressively (set `Cache-Control: private, max-age=3600`)
* Return 500 with `{ error: string }` on API failures (never expose API key or stack traces)

Files:
* src/app/api/octopus/account/route.ts - New file: GET route for account/device discovery

Discrepancy references:
* DD-01: Device ID is auto-discovered per request rather than cached as env var

Success criteria:
* `GET /api/octopus/account` returns JSON with account info and device list
* Response includes `productCode` and `tariffCode` from current agreement
* Error responses return 500 with safe error message

Context references:
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 227-245) - REST API table and account endpoint
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 282-300) - Configuration examples

Dependencies:
* Phase 1 completion (octopus.ts client and types)

### Step 2.2: Create dispatches API route

Create `src/app/api/octopus/dispatches/route.ts` — a GET endpoint that returns both planned and completed dispatch windows.

Behavior:
* Accept optional `deviceId` query parameter; if not provided, discover first device via `getDevices()`
* Call `getPlannedDispatches(deviceId)` and `getCompletedDispatches(deviceId)` in parallel with `Promise.all`
* Return JSON: `{ planned: OctopusDispatch[], completed: CompletedDispatch[], deviceId }`
* Set `Cache-Control: private, max-age=120` (dispatches change during charging)
* Return 500 with `{ error: string }` on failures

Files:
* src/app/api/octopus/dispatches/route.ts - New file: GET route for planned + completed dispatches

Discrepancy references:
* None

Success criteria:
* `GET /api/octopus/dispatches` returns planned and completed dispatch arrays
* Dispatches include start/end times, type, and energy metrics
* Works with auto-discovered device ID

Context references:
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 193-213) - Planned dispatches query example
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 245-260) - GraphQL API operations table

Dependencies:
* Phase 1 completion
* Octopus API credentials configured

### Step 2.3: Create tariff rates API route

Create `src/app/api/octopus/tariff/route.ts` — a GET endpoint that returns current tariff rates for the Intelligent Go product.

Behavior:
* Accept optional `productCode` and `tariffCode` query parameters; if not provided, discover via `getAccountInfo()`
* Call `getTariffRates(productCode, tariffCode)`
* Return JSON: `{ evOffPeakRate, evPeakRate, standingCharge, offPeakWindow }`
* Set `Cache-Control: private, max-age=3600` (rates change infrequently)
* Return 500 with `{ error: string }` on failures

Files:
* src/app/api/octopus/tariff/route.ts - New file: GET route for tariff rates

Discrepancy references:
* None

Success criteria:
* `GET /api/octopus/tariff` returns EV off-peak rate, peak rate, and standing charge
* Rates are returned in p/kWh including VAT
* Off-peak window times (23:30-05:30) are included

Context references:
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 215-230) - Tariff rates REST example
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 227-240) - REST API endpoints table

Dependencies:
* Phase 1 completion

### Step 2.4: Create device status API route

Create `src/app/api/octopus/device/route.ts` — a GET endpoint that returns the EV device status and charging preferences.

Behavior:
* Call `getDevices()` to get all SmartFlex devices
* Return the first device (or filter by `deviceId` query param if provided)
* Return JSON: `{ device: OctopusDevice }` with make, model, provider, status, chargingPreferences
* Set `Cache-Control: private, max-age=300`
* Return 500 with `{ error: string }` on failures; 404 if no device found

Files:
* src/app/api/octopus/device/route.ts - New file: GET route for device status

Discrepancy references:
* None

Success criteria:
* `GET /api/octopus/device` returns Audi Q4 e-tron device info
* Response includes charging preferences (target time, target SoC)
* 404 returned when no SmartFlex device found

Context references:
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 245-260) - GraphQL devices query
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 360-380) - OctopusDevice type shape

Dependencies:
* Phase 1 completion

### Step 2.5: Validate phase changes

Run TypeScript checking and manual API route testing.

Validation commands:
* `npx tsc --noEmit` - TypeScript compilation check for all API routes
* `curl http://localhost:3000/api/octopus/account` - Manual test (requires dev server and valid API key)

## Implementation Phase 3: Client-Side Context and Components

<!-- parallelizable: false -->

### Step 3.1: Create OctopusContext with polling logic

Create `src/context/OctopusContext.tsx` — a React Context that polls the internal API routes and provides Octopus data to child components. Follow the BatteryContext pattern (src/context/BatteryContext.tsx).

Structure:
* `OctopusProvider` component wrapping children with context
* `useOctopus()` hook for consuming components
* `useReducer` with `OctopusState` and `OctopusAction` types
* Polling intervals:
  * Dispatches: every 5 minutes (`300_000` ms)
  * Tariff rates: every 1 hour (`3_600_000` ms)
  * Device status: on mount only (then every 30 minutes)
* Error state management: set `error` on fetch failures, clear on next success
* Loading state: `isLoading` true during initial fetch, false after first successful response

Reducer actions:
* `SET_DISPATCHES` — Update planned and completed dispatches
* `SET_TARIFF` — Update tariff rates
* `SET_DEVICE` — Update device info
* `SET_ERROR` — Set error message
* `SET_LOADING` — Toggle loading state

Polling implementation:
* Use `useEffect` with `setInterval` for each polling interval
* Clean up intervals on unmount
* Initial fetch on mount via `useEffect` with empty deps
* Fetch dispatches, tariff, and device in parallel on mount

Files:
* src/context/OctopusContext.tsx - New file: Octopus data context with polling

Discrepancy references:
* DR-01: Uses polling instead of WebSocket subscriptions for dispatch updates
* DD-02: Manual polling rather than SWR/React Query (matches existing codebase pattern)

Success criteria:
* Context provides `plannedDispatches`, `completedDispatches`, `tariff`, `device`, `isLoading`, `error`
* Polling starts on mount and cleans up on unmount
* Error state is handled gracefully without crashing the app

Context references:
* src/context/BatteryContext.tsx (lines 1-100) - useReducer pattern, defaultState shape, Action union type
* src/context/BatteryContext.tsx (lines 220-260) - Provider component, context hook pattern

Dependencies:
* Phase 2 completion (API routes must exist for client to call)

### Step 3.2: Create TariffRates display component

Create `src/components/TariffRates.tsx` — a client component that displays Octopus Intelligent Go tariff rates.

Display elements:
* EV off-peak rate (e.g., "8.00p/kWh") with a green/emerald color accent
* EV peak rate (e.g., "24.67p/kWh") with a standard color
* Standing charge (e.g., "46.36p/day")
* Off-peak window times (e.g., "23:30 – 05:30")
* Visual distinction between off-peak and peak periods

Styling:
* Match existing component patterns — rounded-xl border, zinc-900 bg, zinc-800 inner cards
* Use the StatCard-like pattern from EnergyStats.tsx (lines 4-29)
* Use `tabular-nums` for numeric alignment
* Color coding: emerald for off-peak, zinc for peak

Files:
* src/components/TariffRates.tsx - New file: tariff rate display component

Discrepancy references:
* None

Success criteria:
* Displays off-peak rate, peak rate, and standing charge
* Shows off-peak window times
* Matches dashboard visual style (dark theme, zinc/emerald palette)

Context references:
* src/components/EnergyStats.tsx (lines 95-115) - Existing rate info bar pattern
* src/components/EnergyStats.tsx (lines 4-29) - StatCard pattern for consistent styling

Dependencies:
* Step 3.1 (OctopusContext must be available)

### Step 3.3: Create DispatchTimeline component

Create `src/components/DispatchTimeline.tsx` — a client component that displays planned and completed charging dispatch windows as a visual timeline.

Display elements:
* Section header "Charging Schedule" with device info subtitle (e.g., "Audi Q4 e-tron")
* Planned dispatches shown as colored time blocks:
  * SMART dispatches in emerald/green
  * BOOST dispatches in amber/yellow
* Each dispatch shows: start time, end time, duration, energy added (kWh)
* Completed dispatches shown in a collapsed section below with muted styling
* "No planned dispatches" message when array is empty
* Relative time labels (e.g., "in 2h 15m", "now", "45m ago")

Styling:
* Rounded-xl border container matching other dashboard cards
* Time blocks as horizontal bars or list items with visual time indicator
* Use `tabular-nums` for times and energy values
* Responsive: stack vertically on mobile

Files:
* src/components/DispatchTimeline.tsx - New file: charging dispatch timeline component

Discrepancy references:
* None

Success criteria:
* Planned dispatches are displayed with start/end/type/energy
* Visual distinction between SMART and BOOST dispatch types
* Empty state handled cleanly
* Completed dispatches available in a secondary section

Context references:
* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 336-355) - OctopusDispatch and CompletedDispatch types

Dependencies:
* Step 3.1 (OctopusContext must be available)

### Step 3.4: Create OctopusIntelligent container component

Create `src/components/OctopusIntelligent.tsx` — a container component that composes TariffRates and DispatchTimeline into a single dashboard section.

Structure:
* Wraps TariffRates and DispatchTimeline components
* Shows loading skeleton during initial data fetch
* Shows error banner when API calls fail (with retry button)
* Shows "Configure Octopus API" message when no API key is configured (check via a `/api/octopus/account` failure)

Files:
* src/components/OctopusIntelligent.tsx - New file: container component for Octopus Intelligent Go section

Discrepancy references:
* None

Success criteria:
* Renders both TariffRates and DispatchTimeline
* Loading and error states are handled
* Gracefully degrades when Octopus API is not configured

Context references:
* src/app/page.tsx (lines 14-26) - Similar config-check pattern for inverter serial

Dependencies:
* Steps 3.2 and 3.3 (child components must exist)

### Step 3.5: Validate phase changes

Run ESLint and TypeScript validation for all new client components.

Validation commands:
* `npm run lint` - ESLint across all source files
* `npx tsc --noEmit` - TypeScript compilation check

## Implementation Phase 4: Dashboard Integration

<!-- parallelizable: false -->

### Step 4.1: Add OctopusProvider to app layout

Modify `src/app/layout.tsx` to wrap the application with `OctopusProvider` alongside the existing `BatteryProvider`.

Changes:
* Import `OctopusProvider` from `@/context/OctopusContext`
* Nest `OctopusProvider` inside `BatteryProvider` (or outside — order doesn't matter as they are independent)

The layout body becomes:
```
<BatteryProvider>
  <OctopusProvider>
    {children}
  </OctopusProvider>
</BatteryProvider>
```

Files:
* src/app/layout.tsx - Modify: add OctopusProvider import and nesting (lines 33-36)

Discrepancy references:
* None

Success criteria:
* OctopusProvider wraps the app without breaking existing BatteryProvider functionality
* No hydration errors or client/server mismatch

Context references:
* src/app/layout.tsx (lines 24-38) - Current BatteryProvider wrapping pattern

Dependencies:
* Step 3.1 (OctopusContext must exist)

### Step 4.2: Add OctopusIntelligent component to page layout

Modify `src/app/page.tsx` to include the OctopusIntelligent component in the center column, below the existing EnergyStats component.

Changes:
* Import `OctopusIntelligent` from `@/components/OctopusIntelligent`
* Add `<OctopusIntelligent />` after `<EnergyStats />` in the center column `<div>` (after line 67)

Files:
* src/app/page.tsx - Modify: add import and component to center column (lines 7, 67)

Discrepancy references:
* None

Success criteria:
* OctopusIntelligent renders below EnergyStats in the center column
* Layout remains responsive (3-column grid on large screens)
* Component renders without errors when Octopus API is not configured

Context references:
* src/app/page.tsx (lines 60-70) - Center column with EnergyStats

Dependencies:
* Step 3.4 (OctopusIntelligent component must exist)
* Step 4.1 (OctopusProvider must be in layout)

### Step 4.3: Validate phase changes

Run ESLint and TypeScript validation for all modified files.

Validation commands:
* `npm run lint` - ESLint across all modified source files
* `npx tsc --noEmit` - TypeScript compilation check

## Implementation Phase 5: Validation

<!-- parallelizable: false -->

### Step 5.1: Run full project validation

Execute all validation commands for the project:
* `npm run lint` - ESLint for all source files
* `npm run build` - Next.js production build (catches SSR/CSR issues)
* `npx tsc --noEmit` - TypeScript strict mode compilation

### Step 5.2: Fix minor validation issues

Iterate on lint errors, build warnings, and type errors. Apply fixes directly when corrections are straightforward and isolated.

### Step 5.3: Report blocking issues

When validation failures require changes beyond minor fixes:
* Document the issues and affected files.
* Provide the user with next steps.
* Recommend additional research and planning rather than inline fixes.
* Avoid large-scale refactoring within this phase.

## Dependencies

* Next.js 16.2.1 with App Router (existing)
* React 19.2.4 (existing)
* Octopus Energy API key and account number in `.env.local`
* Native `fetch` API (no additional packages)

## Success Criteria

* All 4 API routes return valid JSON responses
* OctopusContext polls and updates state at configured intervals
* TariffRates and DispatchTimeline render correctly in the dashboard
* `npm run build` succeeds with zero errors
* `npm run lint` passes with zero errors
* API key is never exposed to the client
