# Codebase Architecture Research: Battery Client MQTT Communication

## Research Topics

1. How the web frontend communicates with GivTCP via MQTT
2. MQTT topic structure (reads vs writes)
3. Real-time data flow from MQTT to UI
4. Command flow from UI to MQTT
5. Connection architecture (browser-side vs server-side)
6. Error handling and reconnection logic

---

## Key Findings

### 1. Architecture Overview

This is a **Next.js 16** application (`next@16.2.1`, `react@19.2.4`) that uses a **direct browser-to-MQTT-broker WebSocket connection**. There are **no API routes**, **no REST API usage**, and **no server-side MQTT handling**. The entire MQTT lifecycle runs client-side in the browser.

**Stack:**

- Next.js 16.2.1 (App Router, all pages are `"use client"`)
- React 19.2.4
- mqtt.js v5.15.1 (browser MQTT client over WebSocket)
- Tailwind CSS v4
- TypeScript 5

**Source:** `package.json` lines 1-27

### 2. MQTT Connection Architecture

**Connection is made from the browser**, not from the Next.js server.

#### Configuration (`src/lib/config.ts`, lines 1-4)

```ts
mqttUrl: process.env.NEXT_PUBLIC_MQTT_URL ?? "ws://localhost:9001";
inverterSerial: process.env.NEXT_PUBLIC_INVERTER_SERIAL ?? "";
```

Both values use `NEXT_PUBLIC_` prefix, meaning they are embedded into the client bundle at build time. The MQTT URL defaults to `ws://localhost:9001` (Mosquitto WebSocket port).

**Environment template** (`.env.local.example`):

```
NEXT_PUBLIC_MQTT_URL=ws://localhost:9001
NEXT_PUBLIC_INVERTER_SERIAL=YOUR_SERIAL_HERE
```

#### MQTT Client Singleton (`src/lib/mqtt.ts`, lines 1-87)

The `useMqtt()` hook manages a **shared singleton MQTT client** with reference counting:

- **Singleton pattern** (lines 9-23): A module-level `sharedClient` variable holds the single `MqttClient` instance. `getClient()` creates the connection on first call and increments `refCount`. `releaseClient()` decrements and disconnects when refCount hits 0.
- **Connection options** (lines 14-19):
  - `clientId`: Random per-connection (`battery_client_` + 6 random hex chars)
  - `clean: true` — no persistent sessions
  - `reconnectPeriod: 5000` — auto-reconnect every 5 seconds
  - `connectTimeout: 10000` — 10-second connection timeout
- **Connection status tracking** (lines 35-59): The hook tracks 4 states: `"connecting"`, `"connected"`, `"disconnected"`, `"error"`. Events `connect`, `close`, `error`, `reconnect` on the mqtt.js client update this state.
- **subscribe function** (lines 61-76): Subscribes to topic(s), attaches a message handler, and returns an unsubscribe cleanup function.
- **publish function** (lines 78-80): Simple fire-and-forget publish with no QoS configuration (defaults to QoS 0).

**No authentication** is configured on the MQTT connection (no username/password options). The GivTCP config confirms `MQTT_Username` and `MQTT_Password` are empty strings.

**No proxy or middleware patterns exist.** The Next.js config (`next.config.ts`) is entirely empty — no rewrites or proxies.

### 3. MQTT Topics — Read (Subscribe)

**Source:** `src/lib/topics.ts`, lines 1-20 (`dataTopics()`)

The application subscribes to **one wildcard topic** that captures all data for the configured inverter:

| Topic Pattern          | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `GivEnergy/{serial}/#` | **Single wildcard subscription** — receives ALL data for the inverter |

Individual sub-categories of data that arrive under this wildcard:

| Sub-path                                 | Example Topic                                            | Data Category                                               |
| ---------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| `Power/Power/{key}`                      | `GivEnergy/{serial}/Power/Power/SOC`                     | Real-time power readings (SOC, grid power, PV power, etc.)  |
| `Power/Flows/{key}`                      | `GivEnergy/{serial}/Power/Flows/Solar_to_House`          | Power flow directions between sources                       |
| `Energy/Today/{key}`                     | `GivEnergy/{serial}/Energy/Today/PV_Energy_Today_kWh`    | Today's energy statistics                                   |
| `Energy/Total/{key}`                     | `GivEnergy/{serial}/Energy/Total/PV_Energy_Total_kWh`    | Cumulative energy totals                                    |
| `Energy/Rates/{key}`                     | `GivEnergy/{serial}/Energy/Rates/Current_Rate`           | Tariff/rate information                                     |
| `Control/{key}`                          | `GivEnergy/{serial}/Control/Mode`                        | Battery control settings (mode, rates, reserves, schedules) |
| `Battery_Details/{stack}/{serial}/{key}` | `GivEnergy/{serial}/Battery_Details/Battery_Stack_1/...` | Battery cell/stack details                                  |
| `Timeslots/{key}`                        | `GivEnergy/{serial}/Timeslots/Charge_start_time_slot_1`  | Charge/discharge schedule timeslots                         |
| `Stats/{key}`                            | `GivEnergy/{serial}/Stats/GivTCP_Version`                | GivTCP status (version, last update, online status)         |
| `{serial}/{key}`                         | `GivEnergy/{serial}/{serial}/Battery_Type`               | Inverter metadata (serial number matches the sub-path)      |

**GivTCP publishes individual scalar values to leaf topics**, not JSON objects. Each MQTT message contains a single value (string, number, or boolean).

### 4. MQTT Topics — Write (Publish/Commands)

**Source:** `src/lib/topics.ts`, lines 23-62 (`controlTopics()`)

All control commands publish to `GivEnergy/control/{serial}/{command}`:

| Command Topic             | Payload                                                     | UI Source                       |
| ------------------------- | ----------------------------------------------------------- | ------------------------------- |
| `setChargeRate`           | Watts (e.g., "2600")                                        | BatteryControls slider          |
| `setDischargeRate`        | Watts (e.g., "2600")                                        | BatteryControls slider          |
| `setBatteryReserve`       | Percentage (e.g., "4")                                      | BatteryControls slider          |
| `setChargeTarget`         | Percentage (e.g., "100")                                    | BatteryControls slider          |
| `setBatteryMode`          | "Eco" / "Timed Demand" / "Timed Export"                     | BatteryControls mode buttons    |
| `setEcoMode`              | "enable" / "disable"                                        | BatteryControls toggle          |
| `setBatteryPauseMode`     | "Disabled" / "PauseCharge" / "PauseDischarge" / "PauseBoth" | BatteryControls buttons         |
| `setPauseStart`           | "HH:MM"                                                     | BatteryControls time input      |
| `setPauseEnd`             | "HH:MM"                                                     | BatteryControls time input      |
| `forceCharge`             | Duration minutes (e.g., "30") or "Cancel"                   | BatteryControls duration button |
| `forceExport`             | Duration minutes or "Cancel"                                | BatteryControls duration button |
| `tempPauseCharge`         | Duration minutes or "Cancel"                                | BatteryControls duration button |
| `tempPauseDischarge`      | Duration minutes or "Cancel"                                | BatteryControls duration button |
| `enableChargeSchedule`    | "enable" / "disable"                                        | ScheduleManager toggle          |
| `enableDischargeSchedule` | "enable" / "disable"                                        | ScheduleManager toggle          |
| `enableChargeTarget`      | payload                                                     | Not used in current UI          |
| `disableChargeTarget`     | payload                                                     | Not used in current UI          |
| `enableDischarge`         | payload                                                     | Not used in current UI          |
| `setChargeStart{1-3}`     | "HH:MM"                                                     | ScheduleManager slot editor     |
| `setChargeEnd{1-3}`       | "HH:MM"                                                     | ScheduleManager slot editor     |
| `setDischargeStart{1-3}`  | "HH:MM"                                                     | ScheduleManager slot editor     |
| `setDischargeEnd{1-3}`    | "HH:MM"                                                     | ScheduleManager slot editor     |
| `setChargeTarget{1-3}`    | Percentage                                                  | ScheduleManager slot editor     |
| `setDischargeTarget{1-3}` | Percentage                                                  | ScheduleManager slot editor     |

**Key difference in topic paths:**

- **Read data** arrives on: `GivEnergy/{serial}/...` (serial is path segment 2)
- **Write commands** publish to: `GivEnergy/control/{serial}/...` ("control" is path segment 2)

### 5. Real-Time Data Flow: MQTT → UI

```
MQTT Broker (Mosquitto)
    ↓ WebSocket (ws://localhost:9001)
Browser MQTT Client (mqtt.js singleton in src/lib/mqtt.ts)
    ↓ subscribe("GivEnergy/{serial}/#")
BatteryContext (src/context/BatteryContext.tsx)
    ↓ useReducer dispatch → reducer routes by topic path
    ↓ React Context Provider
Components (useBattery() hook)
```

**Detailed flow:**

1. **layout.tsx** (line 32): Wraps entire app in `<BatteryProvider>`, which calls `useMqtt()`.
2. **BatteryContext.tsx** (lines 221-231): On `status === "connected"`, subscribes to `dataTopics().all` (`GivEnergy/{serial}/#`).
3. **Message routing** (lines 96-177): Each incoming message is parsed by `parseTopicPath()` which strips `GivEnergy/{serial}/` prefix, leaving a path like `["Power", "Power", "SOC"]`. The reducer then routes by first path segment:
   - `"Power"` → updates `state.power.Power` or `state.power.Flows`
   - `"Energy"` → updates `state.energy.Today`, `state.energy.Total`, or `state.energy.Rates`
   - `"Control"` → updates `state.control` AND checks notification watchKeys for confirmation
   - `"Battery_Details"` → uses `deepSet()` for nested battery stack updates
   - `"Timeslots"` → updates `state.timeslots` AND checks notification watchKeys
   - `"Stats"` → updates `state.stats`
4. **Value parsing** (lines 88-93, `tryParseValue`): Raw MQTT string payloads are auto-converted to `boolean`, `number`, or left as `string`.
5. **Components** consume state via `useBattery()` hook and re-render reactively.

### 6. Command Flow: UI → MQTT

```
User interaction (button click, slider release, form save)
    ↓
Component calls publishControl(commandName, payloadString)
    ↓ (from useBattery() context)
BatteryContext.publishControl() (src/context/BatteryContext.tsx, lines 233-248)
    ↓ Looks up command in controlTopics()
    ↓ Dispatches COMMAND_SENT notification (pending state)
    ↓ Calls publish(topic, payload) via useMqtt()
    ↓
Browser MQTT Client publishes to GivEnergy/control/{serial}/{command}
    ↓
GivTCP receives command, executes it on inverter
    ↓
GivTCP publishes updated state back to GivEnergy/{serial}/Control/{key}
    ↓ (arrives via wildcard subscription)
BatteryContext reducer matches watchKeys → flips notification to "success"
```

**Command confirmation system** (BatteryContext.tsx lines 192-214 and 250-270):

- When a command is published, a `CommandNotification` with status `"pending"` is created, containing `watchKeys` (e.g., `["Battery_Charge_Rate"]` for `setChargeRate`).
- The reducer checks incoming `Control` and `Timeslots` messages against pending notification `watchKeys`.
- If a matching key arrives, notification status flips to `"success"`.
- A 15-second timeout (line 253) marks unconfirmed commands as `"timeout"`.
- Completed/timed-out notifications auto-dismiss after 5 seconds (lines 260-268).

### 7. REST API Usage

**None.** There are:

- No `src/app/api/` directory (confirmed by file search — no API routes exist)
- No `fetch()` calls anywhere in the codebase
- No HTTP client libraries in dependencies
- All communication is purely MQTT over WebSocket

### 8. GivTCP Configuration

**Source:** `givtcp-config/allsettings.json`

| Setting                           | Value                 | Relevance                                                                          |
| --------------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| `MQTT_Output`                     | `true`                | MQTT publishing is enabled                                                         |
| `MQTT_Address`                    | `"mosquitto"`         | Docker service name for MQTT broker                                                |
| `MQTT_Port`                       | `1883`                | Native MQTT port (not WebSocket; browser uses port 9001 via Mosquitto WS listener) |
| `MQTT_Topic`                      | `"GivEnergy"`         | Root topic prefix                                                                  |
| `MQTT_Retain`                     | `true`                | Messages are retained (new subscribers get last known state immediately)           |
| `MQTT_Username` / `MQTT_Password` | `""` / `""`           | No authentication                                                                  |
| `serial_number_1`                 | `"CK2527G113"`        | Inverter serial for this installation                                              |
| `Model_1`                         | `"All_in_one_hybrid"` | GivEnergy All-in-One Hybrid inverter                                               |
| `invertorIP_1`                    | `"192.168.1.4"`       | Inverter LAN IP                                                                    |
| `self_run`                        | `true`                | GivTCP polls inverter automatically                                                |
| `self_run_timer`                  | `30`                  | Polls every 30 seconds                                                             |
| `self_run_timer_full`             | `120`                 | Full data refresh every 120 seconds                                                |
| `Web_Dash`                        | `false`               | GivTCP's built-in dashboard is disabled                                            |

### 9. Error Handling and Reconnection

**Source:** `src/lib/mqtt.ts`

- **Auto-reconnect**: mqtt.js `reconnectPeriod: 5000` handles automatic reconnection every 5 seconds.
- **Connection status**: Tracked via React state (`connecting`, `connected`, `disconnected`, `error`) and displayed by `ConnectionStatus.tsx`.
- **No explicit error handling on publish**: `publish()` is fire-and-forget with no callback or error handling.
- **No explicit error handling on subscribe**: No error callback on `client.subscribe()`.
- **Command timeout**: BatteryContext implements a 15-second timeout for command confirmations.
- **No dead letter handling**: Failed commands are only reported as "timeout" in the UI notification area.

### 10. Component Architecture

| Component                      | Role                                      | MQTT Interaction                                                           |
| ------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------- |
| `BatteryProvider` (layout.tsx) | Root context provider                     | Owns MQTT connection, subscribes to all data                               |
| `ConnectionStatus`             | Header status indicator                   | Reads `isConnected`, `lastUpdate`, `stats` from context                    |
| `BatteryGauge`                 | SOC display, charge/discharge status      | Reads `power.Power.SOC`, `power.Flows` from context                        |
| `PowerFlowDiagram`             | Solar/grid/battery/house power flows      | Reads `power.Flows`, `power.Power` from context                            |
| `EnergyStats`                  | Daily/total energy statistics             | Reads `energy.Today`, `energy.Total`, `energy.Rates` from context          |
| `BatteryControls`              | Rate sliders, mode buttons, force actions | Reads `control`, `inverter`, `timeslots`; publishes via `publishControl()` |
| `ScheduleManager`              | Charge/discharge slot editors             | Reads `timeslots`, `control`; publishes via `publishControl()`             |
| `NotificationArea`             | Command status toasts                     | Reads `notifications`; calls `dismissNotification()`                       |

### 11. Key Architectural Characteristics

1. **Pure client-side MQTT** — No server middleware, no API routes, no SSR data fetching. The Next.js server only serves the static bundle.
2. **Single wildcard subscription** — One `GivEnergy/{serial}/#` subscription receives all data; the reducer routes messages by topic path.
3. **Flat MQTT messages** — GivTCP publishes scalar values to leaf topics (not JSON payloads).
4. **Optimistic UI with confirmation** — Commands publish immediately, then wait for GivTCP to echo back the new state via MQTT.
5. **No QoS configuration** — All publishes use default QoS 0 (at most once).
6. **No MQTT authentication** — No username/password on the MQTT connection.
7. **MQTT Retain enabled** — New connections receive last-known state immediately from the broker.
8. **No persistent sessions** — `clean: true` means no offline message queuing.

---

## Clarifying Questions

None — research is complete based on the codebase analysis.

## Follow-On Research (Not In Scope)

- [ ] Investigate GivTCP source code to understand exact MQTT topic tree published and control topic handlers
- [ ] Review Mosquitto broker configuration (WebSocket listener setup on port 9001)
- [ ] Evaluate security implications of unauthenticated browser-to-broker MQTT connections
- [ ] Assess whether QoS 0 is sufficient for control commands (risk of lost commands)
