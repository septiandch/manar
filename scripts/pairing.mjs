import { randomInt, randomBytes } from 'node:crypto';
export function createPairing(now = Date.now) {
	const codes = new Map();
	const grants = new Map();
	const attempts = new Map();
	return {
		issue() {
			let code;
			do {
				code = String(randomInt(100000, 1000000));
			} while (codes.has(code));
			codes.set(code, now() + 120000);
			return code;
		},
		revoke(code) {
			codes.delete(code);
		},
		exchange(code, ip) {
			const time = now();
			for (const [key, value] of attempts) if (value.until <= time) attempts.delete(key);
			for (const [key, value] of codes) if (value <= time) codes.delete(key);
			for (const [key, value] of grants) if (value <= time) grants.delete(key);
			const attempt = attempts.get(ip) || { count: 0, until: time + 60000 };
			if (attempts.size >= 1024 && !attempts.has(ip)) return null;
			attempts.set(ip, attempt);
			if (++attempt.count > 5) return null;
			if (typeof code !== 'string' || !/^\d{6}$/.test(code) || !codes.has(code)) return null;
			codes.delete(code);
			const token = randomBytes(32).toString('hex');
			grants.set(token, time + 86400000);
			return token;
		},
		valid(token) {
			return typeof token === 'string' && (grants.get(token) || 0) > now();
		}
	};
}
