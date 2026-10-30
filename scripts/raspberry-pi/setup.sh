#!/usr/bin/env bash
set -Eeuo pipefail
# Include administration commands such as useradd, runuser, and nginx.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
[[ $EUID == 0 ]] || { echo 'Run with sudo bash scripts/raspberry-pi/setup.sh' >&2; exit 1; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
desktop_user=${SUDO_USER:-}
[[ -n $desktop_user && $desktop_user != root ]] || { echo 'Run through sudo from your desktop user.' >&2; exit 1; }
[[ $(uname -m) == aarch64 ]] || { echo 'Requires 64-bit Raspberry Pi OS.' >&2; exit 1; }
command -v raspi-config >/dev/null
[[ -d /etc/lightdm ]] || { echo 'Requires Raspberry Pi OS Desktop (LightDM).' >&2; exit 1; }
desktop_home=$(getent passwd "$desktop_user" | cut -d: -f6)
desktop_group=$(id -gn "$desktop_user")
desktop_session=
for candidate in LXDE-pi-labwc rpd-labwc LXDE-pi; do
  if [[ -f /usr/share/wayland-sessions/$candidate.desktop || -f /usr/share/xsessions/$candidate.desktop ]]; then
    desktop_session=$candidate
    break
  fi
done
[[ -n $desktop_session ]] || { echo 'No supported Raspberry Pi desktop session found.' >&2; exit 1; }
apt-get update
apt-get install -y git curl ca-certificates xz-utils build-essential python3 nginx chromium wlr-randr
# Install the latest Node 22 binary from nodejs.org, verified against its checksum.
temp=$(mktemp -d)
trap 'rm -rf -- "$temp"' EXIT
curl -fsS https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt -o "$temp/SHASUMS256.txt"
archive=$(awk '$2 ~ /^node-v22\.[0-9]+\.[0-9]+-linux-arm64.tar.xz$/ {print $2}' "$temp/SHASUMS256.txt")
[[ -n $archive && $archive != *$'\n'* ]]
curl -fsS "https://nodejs.org/dist/latest-v22.x/$archive" -o "$temp/$archive"
(cd "$temp"; grep " $archive\$" SHASUMS256.txt | sha256sum -c -)
tar -xJf "$temp/$archive" -C /usr/local --strip-components=1
npm install --global pnpm@10 pm2@6
id manar >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/manar --shell /usr/sbin/nologin manar
# Wait for any old updater before switching process managers.
for legacy in manar manaar; do
  systemctl disable --now "$legacy-update.timer" 2>/dev/null || true
  if [[ -d /opt/$legacy ]]; then
    flock "/opt/$legacy/update.lock" true
  fi
  systemctl disable --now "$legacy.service" 2>/dev/null || true
done
# Preserve the old deployment's data when migrating the previous spelling.
if [[ ! -d /opt/manar/shared && -d /opt/manaar/shared ]]; then
  cp -a /opt/manaar/shared /opt/manar/shared
  chown -R manar:manar /opt/manar/shared
fi
install -d -o manar -g manar /opt/manar/releases /opt/manar/shared/data /opt/manar/shared/static/uploads
chown manar:manar /opt/manar
chmod 755 /opt/manar /opt/manar/shared /opt/manar/shared/static /opt/manar/shared/static/uploads
install -m 755 "$source_dir/update.sh" /usr/local/bin/manar-update
install -m 755 "$source_dir/display.sh" /usr/local/bin/manar-display
install -m 755 "$source_dir/browser.sh" /usr/local/bin/manar-browser
install -m 755 "$source_dir/kiosk.sh" /usr/local/bin/manar-kiosk
if [[ ! -f /etc/manar.conf ]]; then
  cat > /etc/manar.conf <<'EOF'
REPOSITORY=https://github.com/septiandch/manar.git
# Empty means the default branch recorded when the repository is first cloned.
BRANCH=
EOF
fi
# A stable wrapper resolves the active release afresh on every PM2 restart.
cat > /usr/local/bin/manar-server <<'EOF'
#!/usr/bin/env bash
set -e
cd /opt/manar/current
if [[ -f server.mjs && -f /opt/manar/shared/mirror.env ]]; then
  exec /usr/local/bin/node --env-file=/opt/manar/shared/mirror.env server.mjs
fi
exec /usr/local/bin/node build/index.js
EOF
chmod 755 /usr/local/bin/manar-server
install -m 644 "$source_dir/ecosystem.config.cjs" /opt/manar/ecosystem.config.cjs
pm2 startup systemd -u manar --hp /opt/manar
cat > /etc/systemd/system/manar-update.service <<'EOF'
[Unit]
Description=Build and deploy Manar updates
Wants=network-online.target
After=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/bin/manar-update
TimeoutStartSec=2h
EOF
cat > /etc/systemd/system/manar-update.timer <<'EOF'
[Unit]
Description=Check Manar Git repository daily
[Timer]
OnCalendar=*-*-* 03:00:00
RandomizedDelaySec=15m
Persistent=true
[Install]
WantedBy=timers.target
EOF
cat > /etc/nginx/conf.d/manar.conf <<'EOF'
server {
    listen 0.0.0.0:5000;
    server_name localhost;
    client_max_body_size 210m;
    location /uploads/ {
        alias /opt/manar/shared/static/uploads/;
        add_header Cache-Control "no-cache";
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 24h;
    }
}
EOF
# Retire the old nginx listener if present; keep its configuration as a backup.
if [[ -f /etc/nginx/conf.d/manaar.conf ]]; then
  mv /etc/nginx/conf.d/manaar.conf /etc/nginx/conf.d/manaar.conf.disabled
fi
nginx -t
systemctl daemon-reload
/usr/local/bin/manar-update
runuser -u manar -- env HOME=/opt/manar PM2_HOME=/opt/manar/.pm2 pm2 startOrRestart /opt/manar/ecosystem.config.cjs --update-env
runuser -u manar -- env HOME=/opt/manar PM2_HOME=/opt/manar/.pm2 pm2 save
systemctl enable pm2-manar.service nginx.service manar-update.timer
systemctl restart nginx.service
systemctl start manar-update.timer
# Restore the normal desktop, including its panel and window management.
for legacy in manar manaar; do
  old_config=/etc/lightdm/lightdm.conf.d/99-$legacy.conf
  if [[ -f $old_config ]]; then mv "$old_config" "$old_config.disabled"; fi
done
install -d /etc/lightdm/lightdm.conf.d
cat > /etc/lightdm/lightdm.conf.d/99-manar-desktop.conf <<EOF
[Seat:*]
autologin-user=$desktop_user
autologin-user-timeout=0
autologin-session=$desktop_session
user-session=$desktop_session
EOF
systemctl set-default graphical.target
systemctl enable lightdm
# Remove only the HDMI overrides inserted by the previous installer.
cmdline=/boot/firmware/cmdline.txt
[[ -f $cmdline ]] || cmdline=/boot/cmdline.txt
if [[ -f $cmdline.manar-backup || -f $cmdline.manaar-backup ]]; then
  [[ -f $cmdline.before-manar-desktop ]] || cp "$cmdline" "$cmdline.before-manar-desktop"
  python3 - "$cmdline" <<'PYCODE'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
overrides = {'video=HDMI-A-1:1920x1080M@60D', 'video=HDMI-A-2:1920x1080M@60D'}
p.write_text(' '.join(t for t in p.read_text().split() if t not in overrides) + '\n')
PYCODE
fi
install -d -o "$desktop_user" -g "$desktop_group" "$desktop_home/.config" "$desktop_home/.config/autostart"
cat > "$desktop_home/.config/autostart/manar.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Manar display
Exec=/usr/local/bin/manar-browser
Terminal=false
X-GNOME-Autostart-enabled=true
EOF
chown "$desktop_user:$desktop_group" "$desktop_home/.config/autostart/manar.desktop"
curl --fail --retry 10 --retry-connrefused --retry-delay 2 http://localhost:5000/ -o /dev/null
echo 'Setup complete. Reboot with: sudo reboot'
echo 'On another device use http://PI-IP:5000 (find the IP with hostname -I).'
