import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { handler } from './build/handler.js';
import { createPairing } from './scripts/pairing.mjs';
const pairing = createPairing();
const server = createServer(async (req, res) => {
	if (req.url !== '/mirror-pair') return handler(req, res);
	res.setHeader('Cache-Control', 'no-store');
	if (req.method !== 'POST') {
		res.writeHead(405);
		return res.end();
	}
	if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
		res.writeHead(403);
		return res.end();
	}
	let body = '';
	try {
		for await (const chunk of req) {
			body += chunk;
			if (body.length > 256) {
				res.writeHead(413);
				return res.end();
			}
		}
		const token = pairing.exchange(JSON.parse(body).code, req.socket.remoteAddress);
		res.setHeader('Content-Type', 'application/json');
		res.writeHead(token ? 200 : 403);
		res.end(
			JSON.stringify(
				token
					? { token }
					: {
							error: 'Code expired, already used, or too many attempts. Check the TV and try again.'
						}
			)
		);
	} catch {
		res.writeHead(400);
		res.end();
	}
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 });
let sender, session;
const clients = new Map();
const send = (ws, m) => {
	if (ws?.readyState === 1) ws.send(JSON.stringify(m));
};
const broadcast = (m) =>
	clients.forEach((c, ws) => {
		if (c.role !== 'pairing') send(ws, m);
	});
function notifyPairing() {
	const visible = [...clients.values()].some((c) => c.role === 'pairing');
	clients.forEach((c, ws) => {
		if (c.role === 'receiver') send(ws, { type: 'pairing-visibility', visible });
	});
}
function stop() {
	session = undefined;
	broadcast({ type: 'stop' });
}
server.on('upgrade', (req, socket, head) => {
	const url = new URL(req.url, 'http://localhost');
	const role = url.searchParams.get('role');
	const secret =
		role === 'sender' ? process.env.MIRROR_ADMIN_TOKEN : process.env.MIRROR_DISPLAY_TOKEN;
	if (
		url.pathname !== '/mirror-ws' ||
		!['sender', 'receiver', 'pairing'].includes(role) ||
		(role !== 'pairing' &&
			!secret &&
			!(role === 'sender' && pairing.valid(url.searchParams.get('token')))) ||
		(role !== 'pairing' &&
			!(role === 'sender' && pairing.valid(url.searchParams.get('token'))) &&
			url.searchParams.get('token') !== secret) ||
		clients.size >= 32 ||
		(role === 'sender' && sender)
	) {
		socket.destroy();
		return;
	}
	wss.handleUpgrade(req, socket, head, (ws) => {
		const id = crypto.randomUUID();
		clients.set(ws, { id, role, last: Date.now() });
		if (role === 'sender') sender = ws;
		send(ws, { type: 'welcome', id });
		let code;
		const showCode = () => {
			if (code) pairing.revoke(code);
			code = pairing.issue();
			send(ws, { type: 'pairing', code });
		};
		if (role === 'receiver') showCode();
		notifyPairing();
		const codeTimer = role === 'receiver' ? setInterval(showCode, 120000) : undefined;
		if (session && role === 'receiver') {
			send(ws, { type: 'start', session });
			send(sender, { type: 'join', id, session });
		}
		ws.on('message', (raw) => {
			try {
				const m = JSON.parse(raw.toString());
				const c = clients.get(ws);
				if (m.type === 'ping') {
					c.last = Date.now();
					send(ws, { type: 'pong' });
					return;
				}
				if (role === 'pairing') return;
				if (role === 'sender' && m.type === 'start') {
					stop();
					session = crypto.randomUUID();
					broadcast({ type: 'start', session });
					clients.forEach((c) => {
						if (c.role === 'receiver') send(sender, { type: 'join', id: c.id, session });
					});
					return;
				}
				if (role === 'sender' && m.type === 'stop') {
					stop();
					return;
				}
				if (!session || m.session !== session || !['offer', 'answer', 'ice'].includes(m.type))
					return;
				if (
					(m.type === 'offer' && role !== 'sender') ||
					(m.type === 'answer' && role !== 'receiver')
				)
					return;
				if (role === 'receiver') send(sender, { ...m, id: c.id });
				else
					clients.forEach((target, receiver) => {
						if (target.id === m.id && target.role === 'receiver') send(receiver, m);
					});
			} catch {
				ws.close(1008);
			}
		});
		ws.on('close', () => {
			clearInterval(codeTimer);
			if (code) pairing.revoke(code);
			clients.delete(ws);
			notifyPairing();
			if (ws === sender) {
				sender = undefined;
				stop();
			} else send(sender, { type: 'leave', id });
		});
	});
});
setInterval(() => {
	clients.forEach((c, ws) => {
		if (Date.now() - c.last > 5000) ws.terminate();
	});
}, 1000).unref();
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0');
