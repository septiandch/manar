# Screen mirroring (initial implementation)

This implementation needs real-browser validation before production use.

## Files

- server.mjs: shared HTTP/WebSocket Node entrypoint; ws dependency.
- src/lib/webrtc/mirror.ts: sender/receiver and connection monitoring.
- src/lib/components/ScreenMirrorReceiver.svelte: overlay mounted by the existing display.
- src/routes/admin/mirror/+page.svelte: capture controls and preview.

## Configuration and running

Build with `pnpm build`, then run `node server.mjs` instead of `node build`.
Set HOST and PORT as usual. Set MIRROR_ADMIN_TOKEN and MIRROR_DISPLAY_TOKEN to separate long random secrets in the PM2 environment. Restart PM2 with its updated environment. The existing installer still launches the original entrypoint; change its launcher to server.mjs when enabling this feature.

Configure trusted HTTPS on nginx (certificate trusted by the laptop and TV). Forward /mirror-ws to the same Node port, with proxy_http_version 1.1, Upgrade $http_upgrade, and Connection "upgrade" headers. Preserve the existing upload and SSE proxy configuration. This repository does not provision certificates.

Open `https://YOUR-HOST/display?displayToken=DISPLAY_SECRET` once on each intended TV. The token is stored in localStorage; remove it from the address afterward. Treat this URL as a credential and avoid retaining it in proxy logs. Open `/admin/mirror` on the laptop, enter the administrator secret, and click Start Mirroring. Stop Mirroring or the browser sharing controls ends capture. A link is available from the mirroring page to existing settings; dashboard navigation integration is pending.

There is no existing application authentication in this repository. These secrets authenticate the new signaling roles only; existing administration endpoints remain as before. WebSocket tokens are passed in the handshake URL. Replace with an application session when a shared login system is introduced.

## Behavior and limitations

Each receiver gets its own WebRTC connection, using LAN host ICE candidates without external STUN/TURN. LAN isolation/firewalls can prevent connectivity. Audio is currently disabled. Video is muted for autoplay reliability. The overlay uses contain sizing on black and leaves the carousel, prayer engine, and SSE mounted underneath.

Sender heartbeat expires after five seconds; signaling inactivity and receiver frame monitoring provide fallback. WebSockets retry with bounded exponential delays. The server assigns session IDs and rejects signaling for other sessions. A signaling outage longer than six seconds removes the overlay. Receiver refresh can join an active session. Browser timer suspension may delay fallback.

Known gaps: connection/ICE disconnected grace handling, strict message schema/rate validation, constant-time credential comparison, Origin validation, race protection around asynchronous SDP work, receiver reconnect recovery after a playback timeout, useful authentication/capture error reporting, and automated signaling tests need further work. Sender reports live after SDP answer rather than explicit receiver playback confirmation. The implementation is not yet acceptance-complete.

## Hardware validation (not performed)

Use a laptop and two Android TV browsers on the same LAN with trusted HTTPS and the configured reverse proxy. Verify idle carousel and prayer countdowns; start sharing and confirm the overlay appears only on playback; stop using both application and browser controls; close/refresh the sender tab; disconnect sender Wi-Fi; refresh one TV during sharing; repeat start/stop ten times; disconnect one TV while the other continues. Confirm fallback timing within five seconds where browser timers run normally. Trigger prayer transitions using the existing debug clock and verify continued progression after mirroring. Inspect browser WebRTC diagnostics and server logs for leaked peers/sockets and inject delayed old-session messages to test race rejection. These checks remain required before deployment.

## Pair using the TV code

After one-time TV enrollment with the display token, the TV shows a six-digit code and the /connect address. On the laptop open /connect, enter that code and click Connect, then Start Mirroring. No administrator token entry is needed. Any person who can read the TV code can authorize a sender for all enrolled displays; this is installation-wide pairing, not selection of an individual TV.

Codes expire every two minutes and are single-use. Attempts are limited to five per minute per server-observed IP (devices behind nginx share that limit). Paired access is stored in laptop localStorage for 24 hours, and invalidated by server restart. Use Forget connection on the mirroring page to pair again after expiry or restart. Forget removes local credentials; it does not revoke copies on other devices. QR pairing is not included.

The custom server now handles POST /mirror-pair as well as /mirror-ws. Existing nginx location / proxies the HTTP endpoint; keep Host forwarding enabled. Vite proxies both endpoints to port 3000, so development requires node --env-file=.env server.mjs alongside pnpm dev. No new dependencies were added for pairing. Run node --test scripts/pairing.test.mjs for expiry, single-use, and rate-limit tests. Browser/LAN pairing still requires hardware validation.
