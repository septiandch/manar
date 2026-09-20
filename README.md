# Manar

A mosque prayer display built with Svelte 5, SvelteKit, TypeScript, and Tailwind CSS. Designed for a landscape screen or TV, it combines a daily prayer schedule, a clock and Hijri date, announcement media, and prayer countdown overlays.

## Getting started

Use Node.js 22.18 or newer in the Node 22 release line, and pnpm. The repository includes `pnpm-lock.yaml`.

```sh
pnpm install
pnpm dev
```

The development server opens at `http://localhost:5000` and listens on network interfaces for access from another device.

1. Open `/config`, enter the mosque title, subtitle, coordinates, and timing preferences, then save.
2. Open `/upload` to add and arrange announcement images or videos.
3. Open `/` on the display device and enable the browser's fullscreen mode.

Set the display device's date, time, and timezone to the mosque's local timezone. Prayer time formatting currently uses the device timezone.

## Features

- Daily Imsyak, Subuh, Syuruq, Dzuhur, Ashar, Maghrib, and Isya schedule.
- Current and upcoming prayer indicators.
- Gregorian and Hijri date display with a configurable Hijri day adjustment.
- Image and muted video carousel with configurable slide duration.
- Countdown before adhan, adhan content, iqamah countdown, and prayer content.
- Hadith beside the countdown timer, with clock ticks that advance each second and reduced-motion support.
- A Friday Dzuhur sequence for Jumuah.
- Configuration and media updates delivered to the display through server-sent events.

## Configuration

Settings are edited at `/config` and stored on the server in `data/config.json`.

| Setting                     | Purpose                                       | Unit            |
| --------------------------- | --------------------------------------------- | --------------- |
| `title`, `subtitle`, `logo` | Display identity                              | Text / image    |
| `latitude`, `longitude`     | Prayer calculation location                   | Decimal degrees |
| `carouselDuration`          | Time between carousel slides                  | Seconds         |
| `hijriAdj`                  | Manual Hijri calendar adjustment              | Days            |
| `beforeNotice`              | Countdown before Imsyak and Syuruq            | Minutes         |
| `beforeAdhan`               | Countdown before the prayer starts            | Minutes         |
| `adhanDuration`             | Duration of the adhan screen                  | Minutes         |
| `beforeIqamah`              | Iqamah countdown after the adhan screen       | Minutes         |
| `prayerDuration`            | Regular prayer screen duration after iqamah   | Minutes         |
| `jumuahDuration`            | Friday prayer duration after the adhan screen | Minutes         |

For example, with an adhan time of 12:00, `adhanDuration: 7`, and `beforeIqamah: 7`, the iqamah countdown runs from 12:07 to 12:14.

The form also exposes `taraweehFromIsya` and `taraweehDuration`. These are not currently wired into a dedicated Tarawih display sequence; the schedule hides Tarawih.

The default form coordinates are `-6.2474466, 107.1484521`. Change them to the actual display location.

### Per-prayer timing

The config page includes individual minute adjustments for Imsyak, Subuh,
Syuruq, Dzuhur, Ashar, Maghrib, and Isya. Positive adjustments move the time
later; negative adjustments move it earlier. They are added to the existing
calculation, and the adjusted times drive both the schedule and countdowns.
Imsyak stays ten minutes before adjusted Subuh, plus its own adjustment.

Subuh, Dzuhur, Ashar, Maghrib, and Isya each have an iqamah countdown measured
from the end of the adzan screen. Zero skips the iqamah countdown. For example,
12:00 adzan + 7 minutes adzan screen + 10 minutes iqamah = prayer at 12:17.
Friday Dzuhur still uses the Jumuah sequence, which has no iqamah countdown.

Existing configurations use zero adjustments and the shared `beforeIqamah`
until individual values are saved. If the shared countdown is also missing, the fallback is 5 minutes. The fields are stored as `adjustmentSubuh`,
`iqamahSubuh`, etc. Adjustments accept whole minutes from -180 to 180; iqamah
countdowns accept 0 to 180. Saved settings reach the display through its existing
live update connection. Check that adjusted prayer times remain in their intended order.

## Media and storage

Use `/upload` to upload, reorder, or delete carousel media.

- Images: JPG, JPEG, PNG, and WebP.
- Videos: MP4 and WebM; playback is muted.
- Media upload limit in the API: 200 MiB per file.
- Logos: JPG, JPEG, PNG, WebP, or SVG, up to 5 MiB.

The server writes these paths relative to its working directory:

| Path                        | Contents                          |
| --------------------------- | --------------------------------- |
| `data/config.json`          | Saved display settings            |
| `static/uploads/`           | Uploaded logos and carousel media |
| `static/uploads/order.json` | Carousel ordering                 |

Keep these directories writable and preserve them when moving or redeploying the application.

## Prayer calculation

`src/lib/utils/prayer-engine.ts` calculates prayer times locally using `adhan`. It starts with the Muslim World League preset, overrides the Subuh angle to 20 degrees and Isya angle to 18 degrees, and defaults to the Shafi madhab. Imsyak is ten minutes before Subuh.

The implementation inherits the preset's adjustments and rounding. It does not fetch the Kemenag timetable or explicitly apply elevation corrections and local ikhtiyat adjustments. Compare results with the intended local timetable before choosing any additional offsets.

## Development commands

| Command            | Action                                    |
| ------------------ | ----------------------------------------- |
| `pnpm dev`         | Start development server on port 5000     |
| `pnpm build`       | Build the Node server                     |
| `pnpm preview`     | Preview the production build on port 5000 |
| `pnpm check`       | Run Svelte and TypeScript diagnostics     |
| `pnpm check:watch` | Watch for diagnostic changes              |
| `pnpm test`        | Run the Node test suite                   |
| `pnpm lint`        | Check formatting with Prettier            |
| `pnpm format`      | Format the project with Prettier          |

The test command uses Node's TypeScript stripping support.

For countdown development, `src/lib/stores/clock.ts` provides `createDebugClock(startTime, speed)`. Open `/?debug` to select `debugClock` and simulate prayer transitions. Open `/` without the `debug` parameter to use the real clock.
Set a custom debug starting date and time with `/?debug&datetime=2026-09-19T11:45:52`.
Without a timezone suffix, the value uses the device's local timezone. Use `Z` for
UTC, or encode an explicit positive offset, for example
`/?debug&datetime=2026-09-19T11:45:52%2B07:00`. The custom clock advances at normal
speed. Missing or invalid datetime values fall back to the default `debugClock`;
`datetime` is ignored unless `debug` is present.

## Raspberry Pi deployment

The Pi setup uses **PM2** to host Manar, nginx to serve it on the local network,
and the normal Raspberry Pi desktop to open Chromium fullscreen at login.
Press **F11** to leave fullscreen or **Alt+F4** to close the browser; the server
keeps running. It does not use a dedicated kiosk desktop.

### 1. Prepare Raspberry Pi OS

Install **64-bit Raspberry Pi OS Desktop with LightDM** using
[Raspberry Pi Imager](https://www.raspberrypi.com/software/). Lite is unsupported.
Set your username, password, Wi-Fi, timezone, and enable SSH. Connect the display
and boot the Pi. On Wayland, the startup script detects enabled HDMI displays and requests
1920x1080 with 100% scaling before opening Chromium.

### 2. Prepare the system

In the Pi's terminal or over SSH, run:

```sh
uname -m
sudo apt-get update
sudo apt-get full-upgrade -y
sudo apt-get install -y git
sudo timedatectl set-timezone Asia/Jakarta
sudo timedatectl set-ntp true
sudo reboot
```

Architecture must be `aarch64`; use your actual timezone. Reconnect after reboot.
If another package manager holds an apt lock, let it finish before retrying.

### 3. Install or migrate to PM2

For a fresh checkout:

```sh
cd ~
git clone https://github.com/septiandch/manar.git
cd ~/manar
sudo bash scripts/raspberry-pi/setup.sh
```

For an existing installation, enter your existing checkout instead, download the
updated scripts with `git pull --ff-only`, and run the same setup command. These
changes must first be committed and pushed from your development computer, or
copied to the Pi. The installer deploys the remote app branch.

Setup installs Node 22, pnpm, PM2, nginx, and Chromium. It disables the previous
Manar app service and kiosk session, preserves shared data, and configures normal
desktop autologin. It also removes the old installer's forced HDMI mode. Other
PM2 apps are not deleted; stop any old app that occupies ports 3000 or 5000 first.
Wait for `Setup complete` before rebooting.

### 4. Check hosting and configure the display

```sh
sudo -u manar -H /usr/local/bin/pm2 list
curl --fail http://localhost:5000/ -o /dev/null
hostname -I
```

PM2 should show `manar` online. On the Pi, visit `http://localhost:5000/`.
On a phone or laptop on the same Wi-Fi, use the Pi's IPv4 address instead:

- `http://192.168.1.50:5000/` ? display (replace the example IP).
- `http://192.168.1.50:5000/config` ? mosque settings.
- `http://192.168.1.50:5000/upload` ? media uploads.

No SSH tunnel is required. `localhost` on your phone refers to the phone, not the
Pi. These administration pages have no login, so use a trusted local network.

### 5. Reboot into the normal desktop and fullscreen browser

```sh
sudo reboot
```

Chromium waits for the server, then opens `http://localhost:5000/` fullscreen.
F11 reveals normal browser controls and the desktop. Closing Chromium leaves the
server running. To reopen it, run `manar-browser` from a desktop terminal.

### 6. Updates and troubleshooting

Daily update checks still run at 03:00 local time, with up to 15 minutes of delay.
To update manually or inspect logs:

```sh
sudo systemctl start manar-update.service
sudo -u manar -H /usr/local/bin/pm2 logs manar --lines 50 --nostream
journalctl -u manar-update.service -n 50 --no-pager
```

See the [Raspberry Pi guide](scripts/raspberry-pi/README.md) for migration details,
backups, Wi-Fi access troubleshooting, browser startup logs, and PM2 commands.

## Production

The project uses `@sveltejs/adapter-node` and requires a Node server for its configuration, upload, and event endpoints.

```sh
pnpm build
node build
```

Run from the project directory so the storage paths resolve consistently. Configure the production server or reverse proxy to serve `/uploads/` from the writable `static/uploads/` directory; uploads added after a build must remain accessible independently of the built static assets. Set request body limits to accommodate the uploads you intend to allow.

## Project layout

```text
src/routes/+page.svelte               Main display
src/routes/config/                   Configuration form
src/routes/upload/                   Media management
src/routes/api/                      Configuration, media, and event endpoints
src/routes/layout.css                Theme variables and global styles
src/lib/components/prayer-ui/        Prayer schedule and overlays
src/lib/components/date-clock/       Clock and Hijri date components
src/lib/stores/clock.ts              Real and simulated clocks
src/lib/stores/prayertime.ts         Daily prayer schedule store
src/lib/utils/prayer-engine.ts       Prayer calculation and event transitions
```

Change `--background` and the other theme variables in `src/routes/layout.css` to customize the display colors. Hadith content and countdown styling live in `src/lib/components/prayer-ui/prayer-screen.svelte`.
