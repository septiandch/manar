import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, _notify } from '../../routes/api/events/+server.ts';

test('display updates reach connected clients and continue after a reconnect', async () => {
	const response = GET();
	assert.equal(response.headers.get('X-Accel-Buffering'), 'no');
	assert.equal(response.headers.get('Cache-Control'), 'no-cache, no-transform');
	const first = response.body!.getReader();
	const second = GET().body!.getReader();
	const decoder = new TextDecoder();
	try {
		assert.match(decoder.decode((await first.read()).value), /connected/);
		await second.read();
		_notify();
		assert.equal(decoder.decode((await first.read()).value), 'event: update\ndata: reload\n\n');
		assert.equal(decoder.decode((await second.read()).value), 'event: update\ndata: reload\n\n');
		await first.cancel();
		const reconnected = GET().body!.getReader();
		try {
			await reconnected.read();
			_notify();
			assert.match(decoder.decode((await reconnected.read()).value), /event: update/);
			assert.match(decoder.decode((await second.read()).value), /event: update/);
		} finally {
			await reconnected.cancel();
		}
	} finally {
		await first.cancel();
		await second.cancel();
	}
});
