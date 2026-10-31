#!/usr/bin/env bash
# Single entrypoint for production installation and updates for 64-bit Raspberry Pi OS Desktop.
set -Eeuo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
[[ $EUID == 0 && -n ${SUDO_USER:-} && $SUDO_USER != root ]] || {
 echo 'Run from your desktop user: sudo bash scripts/raspberry-pi/setup.sh [PI-LAN-IP]' >&2; exit 1;
}
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# Update as the checkout owner, then restart this script so newly pulled
# installer changes are used during the same invocation.
checkout=$(cd "$source_dir/../.." && pwd)
if [[ ${MANAR_INSTALL_SYNCED:-} != "$checkout" ]]; then
 if ! command -v git >/dev/null; then
  apt-get update
  apt-get install -y git
 fi
 desktop_home=$(getent passwd "$SUDO_USER" | cut -d: -f6)
 git_user() { runuser -u "$SUDO_USER" -- env HOME="$desktop_home" GIT_TERMINAL_PROMPT=0 git -C "$checkout" "$@"; }
 git_user rev-parse --is-inside-work-tree >/dev/null
 if [[ -n $(git_user status --porcelain) ]]; then
  echo 'Pembaruan dihentikan: ada perubahan lokal atau berkas baru di checkout.' >&2
  git_user status --short
  echo 'Simpan atau commit perubahan tersebut, lalu jalankan setup.sh kembali. Tidak ada berkas yang dihapus.' >&2
  exit 1
 fi
 if ! git_user rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
  echo 'Branch ini belum memiliki upstream Git. Atur upstream sebelum menjalankan installer.' >&2
  exit 1
 fi
 echo 'Mengambil kode installer terbaru dari Git...'
 git_user pull --ff-only
 export MANAR_INSTALL_SYNCED="$checkout"
 exec bash "$checkout/scripts/raspberry-pi/setup.sh" "$@"
fi
unset MANAR_INSTALL_SYNCED
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
export MANAR_DESKTOP_USER="$SUDO_USER"
bash "$source_dir/setup-system.sh"
bash "$source_dir/setup-casting.sh" "$address"
# Refuse to report success if the desktop still has HTTP startup settings.
desktop_home=$(getent passwd "$MANAR_DESKTOP_USER" | cut -d: -f6)
grep -q '^MANAR_DISPLAY_URL=https://localhost/display?displayToken=.' "$desktop_home/.config/manar/display.env" || {
 echo 'HTTPS display startup configuration missing; installation incomplete.' >&2; exit 1;
}
printf '\nInstallation complete. Reboot the Pi: sudo reboot\n'
printf 'Laptop connection page: https://%s/connect\n' "$address"
printf 'Trust the local CA on each remote device before connecting. See /opt/manar/shared/casting-rootCA.crt\n'
