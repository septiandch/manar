#!/usr/bin/env bash
set -Eeuo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
[[ $EUID == 0 ]] || { echo 'Run: sudo bash scripts/raspberry-pi/setup-casting.sh PI-IP'; exit 1; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
address=${1:?Provide the Raspberry Pi LAN IPv4 address}
python3 - "$address" <<'PY'
import ipaddress,sys
assert isinstance(ipaddress.ip_address(sys.argv[1]),ipaddress.IPv4Address)
PY
[[ -f /opt/manar/current/server.mjs ]] || { echo 'Deploy a release containing server.mjs first using manar-update.'; exit 1; }
# Serialize against deployment and preserve credentials across releases/reruns.
exec 9>/opt/manar/update.lock
flock 9
apt-get update
apt-get install -y nginx mkcert libnss3-tools
install -d -m 700 /etc/manar/casting
install -d -o manar -g manar /opt/manar/shared
if [[ ! -f /opt/manar/shared/mirror.env ]]; then
 umask 077
 node --input-type=module -e 'import {randomBytes} from "node:crypto";for(const key of ["MIRROR_ADMIN_TOKEN","MIRROR_DISPLAY_TOKEN"])console.log(`${key}=${randomBytes(32).toString("hex")}`)' > /opt/manar/shared/mirror.env
fi
chown manar:manar /opt/manar/shared/mirror.env
chmod 600 /opt/manar/shared/mirror.env
export CAROOT=/etc/manar/casting/ca
mkcert -install
mkcert -cert-file /etc/manar/casting/server.pem -key-file /etc/manar/casting/server-key.pem "$address" localhost 127.0.0.1
chmod 600 /etc/manar/casting/server-key.pem
# Preserve the public CA in a location the desktop administrator can copy.
install -m 644 "$CAROOT/rootCA.pem" /opt/manar/shared/casting-rootCA.crt
cat > /usr/local/bin/manar-server <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/manar/current
exec /usr/local/bin/node --env-file=/opt/manar/shared/mirror.env server.mjs
EOF
chmod 755 /usr/local/bin/manar-server
install -m 755 "$source_dir/update.sh" /usr/local/bin/manar-update
if [[ -f /etc/nginx/conf.d/manar-casting.conf ]]; then
 cp -a /etc/nginx/conf.d/manar-casting.conf /etc/nginx/conf.d/manar-casting.conf.backup
fi
cat > /etc/nginx/conf.d/manar-casting.conf <<'EOF'
server {
 listen 443 ssl;
 server_name _;
 ssl_certificate /etc/manar/casting/server.pem;
 ssl_certificate_key /etc/manar/casting/server-key.pem;
 client_max_body_size 210m;
 location = /casting-rootCA.crt {
  alias /opt/manar/shared/casting-rootCA.crt;
  default_type application/x-x509-ca-cert;
 }
 location /uploads/ {
  alias /opt/manar/shared/static/uploads/;
  add_header Cache-Control "no-cache";
 }
 location /mirror-ws {
  access_log off;
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $http_host;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 24h;
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
nginx -t
runuser -u manar -- env HOME=/opt/manar PM2_HOME=/opt/manar/.pm2 pm2 startOrRestart /opt/manar/ecosystem.config.cjs --update-env
runuser -u manar -- env HOME=/opt/manar PM2_HOME=/opt/manar/.pm2 pm2 save
systemctl reload nginx
curl --fail --cacert "$CAROOT/rootCA.pem" "https://$address/api/version"
echo
printf 'Casting configured. Install /opt/manar/shared/casting-rootCA.crt as a trusted root on the laptop and TV.\n'
printf 'Then open https://%s/connect on the laptop.\n' "$address"
printf 'For one-time TV enrollment, read MIRROR_DISPLAY_TOKEN with sudo cat /opt/manar/shared/mirror.env and open https://%s/display?displayToken=TOKEN\n' "$address"
printf 'Keep the private CA key in /etc/manar/casting/ca private. Rerun with the new IP if the Pi address changes.\n'

# Enroll the Pi desktop browser without manual token entry. Preserve secrets on rerun.
desktop_user=${SUDO_USER:-}
if [[ -n $desktop_user && $desktop_user != root ]]; then
 desktop_home=$(getent passwd "$desktop_user" | cut -d: -f6)
 desktop_group=$(id -gn "$desktop_user")
 install -d -o "$desktop_user" -g "$desktop_group" -m 700 "$desktop_home/.config/manar"
 node --env-file=/opt/manar/shared/mirror.env --input-type=module -e 'console.log("MANAR_DISPLAY_URL=https://localhost/display?displayToken="+process.env.MIRROR_DISPLAY_TOKEN)' > "$desktop_home/.config/manar/display.env"
 chown "$desktop_user:$desktop_group" "$desktop_home/.config/manar/display.env"
 chmod 600 "$desktop_home/.config/manar/display.env"
 # Chromium on Linux uses the desktop user's NSS trust database.
 install -d -o "$desktop_user" -g "$desktop_group" "$desktop_home/.pki" "$desktop_home/.pki/nssdb"
 if [[ ! -f $desktop_home/.pki/nssdb/cert9.db ]]; then
  runuser -u "$desktop_user" -- env HOME="$desktop_home" certutil -N --empty-password -d "sql:$desktop_home/.pki/nssdb"
 fi
 runuser -u "$desktop_user" -- env HOME="$desktop_home" certutil -A -d "sql:$desktop_home/.pki/nssdb" -n 'Manar LAN casting CA' -t 'C,,' -i /opt/manar/shared/casting-rootCA.crt
 install -m 755 "$source_dir/browser.sh" /usr/local/bin/manar-browser
 echo 'Pi desktop browser enrolled automatically. Close Chromium and reopen it, or reboot.'
fi
