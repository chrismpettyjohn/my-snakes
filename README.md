# MySnakes LAN Bridge

Herpstat SpyderWeb units can't send HTTPS, so the bridge runs on a computer on the same network, reads each Herpstat's status, and forwards it to MySnakes.

## Before you start
- Install [Docker](https://docs.docker.com/get-docker/) on a computer that stays on and is on the same network as your Herpstats.
- On each Herpstat, open **ADMIN → Show Advanced Status Integration Options** and turn on **Enable /RAWSTATUS Page**.

## Install
1. In MySnakes, go to **Settings → Bridge → Install Bridge…**
2. Copy the command for your computer and run it:
   - **macOS / Linux:** run it in Terminal.
   - **Windows:** run it in PowerShell.

The command holds a secret token and is only shown once. Every Herpstat the bridge finds appears under **Settings → Herpstat** within a few minutes.

## Start on boot
The bridge restarts whenever Docker starts.
- **macOS / Windows:** turn on **Docker Desktop → Settings → General → Start Docker Desktop when you sign in**.
- **Linux:** run `sudo systemctl enable docker`.

## Manage
```sh
docker logs -f snake-bridge   # see what it's doing
docker rm -f snake-bridge     # uninstall
```
To update, run the install command again. To revoke a bridge, remove it under **Settings → Bridge**.

## Troubleshooting
- **A Herpstat isn't found:** check that /RAWSTATUS is on and the unit is on the same network. To point the bridge at units directly, set `HERPSTAT_HOSTS` (comma-separated) and run the install command again.
- **Wrong network scanned:** set `SCAN_SUBNETS` (e.g. `192.168.1.0/24`) and run the install command again.

Set them in the same window before running the install command:
```sh
export HERPSTAT_HOSTS=192.168.1.50,192.168.1.51   # macOS / Linux
```
```powershell
$env:HERPSTAT_HOSTS = '192.168.1.50,192.168.1.51'  # Windows
```
- **"Bridge token was rejected" in the logs:** the bridge was removed in Settings. Create a new one and run its install command.
