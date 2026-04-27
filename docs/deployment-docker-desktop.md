<!-- markdownlint-disable-file -->

# Deploy with Docker Desktop on Windows 10

Run the battery monitoring dashboard directly on your Windows 10 desktop using Docker Desktop with the WSL2 backend. This is the simplest deployment option — install Docker Desktop, clone the repository, and start the containers.

## Prerequisites

- Windows 10 version 1903 (Build 18362) or later — version 2004+ recommended
- Hardware virtualisation enabled in BIOS (Intel VT-x or AMD-V)
- WSL2 installed — run `wsl --install` from an elevated PowerShell if not already set up
- At least 8 GB system RAM (4 GB allocated to WSL2, remainder for Windows)

Docker Desktop Personal is **free ($0/month)** for personal and home use with no revenue or employee count restrictions.

## Power and cost

Your PC is already running 24/7, so the marginal cost of adding these containers is near zero. Docker Desktop with WSL2 adds negligible power draw beyond the base system consumption of 60-100W (~£128-172/year at £0.245/kWh).

## Install Docker Desktop

1. Download Docker Desktop from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Run the installer — select **Use WSL 2 instead of Hyper-V** when prompted
3. Restart when the installer finishes
4. Open Docker Desktop and complete the first-run setup

Verify the installation:

```powershell
docker --version
docker compose version
```

## Configure WSL2 resources

WSL2 defaults to consuming up to 50% of system RAM and all CPU cores. Create a resource limit file to prevent it from claiming too much memory.

Create `%USERPROFILE%\.wslconfig` (e.g., `C:\Users\YourName\.wslconfig`):

```ini
[wsl2]
memory=4GB
processors=2
swap=2GB
autoMemoryReclaim=gradual
```

The `autoMemoryReclaim=gradual` setting (available since WSL 2.0.0) prevents WSL2 from holding unused memory indefinitely.

Restart WSL2 to apply:

```powershell
wsl --shutdown
```

Docker Desktop restarts automatically when WSL2 comes back up.

## Deploy the application

Clone the repository and start the services:

```powershell
git clone <your-repo-url> battery-client
cd battery-client
```

Create the environment file from the template:

```powershell
copy .env.example .env
```

Edit `.env` with your values:

```ini
NEXT_PUBLIC_INVERTER_SERIAL=YOUR_SERIAL_HERE
NEXT_PUBLIC_MQTT_URL=ws://localhost:9001
OCTOPUS_API_KEY=sk_live_xxxxxxxxxxxx
OCTOPUS_ACCOUNT=A-XXXXXXXX
```

Start all services:

```powershell
docker compose up -d
```

Verify everything is running:

```powershell
docker compose ps
```

All three services (app, mosquitto, givtcp) should show `Up` with healthy status. Open `http://localhost:8080` to access the dashboard.

## MQTT URL configuration

The `NEXT_PUBLIC_MQTT_URL` value depends on where you access the dashboard from:

| Access from         | MQTT URL value              |
| ------------------- | --------------------------- |
| Same PC (localhost) | `ws://localhost:9001`       |
| Other LAN devices   | `ws://<pc-ip-address>:9001` |

If you access the dashboard from a phone or tablet on your network, set the URL to your PC's LAN IP address (e.g., `ws://192.168.1.100:9001`). The browser connects to the MQTT broker directly, so it must be reachable from the client device.

## Auto-start configuration

### Docker Desktop auto-start

Open Docker Desktop → **Settings** → **General** → enable **Start Docker Desktop when you log in**.

### Container auto-start

The [`docker-compose.yml`](../docker-compose.yml) already sets `restart: unless-stopped` on all services. Containers restart automatically after Docker Desktop starts.

### Windows auto-login

For fully unattended operation after reboots, configure automatic login:

1. Press <kbd>Win</kbd>+<kbd>R</kbd>, type `netplywiz`, and press Enter
2. Select your user account
3. Uncheck **Users must enter a user name and password to use this computer**
4. Enter your password when prompted

This ensures Docker Desktop launches without waiting for a manual login.

## Maintenance

- **Docker Desktop updates** — Docker Desktop checks for updates automatically. Apply updates when prompted; a restart is required.
- **Container image updates** — Pull the latest images periodically:

  ```powershell
  docker compose pull
  docker compose up -d
  ```

- **Monitoring** — Use the Docker Desktop GUI to view container status, logs, and resource usage, or check from the command line:

  ```powershell
  docker compose ps
  docker compose logs --tail=50
  ```

## When to use this instead of Hyper-V

| Consideration        | Docker Desktop                | Hyper-V                       |
| -------------------- | ----------------------------- | ----------------------------- |
| Setup complexity     | Low — install and run         | High — create VM, install OS  |
| Hyper-V availability | Works on Windows Home edition | Requires Pro/Enterprise       |
| Isolation            | Shared with Windows desktop   | Full VM isolation             |
| Familiarity          | Standard Docker workflow      | Requires VM management skills |
| WSL2 provides        | Linux kernel directly         | Full Linux VM                 |

Choose Docker Desktop if you want the simplest path to a running dashboard, or if Hyper-V is not available on your Windows edition. Choose Hyper-V if you prefer full VM isolation or already manage other Hyper-V workloads.
