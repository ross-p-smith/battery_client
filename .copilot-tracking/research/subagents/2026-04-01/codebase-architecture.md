# Codebase Architecture Research — battery-client

## Research Topics

1. Project dependencies and framework
2. Application architecture (communication, state management, component structure)
3. Configuration and connection details
4. GivTCP config
5. Existing log files and format
6. next.config.ts proxy/rewrite configurations
7. Makefile build/run commands

---

## 1. Project Dependencies and Framework

**Source:** `package.json`

| Category   | Dependency                  | Version     |
| ---------- | --------------------------- | ----------- |
| Framework  | next                        | 16.2.1      |
| UI         | react / react-dom           | 19.2.4      |
| MQTT       | mqtt (mqtt.js)              | ^5.15.1     |
| CSS        | tailwindcss                 | ^4          |
| PostCSS    | @tailwindcss/postcss        | ^4          |
| TypeScript | typescript                  | ^5          |
| Linting    | eslint / eslint-config-next | ^9 / 16.2.1 |

**Key observations:**

- Zero REST/HTTP client libraries — no axios, fetch wrappers, or API route handlers.
- All GivTCP communication is MQTT-only via the `mqtt` npm package (mqtt.js v5).
- No charting or visualization libraries — power flows are rendered with custom Tailwind components.
- No state management library (Redux, Zustand, etc.) — uses React Context + `useReducer`.
- Fonts: Geist Sans and Geist Mono via `next/font/google`.

---

## 2. Application Architecture

### 2.1 Communication Pattern — MQTT Only

The app communicates with GivTCP exclusively via MQTT over WebSocket. There are **no REST API calls, no API routes, no server-side data fetching**.

**Connection flow:**

1. Browser connects to Mosquitto broker via WebSocket at `ws://localhost:9001`.
2. Subscribes to `GivEnergy/{serial}/#` (wildcard for all inverter data).
3. GivTCP publishes individual leaf-topic values every 30s (quick) / 120s (full).
4. The browser receives individual MQTT messages and routes them into React state via a reducer.

**Control flow (commands):**

1. UI publishes to `GivEnergy/control/{serial}/{command}` topics.
2. GivTCP subscribes to `GivEnergy/control/#`, processes commands, writes to inverter.
3. Confirmation is observed by watching for changes on the corresponding data topics (e.g., publishing `setChargeRate` → watch `Control/Battery_Charge_Rate`).
4. A 15-second timeout fires if no confirmation is received.

**MQTT Client (src/lib/mqtt.ts):**

- Singleton shared client pattern with reference counting.
- `useMqtt()` custom hook provides: `status`, `subscribe(topic, callback)`, `publish(topic, message)`.
- Client ID: `battery_client_{random_hex}`.
- Reconnect period: 5000ms, connect timeout: 10000ms.
- Clean session: true.

### 2.2 MQTT Topic Structure

**Data topics** (GivTCP publishes, app subscribes) — defined in `src/lib/topics.ts`:

- `GivEnergy/{serial}/Power/Power/{key}` — Real-time power readings (SOC, grid, PV, battery watts, etc.)
- `GivEnergy/{serial}/Power/Flows/{key}` — Power flow directions (Solar_to_House, Grid_to_Battery, etc.)
- `GivEnergy/{serial}/Energy/Today/{key}` — Daily energy totals (kWh)
- `GivEnergy/{serial}/Energy/Total/{key}` — Cumulative energy totals (kWh)
- `GivEnergy/{serial}/Energy/Rates/{key}` — Tariff rates
- `GivEnergy/{serial}/Control/{key}` — Battery control settings
- `GivEnergy/{serial}/Battery_Details/{stack}/{serial}/{key}` — Battery cell/stack info
- `GivEnergy/{serial}/Timeslots/{key}` — Charge/discharge time slot schedules
- `GivEnergy/{serial}/Stats/{key}` — GivTCP version, last update time, status

**Control topics** (app publishes, GivTCP subscribes):

- Root: `GivEnergy/control/{serial}/`
- 24 commands including: `setBatteryMode`, `setChargeRate`, `setDischargeRate`, `setBatteryReserve`, `setChargeTarget`, `enableChargeSchedule`, `enableDischargeSchedule`, `forceCharge`, `forceExport`, `tempPauseCharge`, `tempPauseDischarge`, `setChargeSlot1-3`, `setDischargeSlot1-3`, `setPauseStart`, `setPauseEnd`, `setEcoMode`, `setBatteryPauseMode`, `enableChargeTarget`, `disableChargeTarget`, `enableDischarge`.

**Command payloads** — JSON strings like `{"mode": "Eco"}`, `{"chargeRate": "2600"}`, `{"start": "0130", "finish": "0430", "chargeToPercent": "100"}`.

### 2.3 State Management — BatteryContext

**Source:** `src/context/BatteryContext.tsx`

- Uses React `useReducer` with a `BatteryState` type containing all inverter data.
- Provider wraps the entire app at `layout.tsx` level.
- `useBattery()` hook exposes full state + `publishControl()` and `dismissNotification()`.

**State shape (`BatteryState`):**

```
{
  power: { Flows: PowerFlows, Power: PowerReadings }
  energy: { Today: EnergyToday, Total: EnergyTotal, Rates: EnergyRates }
  control: ControlData
  battery: BatteryDetails (nested stack → serial → info)
  timeslots: Timeslots
  inverter: InverterInfo
  stats: StatsData
  isConnected: boolean
  lastUpdate: string | null
  notifications: CommandNotification[]
}
```

**Reducer actions:**

- `SET_CONNECTED` — MQTT connection status changes.
- `MQTT_MESSAGE` — Routes incoming messages by topic path to the correct state slice. Uses `parseTopicPath()` to strip `GivEnergy/{serial}` prefix and route on first segment (Power, Energy, Control, Battery_Details, Timeslots, Stats).
- `COMMAND_SENT` — Creates a pending notification with `watchKeys` for confirmation tracking.
- `COMMAND_TIMEOUT` — Marks pending notification as timed out after 15 seconds.
- `DISMISS_NOTIFICATION` — Auto-dismissed 5 seconds after status change, or manually dismissed.

**Value parsing:** `tryParseValue()` converts MQTT string payloads to appropriate JS types (boolean "true"/"false", numbers, or passthrough strings).

**Confirmation pattern:** When a control topic update arrives matching a pending notification's `watchKeys`, the notification is marked as "success". This works for both `Control/` and `Timeslots/` categories.

### 2.4 Component Structure

**Layout:**

- `src/app/layout.tsx` — Root layout wrapping everything in `<BatteryProvider>`. Dark theme with Geist fonts. Metadata: "Battery Dashboard".
- `src/app/page.tsx` — Main page. Shows serial-number setup prompt if `config.inverterSerial` is empty. Otherwise renders a 3-column grid.

**Components** (all `"use client"` — client-side only):

| Component          | Purpose                                                                                                                                                                             | Data consumed                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `ConnectionStatus` | MQTT status indicator, last update time, GivTCP version, inverter online/offline                                                                                                    | `isConnected`, `lastUpdate`, `stats`                 |
| `BatteryGauge`     | SOC percentage/kWh, charge/discharge status, battery power/voltage, time remaining                                                                                                  | `power.Power`, `power.Flows`                         |
| `PowerFlowDiagram` | Solar/Grid/Battery flow visualization with directional arrows, house load, grid voltage/frequency                                                                                   | `power.Flows`, `power.Power`                         |
| `EnergyStats`      | 9 stat cards (today + total) for solar, import, export, charge, discharge, load, self-consumption, inverter output, throughput. Tariff rate info.                                   | `energy.Today`, `energy.Total`, `energy.Rates`       |
| `BatteryControls`  | Mode selection (Eco/Timed Demand/Timed Export), eco toggle, pause mode, pause schedule, rate sliders (charge/discharge/reserve/target SOC), force charge/export, temp pause buttons | `control`, `inverter`, `timeslots`, `publishControl` |
| `ScheduleManager`  | 3 charge + 3 discharge timeslot editors with enable/disable toggles                                                                                                                 | `timeslots`, `control`, `publishControl`             |

**Page layout (3-column grid on lg+):**

- Left: BatteryGauge + PowerFlowDiagram
- Center: EnergyStats
- Right: BatteryControls + ScheduleManager

### 2.5 Data Flow Summary

```
GivEnergy Inverter
    ↕ Modbus TCP (port 8899)
GivTCP Container
    ↕ MQTT (port 1883)
Mosquitto Broker
    ↕ WebSocket (port 9001)
Next.js Browser Client (mqtt.js)
    → useMqtt() hook
    → BatteryContext reducer
    → Component tree via useBattery()
```

---

## 3. Configuration

### 3.1 App Config (`src/lib/config.ts`)

Two environment variables:

- `NEXT_PUBLIC_MQTT_URL` — WebSocket URL to Mosquitto broker (default: `ws://localhost:9001`).
- `NEXT_PUBLIC_INVERTER_SERIAL` — Inverter serial number (default: empty string, required).

### 3.2 Environment Template (`.env.local.example`)

```env
NEXT_PUBLIC_MQTT_URL=ws://localhost:9001
NEXT_PUBLIC_INVERTER_SERIAL=YOUR_SERIAL_HERE
```

### 3.3 next.config.ts

**Empty configuration** — no proxy, rewrites, redirects, or custom webpack config. The default Next.js config is used.

### 3.4 TypeScript Config

- Target: ES2017, Module: esnext, Module resolution: bundler.
- Strict mode enabled. Path alias: `@/*` → `./src/*`.

---

## 4. GivTCP Configuration

### 4.1 allsettings.json (actual config)

Key settings for the configured inverter:

- **Inverter IP:** `192.168.1.4`
- **Serial:** `CK2527G113`
- **Model:** `All_in_one_hybrid`
- **Host IP:** `172.18.100.90`
- **MQTT broker:** `mosquitto` (hostname), port `1883`, topic root `GivEnergy`
- **MQTT auth:** No username/password (anonymous)
- **MQTT retain:** `true`
- **Self-run timer:** 30s (quick poll), 120s (full poll)
- **Queue retries:** 2
- **Log level:** Info
- **Timezone:** Europe/London
- **Tariff rates:** Day 0.395, Night 0.155, Export 0.04 (£/kWh)
- **Rate schedule:** Day starts 05:30, Night starts 23:30
- **Web dashboard:** Disabled (port 3000 reserved)
- **HA Auto Discovery:** Enabled
- **Smart Target / PALM:** Disabled
- **InfluxDB:** Disabled

### 4.2 allsettings.template.json

Same structure with placeholder values (`YOUR_INVERTER_IP`, `YOUR_INVERTER_SERIAL`). Template is committed to git; actual settings file is gitignored.

---

## 5. DevContainer Infrastructure

### 5.1 docker-compose.yml

Three services:

1. **app** — `mcr.microsoft.com/devcontainers/typescript-node:20`. Mounts workspace and givtcp-config. Runs `sleep infinity` (dev server started by `postStartCommand`).
2. **mosquitto** — `eclipse-mosquitto:2`. Ports 1883 (MQTT) and 9001 (WebSocket). Config mounted from `.devcontainer/mosquitto/mosquitto.conf`.
3. **givtcp** — `britkat/giv_tcp-dev:latest`. Port 8099 (web UI/API). Config mounted from `../givtcp-config` to `/config/GivTCP`. Auto-restart: `unless-stopped`.

### 5.2 Mosquitto Config

```
listener 1883          # MQTT protocol
listener 9001          # WebSocket protocol
allow_anonymous true   # No auth
persistence false      # No message persistence
log_dest stdout
log_type all
```

### 5.3 devcontainer.json

- Forwarded ports: 3000 (Next.js), 9001 (MQTT WS), 8099 (GivTCP web UI)
- `postCreateCommand`: installs mosquitto-clients and npm dependencies.
- `postStartCommand`: `npm run dev` (starts Next.js dev server).
- Extensions: ESLint, Prettier, Tailwind CSS IntelliSense.

### 5.4 Makefile

Single target:

```makefile
mqtt-monitor:
    mosquitto_sub -h mosquitto -t "GivEnergy/control/#" -v
```

Monitors control topic messages only (useful for debugging commands sent from the UI).

---

## 6. Log Files and Format

### 6.1 Log Directory

`givtcp-config/logs/` contains:

| File                     | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `startup.log`            | GivTCP startup, inverter detection, plant discovery                 |
| `startup.log.2026-03-31` | Rotated startup log from previous day                               |
| `log_inv_1.log`          | Inverter 1 read loop — data refresh cycles, MQTT publishing, errors |
| `write_log_inv_1.log`    | Inverter 1 write operations — command executions, success/failure   |

### 6.2 Log Format

All GivTCP logs follow the same format:

```
YYYY-MM-DD HH:MM:SS,mmm - {module} - [{LEVEL}] - {message}
```

**Fields:**

- Timestamp: ISO-style with milliseconds (comma-separated)
- Module: `startup`, `read`, `write`, `client`, `mqtt`
- Level: `INFO`, `ERROR`, `CRITICAL`, `WARNING`
- Message: Free-text, may contain JSON payloads or Python tracebacks

### 6.3 Log Content Observations

**startup.log:**

- Records plant detection (inverter model, battery count, meter count).
- Shows GivTCP web config URL.
- Reports self-run loop timing (30s/120s).
- Records stuck loop detection and restart: `Self Run loop process stuck. Killing and restarting...`

**log_inv_1.log (read log):**

- `Starting watch_plant loop...` — Loop restart events.
- `Detecting inverter characteristics...` — Logged at CRITICAL level (not an error, just labeling).
- `Starting data refresh cycle` — Normal periodic data poll.
- `Publishing Home Assistant Discovery messages` — HA integration messages.
- `TimeoutError` — Inverter communication timeout (Modbus).
- `Error getting connection to MQTT Broker` — Broker connectivity issues.
- `Dynamic Tariff enabled so defaulting to Day Rate` — Tariff mode info.

**write_log_inv_1.log (write/command log):**

- Records command execution results.
- `Setting Battery Pause Mode to Disabled was a success` — Successful command pattern.
- `Setting charge schedule {"state":"disable"} failed: ('UnboundLocalError', 'write.py', 261)` — GivTCP bug in charge schedule disable.
- `Setting Battery Reserve failed: ('ValueError', 'write.py', 447)` — Payload validation error.
- `Invalid Mode requested: {"state":"Disabled"}` — Wrong payload format (should use `Disabled` not `{"state":"Disabled"}` for setBatteryPauseMode per GivTCP API, though this was later resolved).

### 6.4 Known Issues from Logs

1. **Inverter timeouts**: The inverter at 192.168.1.4 frequently times out during `detect_plant` (Modbus over TCP port 8899). This is expected in a dev container without LAN access to a real inverter.
2. **MQTT broker reconnection**: `Error getting connection to MQTT Broker: ('gaierror', 'mqtt.py', 57)` — DNS resolution failure, likely during container restart.
3. **Charge schedule disable bug**: GivTCP `write.py:261` has an `UnboundLocalError` when disabling charge schedule — this is a GivTCP bug, not a client bug.
4. **Payload format sensitivity**: Some commands require JSON payloads `{"state": "value"}`, others expect plain strings. The write log reveals format mismatches that the client has worked to resolve.

---

## 7. Type System

**Source:** `src/lib/types.ts`

Comprehensive TypeScript interfaces covering all GivTCP MQTT data:

- `PowerFlows` — 7 directional flow values (Solar/Grid/Battery → House/Grid/Battery)
- `PowerReadings` — 22 real-time power readings (SOC, voltages, currents, powers)
- `EnergyToday` / `EnergyTotal` — 10 daily/cumulative energy metrics each
- `EnergyRates` — 8 tariff/cost fields
- `ControlData` — 22 battery control settings
- `BatteryInfo` / `BatteryStack` / `BatteryDetails` — Nested battery cell/stack data
- `Timeslots` — Charge/discharge time slots with dynamic key support
- `InverterInfo` — 9 inverter metadata fields
- `StatsData` — 4 GivTCP status fields
- `BatteryState` — Aggregate root combining all above + connection state + notifications
- `CommandNotification` — Command tracking with pending/success/timeout/error status

---

## 8. Command Metadata System

**Source:** `src/lib/topics.ts` (`commandMeta`)

Each control command is mapped to:

- `label`: Human-readable name for notification display.
- `watchKeys`: Array of `Control/` or `Timeslots/` keys to monitor for confirmation.

This enables the confirmation tracking pattern where the `MQTT_MESSAGE` reducer action checks incoming Control/Timeslots updates against pending notifications.

---

## Summary of Key Architectural Decisions

1. **MQTT-only communication** — No REST APIs. All data and control flows through Mosquitto.
2. **Client-side only** — All components are `"use client"`. No SSR, no server components, no API routes. Next.js serves as a static-like SPA framework.
3. **Singleton MQTT client** — Shared across all hooks with reference counting to avoid multiple connections.
4. **Wildcard subscription** — Single `GivEnergy/{serial}/#` subscription with client-side topic routing via the reducer.
5. **Optimistic command tracking** — Commands fire immediately with pending notifications; confirmation is observed via data topic updates.
6. **DevContainer-based development** — Three-container setup (app + mosquitto + givtcp) with pre-configured port forwarding.
7. **No persistence layer** — No database, no localStorage, no session storage. All state is ephemeral and rebuilt from live MQTT data on page load.

---

## Follow-on Questions (Within Scope)

- None identified. All original research topics are fully answered.

## Clarifying Questions

- None. The codebase is self-contained and well-documented via the README.
