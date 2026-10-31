#!/usr/bin/env bash
set -Eeuo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin
log_dir=${XDG_STATE_HOME:-$HOME/.local/state}/manar
mkdir -p "$log_dir"
exec >>"$log_dir/browser.log" 2>&1
printf '\nStarting Manar browser: %s\n' "$(date -Is)"
: "${XDG_RUNTIME_DIR:?Run inside the desktop session}"
exec 9>"$XDG_RUNTIME_DIR/manar-browser.lock"
flock -n 9 || exit 0
# Production display always uses HTTPS. Do not silently fall back to HTTP.
MANAR_DISPLAY_URL=https://localhost/display
if [[ -f $HOME/.config/manar/display.env ]]; then
 source "$HOME/.config/manar/display.env"
else
 echo 'Konfigurasi display HTTPS belum tersedia. Jalankan setup.sh dari akun desktop melalui sudo.' >&2
 exit 1
fi
# Migrate startup URLs written by old installers, preserving the enrollment token.
case "$MANAR_DISPLAY_URL" in
 http://localhost:5000/*) MANAR_DISPLAY_URL="https://localhost/${MANAR_DISPLAY_URL#http://localhost:5000/}" ;;
 http://localhost/*) MANAR_DISPLAY_URL="https://localhost/${MANAR_DISPLAY_URL#http://localhost/}" ;;
esac
case "$MANAR_DISPLAY_URL" in
 https://localhost/\?displayToken=*) MANAR_DISPLAY_URL="https://localhost/display?${MANAR_DISPLAY_URL#*\?}" ;;
 https://localhost/|https://localhost) MANAR_DISPLAY_URL=https://localhost/display ;;
esac
if [[ $MANAR_DISPLAY_URL != https://localhost/display* ]]; then
 echo 'URL startup tidak sesuai. Jalankan setup.sh untuk memulihkan konfigurasi HTTPS.' >&2
 exit 1
fi
health_url=https://localhost/display
health_args=(--cacert /opt/manar/shared/casting-rootCA.crt)
echo 'Menunggu display HTTPS di https://localhost/display (token tidak dicatat).'
until curl --fail --silent --max-time 2 "${health_args[@]}" "$health_url" >/dev/null; do
  sleep 2
done
# Apply resolution in the desktop session before the browser opens.
if [[ -x /usr/local/bin/manar-display ]]; then
  /usr/local/bin/manar-display || echo 'Display setup failed; opening Chromium with the current resolution.'
fi
# Use the compositor's current output size/scale instead of an XWayland screen.
platform_args=()
if [[ -n ${WAYLAND_DISPLAY:-} ]]; then
  platform_args+=(--ozone-platform=wayland)
fi
# Set the dedicated profile preference before Chromium starts. Never edit a
# profile while another Chromium process is using it.
python3 - "$HOME/.config/manar-browser" <<'PYPROFILE'
import json, os, pathlib, sys, tempfile
profile = pathlib.Path(sys.argv[1])
argument = '--user-data-dir=' + str(profile)
for process in pathlib.Path('/proc').iterdir():
    if not process.name.isdigit():
        continue
    try:
        args = (process / 'cmdline').read_bytes().decode(errors='replace').split('\0')
        if argument in args and 'chrom' in args[0]:
            print('Profil Chromium sedang dipakai; preferensi diterapkan setelah browser ditutup/reboot.')
            sys.exit(0)
    except (OSError, IndexError):
        pass
prefs = profile / 'Default' / 'Preferences'
prefs.parent.mkdir(parents=True, exist_ok=True)
try:
    data = json.loads(prefs.read_text()) if prefs.exists() else {}
    data.setdefault('translate', {})['enabled'] = False
    with tempfile.NamedTemporaryFile(mode='w', dir=prefs.parent, delete=False) as output:
        json.dump(data, output)
        temporary = output.name
    os.replace(temporary, prefs)
    print('Preferensi translate.enabled=false diterapkan pada profil Manar.')
except (OSError, ValueError, TypeError) as error:
    print('Tidak dapat mengatur preferensi terjemahan:', error)
PYPROFILE
# This dedicated display profile uses no system keyring. Do not save passwords in it.
# Kiosk forces the display window fullscreen rather than restoring a previously
# saved normal window. This is Chromium kiosk mode, not a separate kiosk desktop.
# Alt+F4 closes the display browser; the server continues running.
echo 'Opening Manar display in Chromium kiosk fullscreen mode.'
exec chromium "${platform_args[@]}" --window-size=1920,1080 --disable-background-mode --new-window --kiosk --start-fullscreen --no-first-run \
  --password-store=basic --lang=id \
  --hide-crash-restore-bubble \
  --autoplay-policy=no-user-gesture-required \
  --user-data-dir="$HOME/.config/manar-browser" "$MANAR_DISPLAY_URL"
