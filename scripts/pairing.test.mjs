import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPairing } from './pairing.mjs';
test('pairing codes are single use and grants expire', () => {
	let time = 0;
	const p = createPairing(() => time);
	const code = p.issue();
	assert.equal(p.exchange('000000', 'a'), null);
	const token = p.exchange(code, 'a');
	assert.ok(p.valid(token));
	assert.equal(p.exchange(code, 'a'), null);
	time = 86400001;
	assert.equal(p.valid(token), false);
});
test('codes expire and attempts are bounded', () => {
	let time = 0;
	const p = createPairing(() => time);
	let code = p.issue();
	time = 120001;
	assert.equal(p.exchange(code, 'a'), null);
	code = p.issue();
	for (let i = 0; i < 5; i++) p.exchange('bad', 'b');
	assert.equal(p.exchange(code, 'b'), null);
	assert.ok(p.exchange(code, 'c'));
});
