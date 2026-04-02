<!-- markdownlint-disable-file -->
# Task Research: Octopus Intelligent Go API Integration

Research into integrating the Octopus Energy Intelligent Go API into the battery_client Next.js application, with focus on smart tariff details and EV charging window queries for an Audi Q4 e-tron.

## Task Implementation Requests

* Integrate the Octopus Intelligent Go API to retrieve Smart Tariff details
* Query EV charging dispatch windows for an Audi Q4 e-tron
* Use an API key for authentication against the Octopus Energy API
* Display tariff rates and planned charging windows in the dashboard

## Scope and Success Criteria

* Scope: Server-side API integration (Next.js API routes) calling Octopus Energy REST and GraphQL APIs, with client-side display components. Excludes: EV control mutations (bump charge, smart charge on/off) — read-only monitoring only for initial integration.
* Assumptions:
  * User has an active Octopus Energy account with Intelligent Go tariff
  * User has an API key from the Octopus Energy dashboard
  * Audi Q4 e-tron is already enrolled in Intelligent Octopus Go (via Smartcar or Enode provider)
  * The application runs alongside the existing GivTCP MQTT integration
* Success Criteria:
  * Application authenticates with Octopus Energy API using an API key
  * Smart tariff rates (off-peak EV rate, peak rate, standing charge) are fetched and displayed
  * Planned charging dispatch windows are queried and displayed
  * Completed dispatch history is available
  * Device status (Audi Q4) is visible in the dashboard
  * API key is stored securely (server-side environment variable, never exposed to client)

## Outline

1. Current Application Architecture
2. Octopus Energy API Surface (REST + GraphQL)
3. Authentication Flow
4. Data to Fetch and Display
5. Technical Integration Scenarios
6. Selected Approach
7. Implementation Details

## Potential Next Research

* Investigate WebSocket/subscription support for real-time dispatch change notifications
  * Reasoning: Currently dispatch data must be polled; push updates would reduce API calls
  * Reference: .copilot-tracking/research/subagents/2026-04-01/octopus-graphql-deep-dive.md
* Research `SmartFlexInverter` type for potential GivEnergy inverter integration with Octopus SmartFlex
  * Reasoning: The battery inverter could potentially be registered as a SmartFlex device
  * Reference: Kraken tech announcement 676
* Explore `rateLimitInfo` query to implement adaptive polling
  * Reasoning: Could dynamically adjust polling frequency based on remaining rate limit budget
  * Reference: https://developer.octopus.energy/guides/graphql/api-basics/

## Research Executed

### File Analysis

* src/lib/config.ts (lines 1-4)
  * Currently only has `mqttUrl` and `inverterSerial` config (client-side). Octopus credentials (`OCTOPUS_API_KEY`, `OCTOPUS_ACCOUNT`, `ELEC_MPAN`, `ELEC_METER_SERIAL`, `GAS_MPAN`, `GAS_METER_SERIAL`) are already in `.env.local` as server-only variables. A new server-side config module will read these.

* src/lib/types.ts (lines 1-180)
  * Defines `EnergyRates` interface (lines 72-81) with `Current_Rate`, `Day_Rate`, `Night_Rate`, `Export_Rate` — these come from GivTCP MQTT. Octopus tariff data would complement/replace these.
  * `BatteryState` interface (lines 152-163) is the central state object. Octopus data would be a parallel state, not merged into this.

* src/lib/mqtt.ts (lines 1-85)
  * Shared MQTT client with React hook pattern. Octopus API is HTTP-based, so a separate data-fetching mechanism is needed.

* src/lib/topics.ts (lines 1-160)
  * GivTCP MQTT topics only. Octopus data uses HTTP APIs, not MQTT.

* src/context/BatteryContext.tsx (lines 1-260)
  * useReducer-based state management with MQTT subscription. A new context (or extension of this one) needed for Octopus data.

* src/app/page.tsx (lines 1-70)
  * Three-column dashboard layout. Octopus Intelligent Go data would fit in the center column (energy stats area) or as a new section.

* src/components/EnergyStats.tsx (lines 95-115)
  * Already displays rate info from GivTCP: Current Rate, Current Rate Type, Import avg. This is the natural place to show Octopus tariff rates alongside.

* package.json (lines 1-25)
  * Next.js 16.2.1, React 19.2.4, mqtt client, Tailwind CSS. No HTTP client library — will use native `fetch`. No GraphQL client — lightweight approach preferred.

* next.config.ts (lines 1-6)
  * Empty config. Next.js App Router supports API routes via `src/app/api/` directory.

### Code Search Results

* `EnergyRates` type
  * src/lib/types.ts lines 72-81 — existing rate fields from GivTCP
  * src/context/BatteryContext.tsx — consumed via `energy.Rates`
  * src/components/EnergyStats.tsx lines 95-115 — displayed in rate info bar

### External Research

* Octopus Energy Developer Docs: `https://developer.octopus.energy/`
  * REST API at `https://api.octopus.energy/v1/` — products, tariffs, consumption, accounts
  * GraphQL API at `https://api.octopus.energy/v1/graphql/` — intelligent dispatches, device control, authentication
    * Source: [Developer Portal](https://developer.octopus.energy/graphql/)

* Octopus Intelligent Go Product: `https://octopus.energy/smart/intelligent-octopus-go/`
  * 8p/kWh smart charging rate (from April 2026), 23:30-05:30 off-peak window, up to 6hrs additional smart dispatch
    * Source: [Intelligent Octopus Go](https://octopus.energy/smart/intelligent-octopus-go/)

* HomeAssistant-OctopusEnergy Integration: `https://github.com/BottlecapDave/HomeAssistant-OctopusEnergy`
  * Definitive source for GraphQL query patterns, field names, and device type handling
    * Source: [BottlecapDave/HomeAssistant-OctopusEnergy](https://github.com/BottlecapDave/HomeAssistant-OctopusEnergy)

### Project Conventions

* Standards referenced: Next.js App Router, React 19, TypeScript strict mode, Tailwind CSS
* Instructions followed: File-based routing, `use client` directive for client components, environment variables via `NEXT_PUBLIC_` prefix (client) or plain (server-only)

## Key Discoveries

### Project Structure

The battery_client is a Next.js 16 App Router application that monitors a GivEnergy battery inverter via MQTT (through GivTCP). It uses:
- React 19 with `useReducer` for state management
- MQTT over WebSocket for real-time data
- Tailwind CSS for styling
- Three-column dashboard layout: Battery/Power | Energy Stats | Controls/Schedule

There is NO existing Octopus or tariff API integration. The `EnergyRates` data currently comes from GivTCP publishing rate info to MQTT topics. The app has no API routes, no server-side data fetching, and no HTTP client dependencies.

### Implementation Patterns

The app follows a clear pattern:
1. **Data source** → MQTT topics (could be extended with HTTP API polling)
2. **State management** → React Context with useReducer
3. **Components** → Presentational components consuming context
4. **Controls** → MQTT publish for inverter commands

For Octopus integration, the pattern extends to:
1. **Data source** → Next.js API routes (server-side) calling Octopus REST + GraphQL APIs
2. **State management** → New React Context for Octopus data, or SWR/polling hook
3. **Components** → New tariff display and dispatch timeline components
4. **Security** → API key stays server-side only; client calls internal API routes

### Complete Examples

#### Authentication Flow (Server-Side)

```typescript
// src/app/api/octopus/token/route.ts
const OCTOPUS_GRAPHQL_URL = "https://api.octopus.energy/v1/graphql/";

interface TokenCache {
  token: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 5 min buffer)
  if (tokenCache && tokenCache.expiresAt > now + 300_000) {
    return tokenCache.token;
  }

  // Try refresh token if available and valid
  const input = tokenCache && tokenCache.refreshExpiresAt > now
    ? { refreshToken: tokenCache.refreshToken }
    : { APIKey: process.env.OCTOPUS_API_KEY! };

  const res = await fetch(OCTOPUS_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation { obtainKrakenToken(input: ${JSON.stringify(input)}) { token refreshToken refreshExpiresIn } }`,
    }),
  });

  const { data } = await res.json();
  const { token, refreshToken, refreshExpiresIn } = data.obtainKrakenToken;

  tokenCache = {
    token,
    refreshToken,
    expiresAt: now + 60 * 60 * 1000, // 60 min
    refreshExpiresAt: now + refreshExpiresIn * 1000,
  };

  return token;
}
```

#### Fetching Planned Dispatches

```typescript
async function getPlannedDispatches(token: string, deviceId: string) {
  const query = `
    query FlexPlannedDispatches($deviceId: String!) {
      flexPlannedDispatches(deviceId: $deviceId) {
        start
        end
        type
        energyAddedKwh
      }
    }
  `;

  const res = await fetch(OCTOPUS_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables: { deviceId } }),
  });

  const { data } = await res.json();
  return data.flexPlannedDispatches;
}
```

#### Fetching Tariff Rates (REST)

```typescript
async function getTariffRates(productCode: string, tariffCode: string) {
  const base = `https://api.octopus.energy/v1/products/${productCode}/electricity-tariffs/${tariffCode}`;

  const [evOffPeak, evPeak, standing] = await Promise.all([
    fetch(`${base}/ev-device-off-peak-unit-rates/`).then(r => r.json()),
    fetch(`${base}/ev-device-peak-unit-rates/`).then(r => r.json()),
    fetch(`${base}/standing-charges/`).then(r => r.json()),
  ]);

  return { evOffPeak: evOffPeak.results, evPeak: evPeak.results, standing: standing.results };
}
```

### API and Schema Documentation

**REST API** (`https://api.octopus.energy/v1/`)

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /v1/accounts/{account}/` | API key (Basic Auth) | Account details, MPAN, tariff agreements |
| `GET /v1/products/{product}/electricity-tariffs/{tariff}/ev-device-off-peak-unit-rates/` | None | EV off-peak rates (8p/kWh) |
| `GET /v1/products/{product}/electricity-tariffs/{tariff}/ev-device-peak-unit-rates/` | None | EV peak rates (~24.67p/kWh) |
| `GET /v1/products/{product}/electricity-tariffs/{tariff}/standing-charges/` | None | Daily standing charge |
| `GET /v1/electricity-meter-points/{mpan}/meters/{serial}/consumption/` | API key | Half-hourly consumption |

**GraphQL API** (`https://api.octopus.energy/v1/graphql/`)

| Operation | Auth | Purpose |
|---|---|---|
| `obtainKrakenToken` mutation | API key in body | Get JWT token (60 min) + refresh token (7 days) |
| `devices` query | JWT token | List SmartFlex devices (EV, charger) — returns make, model, status |
| `flexPlannedDispatches` query | JWT token | **Upcoming charging windows** — start, end, type, energyAddedKwh |
| `completedDispatches` query | JWT token | Historical dispatches — start, end, delta, meta |
| `updateBoostCharge` mutation | JWT token | Trigger/cancel bump charge |
| `updateDeviceSmartControl` mutation | JWT token | Suspend/resume smart charging |
| `setDevicePreferences` mutation | JWT token | Update charging schedule (target time, SoC) |

**Rate Limits:**

| Limit | Value |
|---|---|
| Query complexity | 200 per request |
| Hourly points (account user) | 50,000 |
| Max nodes per request | 10,000 |
| Pagination max `first` | 100 |

### Configuration Examples

```bash
# .env.local — existing environment variables (server-only, no NEXT_PUBLIC_ prefix)
OCTOPUS_ACCOUNT=A-34374EF8                  # Octopus Energy account number
OCTOPUS_API_KEY=sk_live_xxxxxxxxxxxx         # Octopus Energy API key
ELEC_MPAN=2000019115538                      # Electricity meter MPAN
ELEC_METER_SERIAL=22E5105164                 # Electricity meter serial
GAS_MPAN=3978518908                          # Gas meter MPRN
GAS_METER_SERIAL=E6S17431672261              # Gas meter serial
# OCTOPUS_DEVICE_ID is auto-discovered via the devices GraphQL query
```

## Technical Scenarios

### Scenario 1: Next.js API Routes with Client-Side Polling

Server-side API routes handle Octopus authentication and data fetching. Client polls these routes at intervals.

**Requirements:**

* Secure API key handling (server-only environment variables)
* JWT token caching with automatic refresh
* Periodic polling for dispatch updates (~5 min intervals)
* Tariff rates fetched less frequently (~1 hour)
* No additional npm dependencies required (native `fetch`)

**Preferred Approach:**

* Next.js App Router API routes at `src/app/api/octopus/` for server-side API calls
* New `OctopusContext` for client-side state management (mirrors `BatteryContext` pattern)
* `useEffect` + `setInterval` polling from client components
* Rationale: Matches existing architectural patterns, keeps API key secure, minimal dependencies

```text
src/
  app/
    api/
      octopus/
        dispatches/route.ts    — GET: planned + completed dispatches
        tariff/route.ts        — GET: current tariff rates
        device/route.ts        — GET: device status + info
        account/route.ts       — GET: account + tariff code discovery
  components/
    OctopusIntelligent.tsx     — Main Intelligent Go dashboard section
    DispatchTimeline.tsx       — Visual timeline of charging windows
    TariffRates.tsx            — Current tariff rate display
  context/
    OctopusContext.tsx          — State management for Octopus API data
  lib/
    octopus.ts                 — Octopus API client (server-side only)
    octopus-types.ts           — TypeScript types for Octopus API responses
    config.ts                  — Extended with Octopus config fields
```

```mermaid
flowchart TB
    subgraph Client["Client (Browser)"]
        OC[OctopusContext] -->|poll every 5m| DA[/api/octopus/dispatches]
        OC -->|poll every 1h| TA[/api/octopus/tariff]
        OC -->|on mount| DE[/api/octopus/device]
        DT[DispatchTimeline] --> OC
        TR[TariffRates] --> OC
        OI[OctopusIntelligent] --> DT
        OI --> TR
    end

    subgraph Server["Server (Next.js API Routes)"]
        DA --> OL[octopus.ts client]
        TA --> OL
        DE --> OL
        OL -->|GraphQL + JWT| GQL[Octopus GraphQL API]
        OL -->|REST + API Key| REST[Octopus REST API]
        OL -->|cached| TC[Token Cache]
    end
```

**Implementation Details:**

The server-side `octopus.ts` library manages:
1. **Token lifecycle** — Obtains JWT via `obtainKrakenToken`, caches with 55-min TTL, auto-refreshes
2. **GraphQL queries** — Dispatch windows via `flexPlannedDispatches`, device status via `devices`
3. **REST queries** — Tariff rates via `/products/{code}/electricity-tariffs/{tariff}/ev-device-off-peak-unit-rates/`

The API routes are thin wrappers that:
1. Call the `octopus.ts` client functions
2. Return JSON responses with appropriate Cache-Control headers
3. Handle errors gracefully (return error status to client)

Client-side `OctopusContext` mirrors the `BatteryContext` pattern:
1. Fetches data from internal API routes on mount and at intervals
2. Stores dispatches, tariff rates, device info in state
3. Provides data to child components via context

**Key data structures:**

```typescript
interface OctopusDispatch {
  start: string;         // ISO datetime
  end: string;           // ISO datetime
  type: "SMART" | "BOOST" | "TEST";
  energyAddedKwh: number;
}

interface OctopusTariffRates {
  evOffPeakRate: number;   // p/kWh inc VAT
  evPeakRate: number;      // p/kWh inc VAT
  standingCharge: number;  // p/day inc VAT
  offPeakWindow: { start: string; end: string }; // "23:30" - "05:30"
}

interface OctopusDevice {
  id: string;
  make: string;           // "Audi"
  model: string;          // "Q4 e-tron"
  provider: string;       // "SMARTCAR" or "ENODE"
  status: string;         // e.g. "SMART_CONTROL_CAPABLE"
  chargingPreferences: {
    weekdayTargetTime: string;
    weekdayTargetSoc: number;
    weekendTargetTime: string;
    weekendTargetSoc: number;
  };
}

interface OctopusState {
  plannedDispatches: OctopusDispatch[];
  completedDispatches: CompletedDispatch[];
  tariff: OctopusTariffRates | null;
  device: OctopusDevice | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: string | null;
}
```

#### Considered Alternatives

**Alternative A: Direct client-side API calls (REJECTED)**

Call Octopus API directly from the browser using the API key.

* Rejected because: API key would be exposed in client-side JavaScript. The `NEXT_PUBLIC_` prefix would make it visible in the browser bundle. This is a security vulnerability (OWASP A01:2021 - Broken Access Control). The API key grants full account access including consumption data and account details.

**Alternative B: SWR/React Query for data fetching (DEFERRED)**

Use `swr` or `@tanstack/react-query` instead of manual polling.

* Deferred because: Adds a dependency. The manual `useEffect` + `setInterval` approach matches the existing codebase pattern (no data-fetching libraries currently used). Could be adopted later if polling complexity grows. The current MQTT-based approach doesn't use SWR either, so this maintains consistency.

**Alternative C: Server Components with streaming (REJECTED)**

Use React Server Components to fetch Octopus data at render time.

* Rejected because: Dispatch data changes frequently (every ~5 minutes as charging progresses). Server Components would require full page reloads or complex incremental static regeneration. The real-time nature of charging windows is better served by client-side polling, which matches the MQTT pattern already in use.

**Alternative D: GraphQL client library (Apollo/urql) (REJECTED)**

Use a full GraphQL client library for the Octopus GraphQL API.

* Rejected because: Over-engineered for ~3 queries. The API surface is small (dispatches, devices, token). Native `fetch` with JSON stringified queries is sufficient and adds zero dependencies. The HomeAssistant integration also uses raw HTTP requests rather than a GraphQL library.

## Implementation Guidance

### Phase 1: Server-Side Foundation (Recommended First Step)

1. Add environment variables to `.env.local` for Octopus credentials
2. Create `src/lib/octopus.ts` with token management and API client functions
3. Create `src/lib/octopus-types.ts` with TypeScript interfaces
4. Create `src/app/api/octopus/` API routes
5. Test API routes manually (curl or browser)

### Phase 2: Client-Side Integration

1. Create `src/context/OctopusContext.tsx` with polling logic
2. Wire into `src/app/layout.tsx` as a provider
3. Create display components (`TariffRates`, `DispatchTimeline`)
4. Add to `src/app/page.tsx` layout

### Phase 3: Polish and Monitoring

1. Add error handling and loading states
2. Implement adaptive polling (reduce frequency when no active dispatches)
3. Add completed dispatch history view
4. Consider coordinating battery charge slots with dispatch windows

### Environment Variables Summary

| Variable | Example | Scope | How to Obtain |
|---|---|---|---|
| `OCTOPUS_API_KEY` | `sk_live_xxxx` | Server-only | Octopus Energy dashboard > API Access |
| `OCTOPUS_ACCOUNT` | `A-34374EF8` | Server-only | Octopus Energy dashboard |
| `ELEC_MPAN` | `2000019115538` | Server-only | Electricity bill or Octopus dashboard |
| `ELEC_METER_SERIAL` | `22E5105164` | Server-only | Electricity bill or Octopus dashboard |
| `GAS_MPAN` | `3978518908` | Server-only | Gas bill or Octopus dashboard |
| `GAS_METER_SERIAL` | `E6S17431672261` | Server-only | Gas bill or Octopus dashboard |
| `OCTOPUS_DEVICE_ID` | (auto-discovered) | Server-only | Discovered via `devices` GraphQL query at startup |

The product code and tariff code can be auto-discovered from the account endpoint rather than hardcoded.

## Research References

* .copilot-tracking/research/subagents/2026-04-01/octopus-intelligent-go-api.md — REST API, GraphQL overview, rate structure, EV compatibility
* .copilot-tracking/research/subagents/2026-04-01/octopus-graphql-deep-dive.md — Exact query schemas, field types, mutations, rate limits, HomeAssistant patterns
