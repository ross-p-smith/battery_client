<!-- markdownlint-disable-file -->

# Deploy on Raspberry Pi 5 — Future Upgrade Guide

This guide documents Raspberry Pi as a future upgrade path for hosting the battery monitoring dashboard. A dedicated Pi 5 draws 4.5-6W compared to 60-100W for a desktop PC, making it the most cost-effective option for 24/7 operation if the PC is retired or turned off.

## Pi 3 Model B assessment

Your existing Raspberry Pi 3 Model B (1 GB RAM) is **not suitable** for this application:

| Limitation              | Detail                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Insufficient RAM**    | 1 GB total. The three containers alone need 560 MB-1.3 GB, leaving no headroom for the OS (~200-400 MB).       |
| **32-bit processor**    | The BCM2835 is ARMv8 but runs 32-bit by default. GivTCP and Node 22 Docker images require ARM64 (linux/arm64). |
| **No native USB boot**  | USB mass storage boot requires an EEPROM modification. SD cards are unreliable for 24/7 Docker workloads.      |
| **Limited performance** | Cortex-A53 cores at 1.2 GHz deliver poor Next.js SSR performance and slow container startup.                   |

## Recommended upgrade: Raspberry Pi 5 (4 GB)

| Component                           | Specification                    | Estimated cost |
| ----------------------------------- | -------------------------------- | -------------- |
| Raspberry Pi 5 (4 GB)               | BCM2712, 4x Cortex-A76 @ 2.4 GHz | ~£50           |
| Official 27W USB-C PSU              | 5V/5A                            | ~£12           |
| Raspberry Pi 5 Active Cooler        | Heatsink + fan                   | ~£5            |
| 256 GB SATA SSD + USB 3.0 enclosure | Boot drive (not SD card)         | ~£20-25        |
| Ethernet cable                      | Cat5e/Cat6 to router             | ~£3-5          |
| **Total**                           |                                  | **~£90-97**    |

A SATA SSD over USB 3.0 is strongly recommended instead of an SD card. SD cards have limited write endurance and are prone to corruption from Docker's frequent writes (logs, overlayfs, container state).

## Power and cost comparison

| Metric                  | Raspberry Pi 5 | Hyper-V / Docker Desktop (current) |
| ----------------------- | -------------- | ---------------------------------- |
| Power draw              | 4.5-6W         | 60-100W (full PC)                  |
| Annual electricity cost | ~£12/year      | ~£128-172/year                     |
| 5-year electricity cost | ~£60           | ~£640-860                          |
| Hardware cost           | ~£90-97        | £0 (existing PC)                   |
| 5-year total cost       | ~£150-157      | ~£640-860                          |

When the PC is already running 24/7 for other purposes, the **marginal** cost of the VM/containers is only ~£11-21/year, making the savings from a Pi minimal. The Pi becomes cost-effective when the desktop PC can be turned off entirely.

## Deployment steps

The deployment follows the same Docker Compose approach used in the [Hyper-V guide](deployment-hyperv.md), but on Raspberry Pi OS instead of an Ubuntu VM.

### Flash Raspberry Pi OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Select **Raspberry Pi OS Lite (64-bit)** — no desktop environment needed
3. Click the gear icon to pre-configure:
   - Set hostname (e.g., `battery-pi`)
   - Enable SSH with password or public key
   - Set username and password
   - Configure Wi-Fi if not using Ethernet
4. Write to the SSD (connected via USB adapter)
5. Connect the SSD, Ethernet, and power to the Pi

### Install Docker Engine

SSH into the Pi and install Docker:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in for the group change to take effect, then verify:

```bash
docker --version
docker compose version
```

### Deploy the application

Clone the repository and start the services:

```bash
git clone <your-repo-url> battery-client
cd battery-client
cp .env.example .env
```

Edit `.env` with your values:

```bash
nano .env
```

```ini
NEXT_PUBLIC_INVERTER_SERIAL=YOUR_SERIAL_HERE
NEXT_PUBLIC_MQTT_URL=ws://battery-pi.local:9001
OCTOPUS_API_KEY=sk_live_xxxxxxxxxxxx
OCTOPUS_ACCOUNT=A-XXXXXXXX
```

Start all services:

```bash
docker compose up -d
```

Verify everything is running:

```bash
docker compose ps
```

Access the dashboard at `http://battery-pi.local:3000` from any device on your network.

### Enable automatic updates

Configure unattended security updates to keep the OS patched:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## When to upgrade

Consider moving to a Raspberry Pi 5 if any of these apply:

- **The desktop PC is retired or turned off** — the Pi becomes the only host, saving £120-160/year in electricity
- **Lower power consumption is a priority** — 4.5-6W vs 60-100W
- **A dedicated, silent device is preferred** — the Pi runs silently (passive cooling option available) and has no other workloads competing for resources
- **Reliability matters** — no Windows updates forcing reboots, no Docker Desktop process management, and no shared desktop usage interfering with the containers

If the PC stays on 24/7 for other reasons, the current Hyper-V or Docker Desktop setup remains the most cost-effective choice since no new hardware is needed.
