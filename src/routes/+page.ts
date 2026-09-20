import type { PageLoad } from './$types';
import type { ConfigType } from '$lib/types/config';
import type { CarouselMediaType } from '@/components/ui/carousel';

export const load: PageLoad = async ({ fetch, data }) => {
	let media: CarouselMediaType[] = [];
	let config: ConfigType;

	let res = await fetch('/api/config', { cache: 'no-store' });
	config = (await res.json()) as ConfigType;

	res = await fetch('/api/media');
	media = (await res.json()) as CarouselMediaType[];

	return {
		...config,
		configRevision: JSON.stringify(config),
		lanAddress: data.lanAddress,
		media
	};
};
