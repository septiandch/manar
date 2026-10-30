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
MANAR_DISPLAY_URL=http://localhost:5000/display
if [[ -f $HOME/.config/manar/display.env ]]; then
 source "$HOME/.config/manar/display.env"
fi
case "$MANAR_DISPLAY_URL" in
 https://localhost/\?displayToken=*) MANAR_DISPLAY_URL="https://localhost/display?${MANAR_DISPLAY_URL#*\?}" ;;
 https://localhost/|https://localhost) MANAR_DISPLAY_URL=https://localhost/display ;;
 http://localhost:5000/|http://localhost:5000) MANAR_DISPLAY_URL=http://localhost:5000/display ;;
esac
health_url=http://localhost:5000/display
health_args=()
if [[ $MANAR_DISPLAY_URL == https:* ]]; then
 health_url=https://localhost/display
 health_args+=(--cacert /opt/manar/shared/casting-rootCA.crt)
fi
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
# This dedicated display profile uses no system keyring. Do not save passwords in it.
# Maximize as a fallback if the desktop does not honor the fullscreen request.
# F11 exits fullscreen; Alt+F4 closes the browser.
exec chromium "${platform_args[@]}" --window-size=1920,1080 --disable-background-mode --new-window --start-maximized --start-fullscreen --no-first-run \
  --password-store=basic \
  --hide-crash-restore-bubble \
  --autoplay-policy=no-user-gesture-required \
  --user-data-dir="$HOME/.config/manar-browser" "$MANAR_DISPLAY_URL"
