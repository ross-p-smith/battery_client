---
applyTo: '.copilot-tracking/changes/2026-04-01/octopus-intelligent-go-integration-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Octopus Intelligent Go API Integration

## Overview

Integrate the Octopus Energy Intelligent Go API into the battery_client Next.js dashboard to display smart tariff rates, EV charging dispatch windows, and device status for an Audi Q4 e-tron, using server-side API routes for secure credential handling and client-side polling for real-time updates.

## Objectives

### User Requirements

* Integrate the Octopus Intelligent Go API to retrieve Smart Tariff details — Source: user request
* Query EV charging dispatch windows for an Audi Q4 e-tron — Source: user request
* Use an API key for authentication against the Octopus Energy API — Source: user request
* Display tariff rates and planned charging windows in the dashboard — Source: user request

### Derived Objectives

* Implement server-side API routes to keep the API key secure (never exposed to client) — Derived from: OWASP A01:2021, API key grants full account access
* Auto-discover product code, tariff code, and device ID from the account endpoint rather than hardcoding — Derived from: reduces configuration burden, adapts to account changes
* Create a new OctopusContext following the existing BatteryContext useReducer pattern — Derived from: consistency with existing codebase architecture
* Implement JWT token caching with automatic refresh on the server — Derived from: minimize API calls, stay within rate limits (50,000 hourly points)
* Use native fetch with no additional dependencies — Derived from: matches codebase convention (no HTTP client or GraphQL library)

## Context Summary

### Project Files

* src/lib/config.ts (lines 1-4) - Client-side config with mqttUrl and inverterSerial; Octopus config will be a new server-side module
* src/lib/types.ts (lines 72-81) - EnergyRates interface from GivTCP; Octopus tariff data complements this
* src/lib/types.ts (lines 152-163) - BatteryState interface; Octopus data will be parallel state in a separate context
* src/context/BatteryContext.tsx (lines 1-260) - useReducer pattern with MQTT subscription; template for OctopusContext
* src/app/page.tsx (lines 1-80) - Three-column dashboard layout; Octopus section added to center column
* src/app/layout.tsx (lines 1-38) - BatteryProvider wrapper; OctopusProvider will nest alongside
* src/components/EnergyStats.tsx (lines 95-115) - Rate info bar from GivTCP; natural place for Octopus tariff display
* next.config.ts (lines 1-6) - Empty config; App Router supports API routes via src/app/api/
* package.json (lines 1-25) - Next.js 16.2.1, React 19.2.4, no HTTP/GraphQL client libraries

### References

* .copilot-tracking/research/2026-04-01/octopus-intelligent-go-integration-research.md - Primary research document
* .copilot-tracking/research/subagents/2026-04-01/octopus-intelligent-go-api.md - REST API, GraphQL overview, rate structure
* .copilot-tracking/research/subagents/2026-04-01/octopus-graphql-deep-dive.md - Exact query schemas, field types, HomeAssistant patterns

### Standards References

* package.json — No external notification libraries; zero new dependencies for this integration
* next.config.ts — Next.js App Router conventions for API routes at src/app/api/

## Implementation Checklist

### [ ] Implementation Phase 1: Server-Side Types and API Client

<!-- parallelizable: false -->

* [ ] Step 1.1: Create Octopus TypeScript type definitions
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 12-41)
* [ ] Step 1.2: Create server-side Octopus API client library
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 42-104)
* [ ] Step 1.3: Validate phase changes
  * Run `npx tsc --noEmit` for type checking on new files
  * Skip lint validation (no components to render yet)

### [ ] Implementation Phase 2: Next.js API Routes

<!-- parallelizable: false -->

* [ ] Step 2.1: Create account discovery API route
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 116-144)
* [ ] Step 2.2: Create dispatches API route
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 145-174)
* [ ] Step 2.3: Create tariff rates API route
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 175-203)
* [ ] Step 2.4: Create device status API route
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 204-232)
* [ ] Step 2.5: Validate phase changes
  * Run `npx tsc --noEmit` for type checking
  * Test API routes manually with `curl http://localhost:3000/api/octopus/account`

### [ ] Implementation Phase 3: Client-Side Context and Components

<!-- parallelizable: false -->

* [ ] Step 3.1: Create OctopusContext with polling logic
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 245-291)
* [ ] Step 3.2: Create TariffRates display component
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 292-326)
* [ ] Step 3.3: Create DispatchTimeline component
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 327-364)
* [ ] Step 3.4: Create OctopusIntelligent container component
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 365-391)
* [ ] Step 3.5: Validate phase changes
  * Run `npm run lint` for ESLint validation
  * Run `npx tsc --noEmit` for type checking

### [ ] Implementation Phase 4: Dashboard Integration

<!-- parallelizable: false -->

* [ ] Step 4.1: Add OctopusProvider to app layout
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 404-436)
* [ ] Step 4.2: Add OctopusIntelligent component to page layout
  * Details: .copilot-tracking/details/2026-04-01/octopus-intelligent-go-integration-details.md (Lines 437-462)
* [ ] Step 4.3: Validate phase changes
  * Run `npm run lint` for ESLint validation
  * Run `npx tsc --noEmit` for type checking

### [ ] Implementation Phase 5: Validation

<!-- parallelizable: false -->

* [ ] Step 5.1: Run full project validation
  * Execute `npm run lint` for ESLint
  * Execute `npm run build` for production build
  * Execute `npx tsc --noEmit` for type checking
* [ ] Step 5.2: Fix minor validation issues
  * Iterate on lint errors and build warnings
  * Apply fixes directly when corrections are straightforward
* [ ] Step 5.3: Report blocking issues
  * Document issues requiring additional research
  * Provide user with next steps and recommended planning
  * Avoid large-scale fixes within this phase

## Planning Log

See .copilot-tracking/plans/logs/2026-04-01/octopus-intelligent-go-integration-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Next.js 16.2.1 App Router (existing) — API routes via src/app/api/
* React 19.2.4 (existing) — Context, useReducer, useEffect for polling
* Native fetch API (no npm additions) — Both server-side and client-side
* Octopus Energy API key (`sk_live_*`) — Stored in `.env.local` as `OCTOPUS_API_KEY`
* Octopus Energy Account Number — Stored in `.env.local` as `OCTOPUS_ACCOUNT`

## Success Criteria

* Application authenticates with Octopus Energy API using an API key (server-side only) — Traces to: user requirement (API key auth)
* Smart tariff rates (off-peak EV rate, peak rate, standing charge) are fetched and displayed — Traces to: user requirement (tariff details)
* Planned charging dispatch windows are queried and displayed with visual timeline — Traces to: user requirement (charging windows)
* Completed dispatch history is available — Traces to: research finding (completedDispatches query available)
* Device status (Audi Q4 e-tron) is visible in the dashboard — Traces to: user requirement (EV charging windows)
* API key never appears in client-side bundles — Traces to: derived objective (OWASP security)
* `npm run build` succeeds with zero errors — Traces to: standard validation
* `npm run lint` passes with zero errors — Traces to: standard validation
