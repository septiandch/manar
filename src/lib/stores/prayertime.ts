import type { PrayerConfig } from '$lib/utils/prayer-engine';
import { getPrayerTimes } from '$lib/utils/prayer-engine';
import { readable, type Readable } from 'svelte/store';

export function createPrayerStore(
	clock: Readable<Date>,
	latitude: number,
	longitude: number,
	config: PrayerConfig = {}
) {
	return readable(
		getPrayerTimes(new Date(), latitude, longitude, 'shafi', config.taraweehFromIsya ?? 30, config),
		(set) => {
			let currentDay: string | null = null;

			const unsubscribe = clock.subscribe((now) => {
				const today = now.toDateString();

				if (currentDay === null) {
					currentDay = today;
					set(
						getPrayerTimes(now, latitude, longitude, 'shafi', config.taraweehFromIsya ?? 30, config)
					);
					return;
				}

				if (today !== currentDay) {
					currentDay = today;
					set(
						getPrayerTimes(now, latitude, longitude, 'shafi', config.taraweehFromIsya ?? 30, config)
					);
				}
			});

			return unsubscribe;
		}
	);
}
