<!-- markdownlint-disable-file -->
# Planning Log: Octopus Intelligent Go API Integration

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: WebSocket/subscription support for real-time dispatch change notifications
  * Source: .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 39-41)
  * Reason: Polling approach selected for initial implementation; matches existing MQTT real-time pattern separation. WebSocket subscriptions add complexity and the GraphQL subscription support is not confirmed.
  * Impact: low — polling every 5 minutes is sufficient for dispatch window tracking; dispatches are typically set hours in advance.

* DR-02: SmartFlexInverter type for GivEnergy inverter integration with Octopus SmartFlex
  * Source: .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 42-44)
  * Reason: Out of scope for EV charging integration. This would be a separate feature allowing the battery inverter to participate in SmartFlex demand response.
  * Impact: medium — potential future feature but requires registration workflow and Octopus partnership enrollment.

* DR-03: rateLimitInfo query for adaptive polling
  * Source: .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 45-47)
  * Reason: Fixed polling intervals are sufficient for initial implementation. Current polling (dispatches at 5m + tariff at 1h + device at 30m) generates ~300 queries/hour, well under the 50,000 hourly point limit.
  * Impact: low — could optimize API usage later but not a blocking concern.

* DR-04: updateBoostCharge, updateDeviceSmartControl, setDevicePreferences mutations (write operations)
  * Source: .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 16-17, Lines 255-258)
  * Reason: Scope explicitly limited to read-only monitoring for initial integration (per research scope definition).
  * Impact: medium — users may want to trigger bump charges or update charging preferences from the dashboard in the future.

### Plan Deviations from Research

* DD-01: Device ID auto-discovered per request rather than env var OCTOPUS_DEVICE_ID
  * Research recommends: Auto-discovered via devices GraphQL query at startup (config example shows `OCTOPUS_DEVICE_ID` as auto-discovered)
  * Plan implements: Device ID discovered and cached by the account API route, passed to dispatch route as parameter
  * Rationale: Eliminates a configuration step; the devices query is lightweight and results are cached. Client-side OctopusContext calls account route first, then uses returned deviceId for dispatch queries.

* DD-02: Manual useEffect+setInterval polling instead of SWR/React Query library
  * Research recommends: Consider SWR/React Query as Alternative B (deferred)
  * Plan implements: Manual polling with useEffect and setInterval in OctopusContext
  * Rationale: Matches existing BatteryContext pattern with MQTT. No data-fetching libraries in current codebase. Consistency with established patterns takes priority over library features.

## Implementation Paths Considered

### Selected: Next.js API Routes with Client-Side Polling

* Approach: Server-side API routes at src/app/api/octopus/ call Octopus REST and GraphQL APIs. Client-side OctopusContext polls internal routes at fixed intervals. JWT token cached server-side with auto-refresh.
* Rationale: Secure API key handling (server-only), matches existing App Router architecture, zero new dependencies, clear separation between server and client concerns.
* Evidence: .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md (Lines 290-330) - Scenario 1 analysis

### IP-01: Direct Client-Side API Calls

* Approach: Call Octopus API directly from the browser using the API key with NEXT_PUBLIC_ prefix.
* Trade-offs: Simpler implementation (no API routes), but exposes API key in client bundle — security vulnerability (OWASP A01:2021).
* Rejection rationale: API key grants full account access including consumption data and personal info. Unacceptable security risk even for a single-user app.

### IP-02: SWR/React Query with API Routes

* Approach: Same API routes, but use SWR or React Query library for client-side data fetching instead of manual polling.
* Trade-offs: Better cache management, automatic revalidation, request deduplication. Adds a dependency (~15KB SWR or ~40KB React Query).
* Rejection rationale: No data-fetching libraries in current codebase. Manual polling matches established BatteryContext pattern. Benefit doesn't justify the dependency for 3 polling endpoints.

### IP-03: React Server Components with Streaming

* Approach: Use RSC to fetch Octopus data at render time with incremental static regeneration.
* Trade-offs: Zero client-side JavaScript for data fetching. But requires full page reloads or complex ISR setup for frequently changing dispatch data.
* Rejection rationale: Dispatch data changes every ~5 minutes during charging. RSC pattern doesn't suit real-time monitoring. Existing app uses client-side state for MQTT data.

### IP-04: GraphQL Client Library (Apollo/urql)

* Approach: Use Apollo Client or urql for the GraphQL API interactions.
* Trade-offs: Better GraphQL DX with typed queries, caching, and subscriptions. Adds ~30-50KB dependency.
* Rejection rationale: Over-engineered for ~3 queries. Native fetch with JSON-stringified queries is sufficient. HomeAssistant integration also uses raw HTTP requests.

## Suggested Follow-On Work

Items identified during planning that fall outside current scope.

* WI-01: Bump charge control — Add "Boost Charge" button using `updateBoostCharge` mutation (medium priority)
  * Source: Research DR-04 — mutations are documented and available
  * Dependency: Current read-only integration must be stable first

* WI-02: Smart charging control — Add suspend/resume smart charging via `updateDeviceSmartControl` mutation (medium priority)
  * Source: Research DR-04
  * Dependency: WI-01 or independent; requires confirmation modal for safety

* WI-03: Battery + EV dispatch coordination — Coordinate GivEnergy battery charge slots with Octopus dispatch windows to optimize energy costs (high priority)
  * Source: Research Phase 3 guidance — "Consider coordinating battery charge slots with dispatch windows"
  * Dependency: Current integration stable; requires research into optimal battery scheduling during off-peak

* WI-04: Adaptive polling with rateLimitInfo — Query rate limit budget and dynamically adjust polling frequency (low priority)
  * Source: Research DR-03
  * Dependency: None; can be added incrementally

* WI-05: SmartFlex inverter registration — Investigate registering GivEnergy battery as SmartFlex device for grid demand response (low priority)
  * Source: Research DR-02
  * Dependency: Requires research into Octopus SmartFlex enrollment process

* WI-06: WebSocket dispatch notifications — Replace polling with subscription-based push updates for dispatch changes (low priority)
  * Source: Research DR-01
  * Dependency: Confirm Octopus GraphQL subscription support; research WebSocket integration with Next.js
