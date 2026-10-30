export type MirrorState = 'IDLE' | 'CONNECTING' | 'MIRRORING' | 'DISCONNECTED';
export function mirror(
	role: 'sender' | 'receiver',
	token: string,
	video: HTMLVideoElement,
	status: (s: MirrorState) => void,
	stream?: MediaStream,
	onPairing?: (code: string) => void,
	onSignaling?: (connected: boolean) => void,
	onPairingVisibility?: (visible: boolean) => void
) {
	let ws: WebSocket,
		disposed = false,
		session = '',
		retry = 0,
		lastSignal = Date.now(),
		lastFrame = Date.now(),
		frames = -1;
	const peers = new Map<string, RTCPeerConnection>();
	const pending = new Map<string, RTCIceCandidateInit[]>();
	const send = (m: object) => {
		if (ws?.readyState === 1) ws.send(JSON.stringify(m));
	};
	const clear = () => {
		peers.forEach((p) => p.close());
		peers.clear();
		pending.clear();
		video.srcObject = null;
		session = '';
		status('DISCONNECTED');
	};
	async function peer(id: string) {
		const p = new RTCPeerConnection({ iceServers: [] });
		peers.set(id, p);
		p.onicecandidate = (e) => {
			if (e.candidate) send({ type: 'ice', id, session, candidate: e.candidate.toJSON() });
		};
		p.onconnectionstatechange = () => {
			if (['failed', 'closed'].includes(p.connectionState)) {
				if (role === 'receiver') clear();
				else {
					p.close();
					peers.delete(id);
				}
			}
		};
		if (stream) stream.getTracks().forEach((t) => p.addTrack(t, stream));
		p.ontrack = (e) => {
			video.srcObject = e.streams[0] || new MediaStream([e.track]);
			lastFrame = Date.now();
			frames = -1;
			e.track.onended = clear;
			void video.play().catch(() => {
				video.muted = true;
				void video.play().catch(clear);
			});
		};
		return p;
	}
	function connect() {
		ws = new WebSocket(
			`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/mirror-ws?role=${role}&token=${encodeURIComponent(token)}`
		);
		ws.onopen = () => {
			onSignaling?.(true);
			retry = 0;
			lastSignal = Date.now();
			if (role === 'sender') send({ type: 'start' });
		};
		ws.onmessage = async (e) => {
			lastSignal = Date.now();
			try {
				const m = JSON.parse(e.data);
				if (m.type === 'pairing-visibility') {
					onPairingVisibility?.(m.visible === true);
					return;
				}
				if (m.type === 'pairing') {
					onPairing?.(m.code);
					return;
				}
				if (m.type === 'stop') {
					clear();
					return;
				}
				if (m.type === 'start') {
					clear();
					session = m.session;
					status('CONNECTING');
					return;
				}
				if (m.type === 'leave') {
					peers.get(m.id)?.close();
					peers.delete(m.id);
					return;
				}
				if (m.session !== session) return;
				const id = role === 'sender' ? m.id : 'sender';
				if (m.type === 'join' && role === 'sender') {
					const p = await peer(id);
					await p.setLocalDescription(await p.createOffer());
					send({ type: 'offer', id, session, sdp: p.localDescription });
				}
				if (m.type === 'offer' && role === 'receiver') {
					const p = await peer(id);
					await p.setRemoteDescription(m.sdp);
					for (const c of pending.get(id) || []) await p.addIceCandidate(c);
					pending.delete(id);
					await p.setLocalDescription(await p.createAnswer());
					send({ type: 'answer', session, sdp: p.localDescription });
				}
				if (m.type === 'answer') {
					const p = peers.get(id);
					if (p) {
						await p.setRemoteDescription(m.sdp);
						for (const c of pending.get(id) || []) await p.addIceCandidate(c);
						pending.delete(id);
						status('MIRRORING');
					}
				}
				if (m.type === 'ice') {
					const p = peers.get(id);
					if (p?.remoteDescription) await p.addIceCandidate(m.candidate);
					else pending.set(id, [...(pending.get(id) || []), m.candidate]);
				}
			} catch {
				if (role === 'receiver') clear();
			}
		};
		ws.onclose = () => {
			onPairingVisibility?.(false);
			onPairing?.('');
			onSignaling?.(false);
			if (!disposed)
				setTimeout(
					() => {
						if (!disposed) connect();
					},
					Math.min(8000, 500 * 2 ** retry++)
				);
		};
	}
	video.onplaying = () => {
		lastFrame = Date.now();
		status('MIRRORING');
	};
	const timer = setInterval(() => {
		send({ type: 'ping' });
		if (role === 'receiver' && video.srcObject) {
			const count = video.getVideoPlaybackQuality?.().totalVideoFrames;
			if (count !== undefined && count !== frames) {
				frames = count;
				lastFrame = Date.now();
			}
			if (Date.now() - lastFrame > 5000) clear();
		}
		if (Date.now() - lastSignal > 6000) {
			clear();
		}
	}, 1000);
	const close = () => {
		disposed = true;
		send({ type: 'stop' });
		ws?.close();
		clearInterval(timer);
		clear();
		stream?.getTracks().forEach((t) => t.stop());
		video.onplaying = null;
		window.removeEventListener('pagehide', close);
	};
	stream?.getVideoTracks().forEach((t) => (t.onended = close));
	window.addEventListener('pagehide', close);
	connect();
	return close;
}
