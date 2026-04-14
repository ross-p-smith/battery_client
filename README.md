# Battery Dashboard

A real-time GivEnergy All-in-One V2 battery monitoring and control dashboard built with Next.js, TypeScript, and Tailwind CSS. Connects directly to GivTCP via MQTT over WebSocket.

## Features

- **Live Power Flows** — Real-time visualization of Solar, Battery, Grid, and House power flows
- **Battery SOC Gauge** — State of charge with kWh display, charge/discharge status
- **Energy Statistics** — Today's and cumulative totals for generation, import, export, and consumption
- **Battery Controls** — Mode selection, charge/discharge rates, reserve, force charge/export, pause
- **Schedule Manager** — Charge and discharge timeslot configuration (3 slots each)
- **Connection Status** — MQTT connection indicator and GivTCP status

## Prerequisites

- Docker and Docker Compose
- VS Code with the Dev Containers extension
- A GivEnergy inverter accessible on the local network
- GivTCP configured to publish MQTT data

## Quick Start

1. Clone this repository and open it in VS Code.

2. Copy the app environment template and configure it:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```env
   NEXT_PUBLIC_INVERTER_SERIAL=YOUR_SERIAL_HERE
   NEXT_PUBLIC_MQTT_URL=ws://localhost:9001
   ```

3. Create local GivTCP settings from the tracked template:

   ```bash
   cp givtcp-config/allsettings.template.json givtcp-config/allsettings.json
   ```

   Edit `givtcp-config/allsettings.json` and set at least these fields:
   - `invertorIP_1`: your inverter IP on LAN (for example `192.168.1.4`)
   - `inverter_enable_1`: `true`
   - `serial_number_1`: your inverter serial
   - `MQTT_Output`: `true`
   - `MQTT_Address`: `mosquitto`
   - `MQTT_Port`: `1883`
   - `MQTT_Topic`: `GivEnergy`
   - `self_run`: `true`

   Notes:
   - `givtcp-config/allsettings.json` is ignored by git so local IP/serial values are not committed.
   - `givtcp-config/allsettings.template.json` is safe to commit and share.

4. Open the command palette (`Ctrl+Shift+P`) and select **Dev Containers: Rebuild and Reopen in Container**.

5. The devcontainer starts three services:
   - **app** — Next.js dev server on port 3000
   - **mosquitto** — MQTT broker (port 1883) with WebSocket (port 9001)
   - **givtcp** — GivTCP container reading config from `givtcp-config/allsettings.json`

6. Validate the setup:
   - `http://localhost:8099/settings` should show your configured inverter IP/serial and MQTT fields
   - `http://localhost:3000` should load the dashboard

7. If you need to inspect MQTT traffic:

   ```bash
   mosquitto_sub -h mosquitto -p 1883 -t "GivEnergy/#" -v
   ```

## GivTCP Configuration

GivTCP uses `givtcp-config/allsettings.json` at startup.

The UI at `http://localhost:8099/config.html` can still be used, but if it fails to save due to frontend errors, edit `givtcp-config/allsettings.json` directly and restart/rebuild.

Recommended baseline values:

1. Set inverter IP (`invertorIP_1`)
2. Set inverter serial (`serial_number_1`)
3. Enable MQTT (`MQTT_Output: true`) and point broker to `mosquitto:1883`
4. Enable `self_run`
5. Restart GivTCP (or rebuild devcontainer)

## Architecture

```
Browser ──WebSocket──> Mosquitto (port 9001)
                         │
GivTCP ──MQTT──────────> Mosquitto (port 1883)
  │
  └── Modbus ──> GivEnergy Inverter (LAN)
```

The browser connects directly to the Mosquitto MQTT broker over WebSocket. GivTCP publishes inverter data to MQTT topics under `GivEnergy/<serial>/`. The browser subscribes to these topics for real-time updates and publishes control commands to `GivEnergy/control/<serial>/`.

## MQTT Topics

### Data (subscribed by the dashboard)

| Topic Pattern                       | Data                                                    |
| ----------------------------------- | ------------------------------------------------------- |
| `GivEnergy/<serial>/Power/Power/#`  | Real-time power readings (SOC, load, PV, grid, battery) |
| `GivEnergy/<serial>/Power/Flows/#`  | Power flow directions (solar→house, battery→grid, etc.) |
| `GivEnergy/<serial>/Energy/Today/#` | Today's energy totals                                   |
| `GivEnergy/<serial>/Energy/Total/#` | Cumulative energy totals                                |
| `GivEnergy/<serial>/Control/#`      | Current control settings                                |
| `GivEnergy/<serial>/Timeslots/#`    | Charge/discharge schedule timeslots                     |

### Control (published by the dashboard)

| Topic                                          | Payload Example                                            |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `GivEnergy/control/<serial>/setBatteryMode`    | `{"mode":"Eco"}`                                           |
| `GivEnergy/control/<serial>/setChargeRate`     | `{"chargeRate":"2600"}`                                    |
| `GivEnergy/control/<serial>/setBatteryReserve` | `{"reservePercent":"4"}`                                   |
| `GivEnergy/control/<serial>/forceCharge`       | `30` or `Cancel`                                           |
| `GivEnergy/control/<serial>/setChargeSlot1`    | `{"start":"2330","finish":"0400","chargeToPercent":"100"}` |

## Development

```bash
# Install dependencies (runs automatically in devcontainer)
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

## Project Structure

```
src/
├── app/
│   ├── globals.css          # Tailwind dark theme styles
│   ├── layout.tsx           # Root layout with BatteryProvider
│   └── page.tsx             # Main dashboard page
├── components/
│   ├── BatteryControls.tsx  # Inverter control panel
│   ├── BatteryGauge.tsx     # SOC gauge visualization
│   ├── ConnectionStatus.tsx # MQTT connection indicator
│   ├── EnergyStats.tsx      # Energy statistics cards
│   ├── PowerFlowDiagram.tsx # Real-time power flow display
│   └── ScheduleManager.tsx  # Charge/discharge schedule editor
├── context/
│   └── BatteryContext.tsx   # React context aggregating MQTT state
└── lib/
    ├── config.ts            # Environment configuration
    ├── mqtt.ts              # MQTT WebSocket client
    ├── topics.ts            # GivTCP MQTT topic definitions
    └── types.ts             # TypeScript interfaces for GivTCP data
```
