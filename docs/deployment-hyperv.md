<!-- markdownlint-disable-file -->

# Deploy Battery Client on Hyper-V (Primary Guide)

This guide walks through deploying the battery client application stack on a Hyper-V VM running on your existing Windows 10 PC. Because the PC is already running 24/7 with Hyper-V VMs enabled, this is the optimal deployment target — zero hardware cost and near-zero marginal power cost.

The stack consists of three Docker containers:

- **Next.js app** — battery monitoring dashboard (port 8080)
- **Eclipse Mosquitto** — MQTT broker (ports 1883, 9001)
- **GivTCP** — GivEnergy inverter bridge (port 8099)

## Prerequisites

| Requirement     | Details                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| Windows edition | Windows 10 Pro, Enterprise, or Education (Home does not support Hyper-V)    |
| CPU             | 64-bit with SLAT and VT-x/AMD-V (hardware virtualisation enabled in BIOS)   |
| Host RAM        | 8 GB minimum (16 GB recommended)                                            |
| Hyper-V         | Enabled and operational                                                     |
| Network         | Ethernet connection on the same LAN as the GivEnergy inverter (192.168.1.x) |

If Hyper-V is not yet enabled, open an elevated PowerShell prompt and run:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
```

Restart when prompted.

## Power and Cost Summary

Your PC is already running 24/7. The marginal power cost of adding this lightweight VM is the only relevant figure:

| Metric                           | Value                        |
| -------------------------------- | ---------------------------- |
| Additional VM workload           | ~5-10 W                      |
| Annual energy (10 W upper bound) | 10 W × 24 h × 365 = 87.6 kWh |
| Annual cost (at £0.245/kWh)      | ~£11-21/year                 |

This eliminates the cost disadvantage that a desktop PC would otherwise have compared to a Raspberry Pi. The full host power draw (60-100 W) is already a sunk cost since the PC runs regardless.

## Step 1 — Create an External Virtual Switch

The VM needs a network adapter on your LAN so it can reach the GivEnergy inverter at 192.168.1.4 and be accessible from other devices on the network.

### Option A: Hyper-V Manager (GUI)

1. Open **Hyper-V Manager**.
2. In the right-hand Actions pane, select **Virtual Switch Manager**.
3. Select **External** and click **Create Virtual Switch**.
4. Name it `LAN Switch`.
5. Under **External network**, select your physical Ethernet adapter.
6. Tick **Allow management operating system to share this network adapter**.
7. Click **OK**.

### Option B: PowerShell

```powershell
# List physical adapters to find the correct one
Get-NetAdapter

# Create the external switch (replace "Ethernet" with your adapter name)
New-VMSwitch -Name "LAN Switch" -NetAdapterName "Ethernet" -AllowManagementOS $true
```

> **Note:** Creating an external switch briefly interrupts the host's network connection. Do this when you can tolerate a few seconds of downtime.

## Step 2 — Create the Ubuntu VM

Open an elevated PowerShell prompt and run:

```powershell
# Create the VM
New-VM `
    -Name "battery-client" `
    -Generation 2 `
    -MemoryStartupBytes 2GB `
    -NewVHDPath "C:\HyperV\battery-client\disk.vhdx" `
    -NewVHDSizeBytes 20GB `
    -SwitchName "Debian Switch"

# Configure dynamic memory (2 GB minimum, 4 GB maximum)
Set-VMMemory -VMName "battery-client" `
    -DynamicMemoryEnabled $true `
    -MinimumBytes 2GB `
    -MaximumBytes 4GB `
    -StartupBytes 2GB

# Set CPU count
Set-VMProcessor -VMName "battery-client" -Count 4

# Disable Secure Boot for Linux (required for Ubuntu on Gen 2 VMs)
Set-VMFirmware -VMName "battery-client" -EnableSecureBoot Off

# Configure auto-start on host boot
Set-VM -VMName "battery-client" `
    -AutomaticStartAction Start `
    -AutomaticStartDelay 30 `
    -AutomaticStopAction ShutDown
```

### Download and Attach the Ubuntu ISO

1. Download [Ubuntu Server 24.04 LTS](https://ubuntu.com/download/server) (or 22.04 LTS).
2. Attach the ISO to the VM:

```powershell
Add-VMDvdDrive -VMName "battery-client" -Path "C:\Users\$env:USERNAME\Downloads\ubuntu-24.04.4-live-server-amd64.iso"

# Set DVD as first boot device
$dvd = Get-VMDvdDrive -VMName "battery-client"
Set-VMFirmware -VMName "battery-client" -FirstBootDevice $dvd
```

### Install Ubuntu

1. Start the VM: `Start-VM -VMName "battery-client"`
2. Connect via **Hyper-V Manager** → double-click the VM.
3. Follow the Ubuntu Server installer:
   - Select your language and keyboard layout.
   - Use the default storage layout (entire disk).
   - Set your hostname to `battery-client`.
   - Create a user account (e.g., `deploy`).
   - Enable **Install OpenSSH server** when prompted.
   - Skip optional snaps.
4. After installation completes, remove the ISO:

```powershell
Remove-VMDvdDrive -VMName "battery-client" -ControllerNumber 0 -ControllerLocation 1
```

5. Restart the VM: `Restart-VM -VMName "battery-client"`

### Find the VM's IP Address

After the VM boots, log in and run:

```bash
ip addr show eth0
```

Note the IPv4 address (e.g., `192.168.1.150`). You can also check your router's DHCP lease table. Consider assigning a static DHCP reservation so the IP does not change.

## Step 3 — Install Docker in the VM

SSH into the VM from PowerShell or Windows Terminal:

```powershell
ssh deploy@192.168.1.150
```

Then install Docker Engine:

```bash
# Install Docker using the official convenience script
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER

# Install the Docker Compose plugin
sudo apt-get install -y docker-compose-plugin

# Log out and back in for group membership to take effect
exit
```

SSH back in and verify:

```bash
ssh deploy@192.168.1.150
docker --version
docker compose version
```

## Step 4 — Deploy the Application

### Clone the Repository

```bash
git clone https://github.com/your-username/battery-client.git
cd battery-client
```

### Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Fill in the values:

```env
# GivEnergy Inverter
NEXT_PUBLIC_INVERTER_SERIAL=CE1234G567

# MQTT WebSocket URL — SEE IMPORTANT NOTE BELOW
NEXT_PUBLIC_MQTT_URL=ws://192.168.1.150:9001

# Octopus Energy API (optional)
OCTOPUS_API_KEY=sk_live_xxxxx
OCTOPUS_ACCOUNT=A-1234ABCD
```

> **Important: MQTT URL Configuration**
>
> The `NEXT_PUBLIC_MQTT_URL` value is baked into the Next.js client bundle at build time. It is the URL that **browsers on your LAN** use to connect to the Mosquitto MQTT broker via WebSocket.
>
> - Set this to `ws://<VM-IP>:9001` (e.g., `ws://192.168.1.150:9001`).
> - Do **not** use `ws://mosquitto:9001` — that Docker-internal hostname is only resolvable inside the Docker network, not from your browser.
> - Do **not** use `ws://localhost:9001` unless you only access the dashboard from the VM itself.
>
> If your VM's IP address changes, you must update this value and rebuild the app container:
>
> ```bash
> docker compose up -d --build app
> ```

### Build and Start the Stack

```bash
docker compose up -d --build
```

This builds the Next.js app image and starts all three services. The first build takes a few minutes.

Verify all containers are running and healthy:

```bash
docker compose ps
```

Expected output shows all three services as `Up` with health status `healthy` for `app` and `mosquitto`.

Access the dashboard from any device on your LAN:

```
http://192.168.1.150:8080
```

## Step 5 — Networking

The external virtual switch places the VM directly on your LAN with its own IP address on the 192.168.1.x subnet:

```
Browser (any LAN device)
    │
    ├── http://192.168.1.150:8080  →  Next.js dashboard
    └── ws://192.168.1.150:9001    →  Mosquitto WebSocket
                                        │
                                        ▼
                                   Docker bridge network
                                        │
                    ┌───────────────────┼──────────────────┐
                    │                   │                   │
                Next.js app       Mosquitto MQTT        GivTCP
                (port 8080)       (1883 + 9001)       (port 8099)
                                                          │
                                                          ▼
                                              GivEnergy Inverter
                                               192.168.1.4
```

- **No port forwarding is needed.** The VM has a LAN IP and direct Layer 2 access to the inverter.
- Docker publishes container ports to the VM's network interface, making them accessible to all LAN devices.
- GivTCP communicates with the inverter at 192.168.1.4 through the Docker bridge network and the VM's virtual NIC.

## Step 6 — Auto-Start on Boot

The deployment is configured for fully automatic recovery from host reboots (including Windows Update restarts):

| Layer                      | Auto-start mechanism                                                     | Already configured |
| -------------------------- | ------------------------------------------------------------------------ | ------------------ |
| **Windows → Hyper-V VM**   | `Set-VM -AutomaticStartAction Start`                                     | Yes (Step 2)       |
| **Ubuntu → Docker daemon** | `systemctl enable docker` (enabled by default after install)             | Yes (Step 3)       |
| **Docker → Containers**    | `restart: unless-stopped` in [docker-compose.yml](../docker-compose.yml) | Yes                |

The boot sequence after a host restart:

1. Windows starts and launches the Hyper-V service.
2. After a 30-second delay, Hyper-V starts the `battery-client` VM.
3. Ubuntu boots and starts the Docker daemon.
4. Docker restarts all containers with the `unless-stopped` policy.
5. Mosquitto starts first (health check dependency), then GivTCP and the Next.js app follow.

Typical time from host power-on to dashboard available: **2-4 minutes**.

## Step 7 — Windows Update Mitigation

Windows 10 may restart the host for updates, causing temporary downtime. To minimise disruption:

### Configure Active Hours

Open **Settings → Update & Security → Windows Update → Change active hours** and set a window that covers the times you most need the dashboard running (e.g., 06:00-02:00).

### Configure Restart Behaviour via Group Policy (Pro/Enterprise)

```powershell
# Open Group Policy Editor
gpedit.msc
```

Navigate to **Computer Configuration → Administrative Templates → Windows Components → Windows Update** and configure:

- **Configure Automatic Updates**: Set to "Auto download and notify for install"
- **No auto-restart with logged on users**: Enable this policy

### Recovery After Restart

No manual intervention is needed after a Windows restart. The VM auto-start and Docker restart policies handle everything automatically (see Step 6).

## Step 8 — Maintenance

### Ubuntu Updates

```bash
# Update package lists and upgrade
sudo apt update && sudo apt upgrade -y
```

Enable unattended security upgrades to keep the VM patched automatically:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Update Application Containers

```bash
cd ~/battery-client

# Pull latest images for Mosquitto and GivTCP
docker compose pull

# Rebuild the app image with latest code
git pull
docker compose up -d --build
```

### Hyper-V Snapshots

Take a snapshot before major updates for easy rollback:

```powershell
# Create a snapshot (run on the Windows host)
Checkpoint-VM -Name "battery-client" -SnapshotName "pre-update-$(Get-Date -Format 'yyyy-MM-dd')"

# List snapshots
Get-VMSnapshot -VMName "battery-client"

# Restore a snapshot if something goes wrong
Restore-VMSnapshot -VMName "battery-client" -Name "pre-update-2026-04-11" -Confirm:$false
Start-VM -VMName "battery-client"
```

### Docker Maintenance

```bash
# View container logs
docker compose logs -f app
docker compose logs -f givtcp

# Restart a single service
docker compose restart app

# Remove unused images to reclaim disk space
docker image prune -f
```

## Troubleshooting

### VM does not get an IP address

- Verify the external virtual switch is bound to the correct physical adapter: `Get-VMSwitch | Format-List`
- Check the VM is connected to the switch: `Get-VMNetworkAdapter -VMName "battery-client"`
- Ensure DHCP is running on your router

### Cannot connect to the dashboard

- Verify the containers are running: `docker compose ps`
- Check the app health: `docker compose logs app`
- Confirm the VM's IP from inside the VM: `ip addr show eth0`
- Check the `NEXT_PUBLIC_MQTT_URL` in `.env` matches the VM's current IP

### GivTCP cannot reach the inverter

- From inside the VM, ping the inverter: `ping 192.168.1.4`
- If unreachable, the VM is not on the correct subnet. Check the virtual switch configuration.
- Verify `givtcp-config/allsettings.json` has the correct inverter IP

### Containers fail to start after reboot

- Check Docker is running: `sudo systemctl status docker`
- If Docker is not enabled: `sudo systemctl enable docker`
- Check container status: `docker compose ps -a`
- View logs for failed containers: `docker compose logs`

## File Reference

| File                                                                                | Purpose                                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [docker-compose.yml](../docker-compose.yml)                                         | Production Docker Compose with app, mosquitto, and givtcp services |
| [Dockerfile](../Dockerfile)                                                         | Multi-stage production build for the Next.js app                   |
| [.env.example](../.env.example)                                                     | Environment variable template — copy to `.env` and fill in values  |
| [givtcp-config/allsettings.json](../givtcp-config/allsettings.json)                 | GivTCP inverter configuration                                      |
| [.devcontainer/mosquitto/mosquitto.conf](../.devcontainer/mosquitto/mosquitto.conf) | Mosquitto broker configuration                                     |
