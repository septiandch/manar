#!/usr/bin/env bash
# Disable Chromium translation prompts on the Raspberry Pi display.
set -Eeuo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

if [[ $EUID != 0 ]]; then
  echo 'Jalankan: sudo bash scripts/raspberry-pi/disable-translate.sh' >&2
  exit 1
fi

policy_dir=/etc/chromium/policies/managed
policy_file="$policy_dir/manar-translate.json"
install -d -m 755 "$policy_dir"
if [[ -f $policy_file ]] && ! cmp -s "$policy_file" <(printf '{"TranslateEnabled":false}\n'); then
  cp -a "$policy_file" "$policy_file.backup"
fi
printf '{"TranslateEnabled":false}\n' > "$policy_file"
chmod 644 "$policy_file"
chown root:root "$policy_file"

echo 'Selesai. Google Translate dinonaktifkan untuk Chromium di Raspberry Pi ini.'
echo 'Tutup seluruh jendela Chromium lalu buka kembali, atau jalankan: sudo reboot'
echo 'Untuk memeriksa, buka chrome://policy dan pastikan TranslateEnabled bernilai false.'
