# Raspberry Pi: PM2 server and fullscreen desktop browser

Manar runs under PM2 and is available on the Pi and other devices on the same
local network. Chromium starts as an ordinary fullscreen window on the normal
Raspberry Pi desktop. There is no dedicated kiosk session. On Wayland, enabled HDMI outputs are set to
1920x1080 before Chromium opens.

## 1. Prepare the Pi

Use **64-bit Raspberry Pi OS Desktop with LightDM**, an HDMI display, internet
access, and a normal desktop user with sudo permission. Lite is unsupported.
Install the OS with [Raspberry Pi Imager](https://www.raspberrypi.com/software/),
setting a username/password, Wi-Fi, timezone, and SSH access. Imaging erases the
selected storage. Follow the [official OS guide](https://www.raspberrypi.com/documentation/computers/getting-started.html).

Run on the Pi, in Terminal or over SSH:

```sh
uname -m
sudo apt-get update
sudo apt-get full-upgrade -y
sudo apt-get install -y git
sudo timedatectl set-timezone Asia/Jakarta
sudo timedatectl set-ntp true
sudo reboot
```

`uname -m` must report `aarch64`. Use the mosque's actual timezone. Reconnect after
reboot and verify `timedatectl`. If apt reports a lock held by another process,
let that package operation finish and retry; do not delete the lock.

## 2. Download and install

```sh
cd ~
git clone https://github.com/septiandch/manar.git
cd ~/manar
sudo bash scripts/raspberry-pi/setup.sh
```

For an existing checkout, enter it and run `git pull --ff-only` instead of cloning
again. Run setup through sudo from the desktop user, not a root login. The
installer deploys the remote repository's branch, so push intended app changes
before installing. Private repositories need noninteractive read credentials for
the `manar` service account, independently of your desktop user's Git credentials.

Setup installs Node 22, pnpm 10, PM2 6, nginx, and Chromium. It uses a separate
`manar` service account for PM2, builds the app under `/opt/manar/releases`, and
configures nginx on IPv4 port 5000. The Node backend listens only on loopback port 3000. nginx serves writable uploads and supplies the host/protocol headers so
forms work from both localhost and the Pi's LAN address.

PM2's startup service restores the saved app at boot. The normal Raspberry Pi
desktop session logs in automatically and uses an XDG autostart entry to run
`manar-browser`. This waits for the server, then opens Chromium fullscreen.

## 3. Migrate an existing installation

The same setup command replaces the previous Manar systemd/kiosk deployment.
Before running it, back up settings and media and allow any running update to
finish. Setup briefly interrupts hosting while changing process managers.

```sh
sudo systemctl stop manar-update.timer
sudo systemctl stop manaar-update.timer
```

A missing unit for one spelling is normal. Check the corresponding update service
is inactive before backing up. For an existing `/opt/manar` installation:

```sh
sudo systemctl stop manar.service
sudo tar -czf "$HOME/manar-before-pm2.tar.gz" -C /opt/manar/shared data static/uploads
```

For the older `/opt/manaar` spelling, use its service name and shared directory.
Setup preserves `/opt/manar/shared`. If only `/opt/manaar/shared` exists, it copies
that data into the new location and leaves the old copy intact. If both exist,
it uses `/opt/manar/shared`; reconcile your data before setup if necessary.

From the updated checkout, run:

```sh
sudo bash scripts/raspberry-pi/setup.sh
```

The installer disables old `manar`/`manaar` app services and update timers, retires
the old LightDM kiosk configuration, and configures the normal desktop session.
It removes only the HDMI overrides the previous installer inserted. The new
updater uses PM2 and the daily `manar-update.timer` is enabled again.

If you have an unrelated older app in your desktop user's PM2 list, inspect
`pm2 list` and stop/delete only that app if it occupies ports 3000 or 5000. Save
that user's process list with `pm2 save` (use `--force` for an empty list).
Disable any old browser autostart you previously configured separately; setup
only manages Manar's own files. Other PM2 applications are left in place.

## 4. Verify local and Wi-Fi access

```sh
sudo -u manar -H /usr/local/bin/pm2 list
curl --fail http://localhost:5000/ -o /dev/null
hostname -I
```

PM2 should show `manar` online. Use `http://localhost:5000/` on the Pi. On another
device on the same Wi-Fi, replace localhost with the Pi's IPv4 address, for example:

- `http://192.168.1.50:5000/` for the display.
- `http://192.168.1.50:5000/config` for mosque details and prayer timings.
- `http://192.168.1.50:5000/upload` for images/videos.

Use HTTP and include port 5000. No SSH tunnel is needed. Settings and uploads have
no authentication, so use this on a trusted LAN. nginx and Node allow 210 MiB
requests to accommodate the API's 200 MiB file limit plus multipart overhead.

If local access works but another device cannot connect, check:

```sh
sudo ss -ltnp | grep ':5000'
```

It should show `0.0.0.0:5000`. Confirm the IP, that both devices share a LAN, and
that guest Wi-Fi/client isolation is disabled. If you use a firewall, allow TCP
5000 from your LAN subnet. A router DHCP reservation helps keep the address stable.

## 5. Reboot and use the display

After setup reports `Setup complete`:

```sh
sudo reboot
```

The normal desktop starts and Chromium opens fullscreen. Press **F11** to leave
fullscreen or **Alt+F4** to close it. PM2 keeps serving the app even if the browser
is closed. Reopen with `manar-browser` in a graphical desktop terminal; do not run
the browser with sudo or directly from an SSH/text-console session.

### Automatic HDMI resolution

At desktop login, `manar-browser` runs `manar-display` before opening Chromium.
It detects enabled HDMI outputs such as `HDMI-A-1` and `HDMI-A-2` using
`wlr-randr`, then requests 1920x1080, scale 1, and landscape orientation for each.
Disabled HDMI outputs and non-HDMI displays are left alone. An advertised 1080p
mode is preferred; otherwise it tries a custom 1920x1080 at 60 Hz mode. The screen
must physically support that signal. X11 sessions retain their desktop settings.

For an existing installation, once the updated scripts are on the Pi, run from
the checkout:

```sh
sudo apt-get install -y wlr-randr
sudo install -m 755 scripts/raspberry-pi/display.sh /usr/local/bin/manar-display
sudo install -m 755 scripts/raspberry-pi/browser.sh /usr/local/bin/manar-browser
sudo reboot
```

A full setup rerun installs these automatically too. To try the resolution without
rebooting, run `manar-display` as your normal user in a graphical desktop terminal.
Do not run it with sudo or directly over SSH. Startup output is captured in
`~/.local/state/manar/browser.log`. Failure is logged and Chromium still opens.
The script runs at browser startup, not continuously on HDMI hotplug; desktop
profile managers may subsequently override it.

To disable forcing, run `sudo chmod -x /usr/local/bin/manar-display` and reboot,
then use desktop display settings if needed. Rerunning setup reenables it.
See the [wlr-randr manual](https://manpages.debian.org/trixie/wlr-randr/wlr-randr.1.en.html).

Keep `?debug` out of the display URL to use the real clock.

## 6. PM2 management and updates

Manar's PM2 daemon belongs to the `manar` service account. A plain `pm2 list`
under your desktop user shows a different process list. Use:

```sh
sudo -u manar -H /usr/local/bin/pm2 list
sudo -u manar -H /usr/local/bin/pm2 logs manar --lines 50 --nostream
sudo -u manar -H /usr/local/bin/pm2 restart manar
systemctl status pm2-manar.service nginx.service
```

Updates check Git at 03:00 local time, with up to 15 minutes of random delay.
The updater builds and smoke-tests a separate release, switches the current
symlink, and restarts the PM2 app. Failed activation rolls back to the previous
release. Persistent data is not rolled back. Refresh the browser after a code
update to load the new frontend; the browser is not forcibly restarted.

```sh
sudo systemctl start manar-update.service
journalctl -u manar-update.service -n 100 --no-pager
systemctl list-timers manar-update.timer
```

Edit `/etc/manar.conf` to set the Git `REPOSITORY` and `BRANCH`. An empty branch
uses the default recorded at the initial clone. Daily updates do not update OS
packages or deployment scripts; pull your checkout and rerun setup for those
script changes. Setup reenables the daily timer. Disable it if desired with:

```sh
sudo systemctl disable --now manar-update.timer
```

## 7. Storage and backups

| Path                                | Purpose                        |
| ----------------------------------- | ------------------------------ |
| `/opt/manar/shared/data`            | Mosque settings                |
| `/opt/manar/shared/static/uploads`  | Media, logos, and ordering     |
| `/opt/manar/releases`               | Built releases                 |
| `/opt/manar/current`                | Active release symlink         |
| `/opt/manar/.pm2`                   | PM2 state and server logs      |
| `/opt/manar/ecosystem.config.cjs`   | PM2 application definition     |
| `/etc/manar.conf`                   | Update repository and branch   |
| `~/.config/autostart/manar.desktop` | Desktop user's browser startup |

To back up, stop the update timer, wait for any active update to finish, then:

```sh
sudo -u manar -H /usr/local/bin/pm2 stop manar
sudo tar -czf "$HOME/manar-data-$(date +%Y%m%d-%H%M%S).tar.gz" -C /opt/manar/shared data static/uploads
sudo -u manar -H /usr/local/bin/pm2 restart manar
```

Copy the archive off the Pi and restart the timer if previously enabled. Monitor
space with `df -h /opt/manar`; old releases are retained. Keep the active and
previous working release when cleaning up.

## Troubleshooting

### Chromium still appears to use the old resolution

Press Ctrl+0 in Chromium to reset page zoom to 100%. At 75% zoom, a 1920-pixel
screen can expose a 2560-CSS-pixel page viewport even though HDMI is correctly
set to 1080p. Press F11 twice if the fullscreen window needs resizing.

The launcher uses native Wayland when available, so Chromium receives the
compositor's output size and scale directly. It requests a 1920x1080 initial
window and disables background mode so closing all Manar browser windows can
fully end the browser process. Fullscreen dimensions still follow the compositor;
the window-size flag does not set the monitor resolution or reset saved page zoom.

After copying the updated files to the Pi, install the launcher and reboot:

```sh
sudo install -m 755 scripts/raspberry-pi/browser.sh /usr/local/bin/manar-browser
sudo reboot
```

If the mismatch remains after Ctrl+0, inspect `wlr-randr` in a desktop terminal
and check the current mode and scale. A desktop display profile may have changed
them after startup. In Chromium's DevTools console, compare `screen.width`,
`screen.height`, `innerWidth`, `innerHeight`, and `devicePixelRatio` to distinguish
physical output settings from browser zoom/window sizing.

### Restore pages prompt after startup

The launcher includes `--hide-crash-restore-bubble` to suppress Chromium's
"Restore pages?" prompt after an unclean shutdown. Once the updated files are on
the Pi, run from the project checkout:

```sh
sudo install -m 755 scripts/raspberry-pi/browser.sh /usr/local/bin/manar-browser
sudo reboot
```

This applies to Manar's browser launcher; other Chromium startup entries need
their own flag. It hides the recovery prompt without deleting the browser profile.

### Small browser window or keyring prompt

The launcher requests both maximized and fullscreen startup and uses
`--password-store=basic` for its dedicated Manar browser profile. This avoids
Chromium requesting the desktop keyring; do not store passwords in this profile,
as basic storage does not provide keyring protection. Other browser profiles
are unchanged. See [Chromium password storage](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/password_storage.md).

After downloading the updated scripts, install only the browser launcher:

```sh
sudo install -m 755 scripts/raspberry-pi/browser.sh /usr/local/bin/manar-browser
```

Close the existing Manar Chromium window with Alt+F4, then run `manar-browser`
from a graphical desktop terminal, or reboot. An already running browser profile
may reuse its existing window and ignore startup flags. If the window is still
small, focus Chromium and press F11 to enter fullscreen. This does not require
reinstalling PM2 or changing the display resolution.

For browser errors, as the desktop user:

```sh
tail -n 50 "${XDG_STATE_HOME:-$HOME/.local/state}/manar/browser.log"
cat ~/.config/autostart/manar.desktop
pgrep -af 'labwc|lxsession|manar-browser|chromium'
```

If the desktop has no panel, verify that `/etc/lightdm/lightdm.conf.d/99-manar-desktop.conf`
selects an installed normal desktop session, not `manar` or `manaar`. Custom user
labwc autostart files may override the desktop's default panel startup; inspect
those if you had customised your previous fullscreen setup. Inspect login errors:

```sh
sudo journalctl --unit=lightdm.service --boot=0 --lines=50 --no-pager
```

If hosting fails, inspect PM2 logs and `sudo nginx -t`. To identify port conflicts,
use `sudo ss -ltnp`. Actual desktop login, fullscreen startup, and access from a
second Wi-Fi device must be verified on the Pi; they cannot be verified on Windows.

References: [PM2 boot startup](https://pm2.keymetrics.io/docs/usage/startup/),
[SvelteKit proxy headers](https://svelte.dev/docs/kit/adapter-node), and
[Raspberry Pi desktop autostart](https://github.com/raspberrypi-ui/raspberrypi-ui-mods/blob/master/etc/xdg/labwc/autostart).

## LAN screen casting setup

After committing and pushing the changes, update the checkout on the Pi and deploy the application:

```sh
cd ~/manar
 git pull --ff-only
sudo install -m 755 scripts/raspberry-pi/update.sh /usr/local/bin/manar-update
sudo systemctl start manar-update.service
sudo journalctl -u manar-update.service -n 80 --no-pager
sudo bash scripts/raspberry-pi/setup-casting.sh 192.168.1.50
```

Replace the IP with the Pi's reserved LAN IPv4 address. The casting installer requires the existing PM2 installation and a deployed release containing server.mjs. It installs mkcert/nginx, preserves generated secrets in /opt/manar/shared/mirror.env (mode 600), switches the PM2 launcher to server.mjs, adds HTTPS on port 443 and WebSocket forwarding, and preserves the HTTP listener on port 5000. It does not change firewall rules or router settings. Allow LAN TCP 443 and LAN WebRTC traffic; do not expose this installation to the internet.

Install /opt/manar/shared/casting-rootCA.crt as a trusted root on the laptop and TV. On Windows use the certificate import wizard and Trusted Root Certification Authorities, then restart the browser. Android TV certificate installation varies; if unsupported, use a domain you own and a publicly trusted certificate instead. Do not disable certificate checking. Keep /etc/manar/casting/ca/rootCA-key.pem private. Reserve the Pi IP in your router; rerun setup-casting.sh if it changes or before the server certificate expires (inspect with openssl x509 -in /etc/manar/casting/server.pem -noout -dates). Renewal is manual.

Read the display secret locally using sudo cat /opt/manar/shared/mirror.env. Open https://PI-IP/display?displayToken=DISPLAY_SECRET once in the TV browser, then remove the query from its address. Enroll the Pi's own Chromium the same way if used as a receiver; its default HTTP localhost profile has separate localStorage from HTTPS. Open https://PI-IP/connect on the laptop and enter the TV code. Any paired sender controls the installation's enrolled displays. HTTPS trust and display enrollment are the two manual steps that cannot safely be provisioned remotely by this script.

The local basic-ssl Vite plugin is for development; it is not used by this production installer. The main setup.sh retains casting support when rerun if mirror.env exists, but an existing custom nginx HTTPS listener may conflict with port 443. Review nginx -t output and existing HTTPS configuration in that case. The installer backs up its own previous nginx configuration; it does not rewrite other HTTPS configurations.

## When automatic updates appear to do nothing

The timer checks daily at 03:00 plus up to 15 minutes of delay; it deploys the remote branch in /etc/manar.conf, not the checkout you edit. Changes must be committed and pushed first. Use:

```sh
sudo cat /etc/manar.conf
systemctl list-timers manar-update.timer
sudo systemctl start manar-update.service
sudo journalctl -u manar-update.service -n 100 --no-pager
cat /opt/manar/shared/version
curl --fail http://localhost:5000/api/version
sudo -u manar -H /usr/local/bin/pm2 logs manar --lines 50 --nostream
```

The updater now reports its selected remote branch and target commit, smoke-tests the custom server when present, and verifies the live version after activation. Failed install/build/health checks retain or restore the previous release. Update the installed /usr/local/bin/manar-update explicitly with the command above: editing the checkout does not replace that installed copy automatically.

Previously open display pages only refreshed configuration after deployment, leaving old application JavaScript running. New display pages check /api/version every 30 seconds and reload on a changed release, including after server reconnection. This is a deployment reload, not a normal casting transition. Admin pages do not auto-reload to avoid losing edits. Pages loaded before this change need one manual reload. A release reload interrupts an active casting connection.

Validation on a Pi: confirm version equals the pushed commit, change and push a visible display detail, invoke the update service, and verify the browser updates within 30 seconds. Verify failed candidate builds preserve the previous version. Run the casting installer twice and confirm secrets remain unchanged, then test two TVs, sender stop/refresh/Wi-Fi loss, and browser certificate trust. Pi provisioning and hardware tests have not been run in the Windows development workspace.

## Single-command HTTPS installation (recommended)

On 64-bit Raspberry Pi OS Desktop, from your desktop user in the up-to-date checkout:

```sh
sudo bash scripts/raspberry-pi/setup.sh
```

The script detects the LAN IPv4 address. To specify it explicitly:

```sh
sudo bash scripts/raspberry-pi/setup.sh 192.168.1.50
```

Commit and push your application changes first: installation deploys the remote repository and branch configured in /etc/manar.conf, not uncommitted local files. Requires internet during installation and a desktop user invoking sudo. Existing media/configuration are preserved. The existing desktop autologin, PM2, nginx, Node, pnpm and daily updater are installed through setup.sh. Casting setup then creates persistent random tokens, HTTPS certificates, WebSocket proxying, and enrolls the Pi desktop browser. Reboot after completion. Re-running preserves tokens and the CA, and regenerates the server certificate for the supplied IP; reserve that IP on the router. Certificate renewal remains manual by rerunning setup-casting.sh before expiry.

On a laptop, obtain /opt/manar/shared/casting-rootCA.crt from the Pi (also available at https://PI-IP/casting-rootCA.crt after HTTPS trust has been configured). Verify the certificate came from your Pi, import it as a trusted root, and restart the browser. On Windows use Install Certificate, Current User, Trusted Root Certification Authorities. Copying via SSH avoids needing an already trusted HTTPS connection to get the certificate. Never copy the CA private key. Then open https://PI-IP/connect, enter the digits that appear on the Pi display, and click Start Mirroring. No manual tokens are needed for the Pi's own display or laptop pairing.

External Android TV receivers still require their own certificate trust and one-time enrollment using the display token in /opt/manar/shared/mirror.env. TV models without certificate installation need a publicly trusted certificate/domain setup instead. Nothing here bypasses screen-sharing permission prompts. The installer does not configure routers/firewalls, run on Lite/32-bit OS, or automatically trust remote devices.

Private display startup settings are in the desktop user's ~/.config/manar/display.env (mode 600). Chromium opens trusted https://localhost/display automatically; existing HTTP port 5000 remains available for compatibility. Close any existing Chromium process using the Manar profile before reopening the browser after installation. Use the printed LAN HTTPS URL on the laptop, not localhost.

Installer syntax was checked in development. Actual apt/systemd/nginx/Chromium provisioning requires validation on a Raspberry Pi; it has not been executed on the Windows development machine.

## Navigation and display URL

The root `/` is now the main menu. Use `/display` for the full-screen TV view, `/connect` to pair a laptop, `/config` for settings, and `/upload` for media. `/admin/mirror` contains the screen-sharing controls after pairing.

The single-command installer launches the Pi at `https://localhost/display` and enrolls it automatically. Existing startup files containing the old localhost root URL are migrated by the updated browser launcher. Run the installer again after deploying this version to install the updated launcher, then close/reopen Chromium or reboot. Existing browsers on `/` need to navigate to `/display` once; the root is intentionally no longer the display. External TV enrollment uses `https://PI-IP/display?displayToken=TOKEN`. Tokens in localStorage remain valid because the origin has not changed. No data or prayer configuration migration is required.

### Pembaruan installer dengan satu perintah

`sudo bash scripts/raspberry-pi/setup.sh [IP-PI]` kini menjalankan `git pull --ff-only` pada checkout sebagai akun desktop pemilik checkout, kemudian menjalankan ulang installer versi terbaru. Branch checkout harus memiliki upstream dan tidak boleh ada perubahan lokal/berkas baru yang belum disimpan ke Git. Installer tidak melakukan reset, menghapus perubahan, atau berpindah branch secara otomatis. Aplikasi produksi tetap diperbarui dari repositori/branch di `/etc/manar.conf`, yang bisa berbeda dari branch checkout installer.

Untuk memperoleh versi installer ini pertama kali, lakukan `git pull --ff-only` satu kali setelah perubahan dipush. Sesudahnya cukup jalankan setup.sh. Installer mengonfigurasi ulang layanan dan dapat menghentikan casting yang sedang berlangsung; reboot tetap dilakukan manual setelah sukses. Pemeriksaan sintaks berhasil; eksekusi provisioning harus diuji pada Pi.

## Perintah utama: setup.sh

Mulai versi ini, gunakan hanya satu perintah untuk instalasi awal maupun pembaruan lengkap:

```sh
sudo bash scripts/raspberry-pi/setup.sh
```

Opsional, tetapkan IP LAN:

```sh
sudo bash scripts/raspberry-pi/setup.sh 192.168.1.8
```

Alurnya: periksa checkout Git, `git pull --ff-only`, jalankan ulang setup terbaru, pasang dependensi sistem, ambil dan build aplikasi produksi, aktifkan PM2 dan updater harian, siapkan HTTPS dan token casting, daftarkan browser Pi, serta nonaktifkan popup terjemahan. Token dan data lama dipertahankan. Setelah sukses, reboot manual. Perubahan lokal menyebabkan setup berhenti tanpa menghapus berkas.

`setup-system.sh` dan `setup-casting.sh` adalah skrip internal yang dipanggil otomatis. `install.sh` hanya alias kompatibilitas menuju `setup.sh`; tidak perlu dijalankan terpisah. Untuk memperoleh versi setup ini pertama kali pada instalasi lama, lakukan `git pull --ff-only` sekali setelah perubahan dipush. Selanjutnya setup.sh sendiri mengambil pembaruan. Sertifikat lokal tetap perlu dipercaya sekali pada laptop atau TV eksternal.

### Fullscreen saat startup

Launcher terbaru menggunakan Chromium `--kiosk --start-fullscreen` dan profil Manar khusus. Ini tetap memakai desktop Raspberry Pi normal, tetapi jendela display tidak menampilkan toolbar/tab. Keluar dengan Alt+F4; F11 tidak dijadikan cara keluar yang dijamin pada mode kiosk. Server tetap berjalan saat browser ditutup.

Setelah memperbarui launcher melalui setup.sh, reboot agar proses Chromium lama tidak mempertahankan mode jendelanya. Untuk menerapkan perubahan launcher saja pada instalasi yang sudah lengkap, jalankan `sudo install -m 755 scripts/raspberry-pi/browser.sh /usr/local/bin/manar-browser` dari checkout terbaru, lalu reboot. Pemeriksaan launcher: `grep -- --kiosk /usr/local/bin/manar-browser`. Jika masih tidak fullscreen, periksa `~/.config/autostart/manar.desktop` dan `~/.local/state/manar/browser.log`; mungkin ada launcher lain yang membuka jendela Chromium berbeda. Perilaku compositor dan startup perlu diuji langsung pada Pi.
