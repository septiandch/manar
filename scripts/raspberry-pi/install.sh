#!/usr/bin/env bash
# One-command production installation for 64-bit Raspberry Pi OS Desktop.
set -Eeuo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
[[ $EUID == 0 && -n ${SUDO_USER:-} && $SUDO_USER != root ]] || {
 echo 'Run from your desktop user: sudo bash scripts/raspberry-pi/install.sh [PI-LAN-IP]' >&2; exit 1;
}
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
address=${1:-$(ip -4 route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++)if($i=="src"){print $(i+1);exit}}')}
[[ -n $address ]] || { echo 'Cannot detect LAN address; provide it as the first argument.' >&2; exit 1; }
python3 - "$address" <<'PY'
import ipaddress,sys
address=ipaddress.IPv4Address(sys.argv[1])
if address.is_loopback or address.is_unspecified or address.is_multicast:
 raise SystemExit('Provide the Pi LAN IPv4 address')
PY
printf 'Installing Manar with HTTPS for %s. Keep this IP reserved in your router.\n' "$address"
echo 'The app is deployed from the remote repository/branch in /etc/manar.conf; push your changes before installing.'
bash "$source_dir/setup.sh"
bash "$source_dir/setup-casting.sh" "$address"
# setup-casting configures the desktop account when invoked through sudo.
printf '\nInstallation complete. Reboot the Pi: sudo reboot\n'
printf 'Laptop connection page: https://%s/connect\n' "$address"
printf 'Trust the local CA on each remote device before connecting. See /opt/manar/shared/casting-rootCA.crt\n'
