import { networkInterfaces } from 'node:os';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	// Prefer Wi-Fi, then Ethernet, when the server has multiple network adapters.
	const priority = (name: string) => (/^wl/i.test(name) ? 0 : /^(eth|en)/i.test(name) ? 1 : 2);
	const addresses = Object.entries(networkInterfaces())
		.sort(([a], [b]) => priority(a) - priority(b))
		.flatMap(([, entries]) => entries ?? []);
	const lanAddress = addresses.find(
		({ family, internal, address }) =>
			family === 'IPv4' && !internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)
	)?.address;

	return { lanAddress: lanAddress ?? null };
};
