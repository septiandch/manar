#!/usr/bin/env bash
# Dedicated community display: automatic login and no idle screen locking.
set -Eeuo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
[[ $EUID == 0 ]] || { echo 'Jalankan melalui sudo dari akun desktop Pi.' >&2; exit 1; }
desktop_user=${MANAR_DESKTOP_USER:-${SUDO_USER:-}}
[[ -n $desktop_user && $desktop_user != root ]] || { echo 'Akun desktop tidak ditemukan.' >&2; exit 1; }
desktop_home=$(getent passwd "$desktop_user" | cut -d: -f6)
[[ -d $desktop_home && -d /etc/lightdm ]] || { echo 'Memerlukan Raspberry Pi OS Desktop dengan LightDM.' >&2; exit 1; }
install -d /etc/lightdm/lightdm.conf.d
cat > /etc/lightdm/lightdm.conf.d/99-manar-autologin.conf <<EOF
[Seat:*]
autologin-user=$desktop_user
autologin-user-timeout=0
EOF
# Raspberry Pi's supported screen-blanking configuration (1 means disabled).
raspi-config nonint do_blanking 1
python3 - "$desktop_home" "$(id -u "$desktop_user")" "$(id -g "$desktop_user")" <<'PY'
import pathlib,re,sys,shutil,os
home=pathlib.Path(sys.argv[1]);uid=int(sys.argv[2]);gid=int(sys.argv[3])
lockers=re.compile(r'\b(swayidle|swaylock|waylock|light-locker|xscreensaver|xss-lock|lxlock)\b')
autostart=home/'.config/autostart';autostart.mkdir(parents=True,exist_ok=True)
os.chown(autostart,uid,gid)
# Override only known idle/locker autostart entries for the display account.
for folder in [pathlib.Path('/etc/xdg/autostart'),autostart]:
 for entry in list(folder.glob('*.desktop')):
  text=entry.read_text()
  if not any(line.startswith('Exec=') and lockers.search(line) for line in text.splitlines()):continue
  target=autostart/entry.name
  if target.exists() and not pathlib.Path(str(target)+'.manar-backup').exists():shutil.copy2(target,str(target)+'.manar-backup')
  text=re.sub(r'^Hidden=.*\n?','',text,flags=re.M)
  text=text.replace('[Desktop Entry]','[Desktop Entry]\nHidden=true',1)
  target.write_text(text);os.chown(target,uid,gid)
# Disable complete shell commands, including continued swayidle commands.
for name in ['.config/labwc/autostart','.config/lxsession/LXDE-pi/autostart']:
 path=home/name
 if not path.exists():continue
 lines=path.read_text().splitlines(keepends=True);result=[];continued=False
 for line in lines:
  disable=continued or (not line.lstrip().startswith('#') and bool(lockers.match(line.lstrip().lstrip('@'))))
  continued=disable and line.rstrip().endswith('\\')
  result.append('# Manar: '+line if disable else line)
 if result!=lines:
  backup=pathlib.Path(str(path)+'.manar-backup')
  if not backup.exists():shutil.copy2(path,backup)
  path.write_text(''.join(result));os.chown(path,uid,gid)
PY
echo 'Login otomatis aktif dan penguncian idle standar dinonaktifkan untuk akun display.'
echo 'Reboot untuk menerapkan. Jika layar login tetap muncul saat HDMI dipasang, periksa log LightDM/compositor karena sesi mungkin terhenti.'
