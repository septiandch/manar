import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mirror } from './mirror.ts';

test('sender retains capture through session startup and waits for receiver playback', async () => {
	const saved = new Map<string, PropertyDescriptor | undefined>();
	let socket: any;
	class FakeSocket {
		readyState = 1;
		onopen?: () => void;
		onmessage?: (e: { data: string }) => void;
		onclose?: () => void;
		constructor() {
			socket = this;
		}
		send() {}
		close() {
			this.onclose?.();
		}
	}
	const globals: Record<string, unknown> = {
		WebSocket: FakeSocket,
		location: { protocol: 'https:', host: 'localhost' },
		window: { addEventListener() {}, removeEventListener() {} }
	};
	for (const [key, value] of Object.entries(globals)) {
		saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
		Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
	}
	let close: (() => void) | undefined;
	try {
		let stopped = false;
		const track = {
			stop() {
				stopped = true;
			},
			onended: null
		};
		const capture = {
			getTracks: () => [track],
			getVideoTracks: () => [track]
		} as unknown as MediaStream;
		const video = { srcObject: capture, onplaying: null } as unknown as HTMLVideoElement;
		const states: string[] = [];
		close = mirror('sender', 'test', video, (s) => states.push(s), capture);
		socket.onopen();
		for (const data of [{ type: 'stop' }, { type: 'start', session: 'new' }])
			socket.onmessage({ data: JSON.stringify(data) });
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(video.srcObject, capture);
		assert.equal(stopped, false);
		assert.equal(video.onplaying, null);
		assert.equal(states.at(-1), 'CONNECTING');
		socket.onmessage({ data: JSON.stringify({ type: 'playing', session: 'old' }) });
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(states.at(-1), 'CONNECTING');
		socket.onmessage({ data: JSON.stringify({ type: 'playing', session: 'new' }) });
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(states.at(-1), 'MIRRORING');
		close();
		close = undefined;
		assert.equal(stopped, true);
		assert.equal(video.srcObject, null);
	} finally {
		close?.();
		for (const [key, descriptor] of saved) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
});
