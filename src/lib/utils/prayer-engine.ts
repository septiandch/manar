import {
	TIMED_PRAYERS,
	IQAMAH_PRAYERS,
	type ConfigType,
	type PrayerTimingConfig,
	type IqamahPrayer
} from '../types/config.ts';
import { PrayerTimes as AdhanPrayerTimes, CalculationMethod, Coordinates, Madhab } from 'adhan';

export type PrayerLabel =
	| 'Imsyak'
	| 'Subuh'
	| 'Syuruq'
	| 'Dzuhur'
	| 'Ashar'
	| 'Maghrib'
	| 'Isya'
	| 'Tarawih';

export type PrayerTimeType = Record<PrayerLabel, Date>;

export type PrayerState =
	| 'IDLE'
	| 'NOTICE'
	| 'COUNTDOWN'
	| 'ADHAN'
	| 'IQAMAH'
	| 'PRAYER'
	| 'JUMUAH'
	| 'FINISHED';

export type PrayerEventState = {
	prayer: PrayerLabel | null;
	state: PrayerState;
	timeRemaining: number;
	nextTransition: Date | null;
};

export type PrayerConfig = Partial<ConfigType>;

export type PrayerEngine = ReturnType<typeof createPrayerEngine>;

const MINUTE = 60 * 1000;

const DEFAULT_SEQUENCE: PrayerConfig = {
	beforeNotice: 5,
	beforeAdhan: 5,
	adhanDuration: 7,
	beforeIqamah: 5,
	prayerDuration: 10,
	jumuahDuration: 30,
	taraweehFromIsya: 30,
	taraweehDuration: 60
};

const PRAYER_LABELS: PrayerLabel[] = [
	'Imsyak',
	'Subuh',
	'Syuruq',
	'Dzuhur',
	'Ashar',
	'Maghrib',
	'Isya'
];

const NOTICE_PRAYERS: PrayerLabel[] = ['Imsyak', 'Syuruq'];

export function getPrayerTimes(
	date: Date,
	latitude: number,
	longitude: number,
	madhab: 'shafi' | 'hanafi' = 'shafi',
	taraweehFromIsya: number = 30,
	adjustments: PrayerTimingConfig = {}
): PrayerTimeType {
	const coordinates = new Coordinates(latitude, longitude);

	const params = CalculationMethod.MuslimWorldLeague();
	params.fajrAngle = 20.0;
	params.ishaAngle = 18.0;
	params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;

	const prayerTimes = new AdhanPrayerTimes(coordinates, date, params);

	const times: PrayerTimeType = {
		Imsyak: new Date(prayerTimes.fajr.getTime() - 10 * MINUTE),
		Subuh: prayerTimes.fajr,
		Syuruq: prayerTimes.sunrise,
		Dzuhur: prayerTimes.dhuhr,
		Ashar: prayerTimes.asr,
		Maghrib: prayerTimes.maghrib,
		Isya: prayerTimes.isha,
		Tarawih: new Date(prayerTimes.isha.getTime() + taraweehFromIsya * MINUTE)
	};
	for (const prayer of TIMED_PRAYERS) {
		const offset = adjustments[`adjustment${prayer}`] ?? 0;
		if (Number.isFinite(offset))
			times[prayer] = new Date(times[prayer].getTime() + offset * MINUTE);
	}
	// Imsyak remains ten minutes before adjusted Subuh, plus its own offset.
	times.Imsyak = new Date(
		times.Imsyak.getTime() + (times.Subuh.getTime() - prayerTimes.fajr.getTime())
	);
	times.Tarawih = new Date(times.Isya.getTime() + taraweehFromIsya * MINUTE);
	return times;
}

export function getCurrentPrayer(
	prayerTimes: PrayerTimeType,
	now = new Date(),
	activeWindowMinutes = 60
): { name: PrayerLabel; time: Date } | null {
	const WINDOW = activeWindowMinutes * MINUTE;
	const nowMs = now.getTime();

	for (let i = 0; i < PRAYER_LABELS.length; i++) {
		const name = PRAYER_LABELS[i];
		const start = prayerTimes[name].getTime();

		let nextStart: number;

		if (i < PRAYER_LABELS.length - 1) {
			nextStart = prayerTimes[PRAYER_LABELS[i + 1]].getTime();
		} else {
			const tomorrowFirst = new Date(prayerTimes[PRAYER_LABELS[0]]);
			tomorrowFirst.setDate(tomorrowFirst.getDate() + 1);
			nextStart = tomorrowFirst.getTime();
		}

		const end = Math.min(start + WINDOW, nextStart);

		if (nowMs >= start && nowMs < end) {
			return { name, time: prayerTimes[name] };
		}
	}

	return null;
}

export function getNextPrayer(prayerTimes: PrayerTimeType, now = new Date()) {
	let nextName: PrayerLabel | undefined;
	let nextTime: Date | undefined;

	for (const name of PRAYER_LABELS) {
		const time = prayerTimes[name];
		if (time.getTime() > now.getTime()) {
			nextName = name;
			nextTime = time;
			break;
		}
	}

	if (!nextName || !nextTime) {
		nextName = 'Imsyak';
		const nextDay = 24 * 60 * 60 * 1000;
		nextTime = new Date(prayerTimes.Imsyak.getTime() + nextDay);
	}

	return {
		name: nextName,
		time: nextTime,
		countdown: nextTime.getTime() - now.getTime()
	};
}

export function buildPrayerSequence(
	adhanTime: Date,
	config: PrayerConfig = DEFAULT_SEQUENCE,
	prayer?: PrayerLabel
) {
	const override =
		prayer && IQAMAH_PRAYERS.includes(prayer as IqamahPrayer)
			? config[`iqamah${prayer as IqamahPrayer}`]
			: undefined;
	const iqamahMinutes =
		typeof override === 'number' && Number.isFinite(override) && override >= 0
			? override
			: (config.beforeIqamah ?? 5);
	const beforeAdhan = new Date(adhanTime.getTime() - (config?.beforeAdhan || 0) * MINUTE);
	const adhanEnd = new Date(adhanTime.getTime() + (config?.adhanDuration || 0) * MINUTE);
	const iqamahTime = new Date(adhanEnd.getTime() + iqamahMinutes * MINUTE);
	const prayerEnd = new Date(iqamahTime.getTime() + (config?.prayerDuration || 0) * MINUTE);

	return {
		beforeAdhan,
		adhanStart: adhanTime,
		adhanEnd,
		iqamahTime,
		prayerEnd
	};
}

function isNoticePrayer(prayer: PrayerLabel) {
	return NOTICE_PRAYERS.includes(prayer);
}

function isJumuah(prayer: PrayerLabel, date: Date) {
	return prayer === 'Dzuhur' && date.getDay() === 5;
}

export function createPrayerEngine(
	prayerTimes: PrayerTimeType,
	prayerConfig?: PrayerConfig,
	callbacks?: (e: PrayerEventState) => void
) {
	let currentState: PrayerEventState | null = null;
	let currentPrayer: PrayerLabel | null = null;

	let finishedUntil: number | null = null;
	const FINISHED_HOLD = 5000;

	const config: PrayerConfig = {
		...DEFAULT_SEQUENCE,
		...prayerConfig
	};

	function computeStateForPrayer(
		now: Date,
		prayer: PrayerLabel,
		adhanTime: Date
	): PrayerEventState {
		const nowMs = now.getTime();
		const adhanMs = adhanTime.getTime();
		if (isNoticePrayer(prayer)) {
			const beforeNotice = adhanMs - (config?.beforeNotice || 0) * MINUTE;
			const noticeStart = adhanMs;
			const noticeEnd = adhanMs + MINUTE;

			if (nowMs < beforeNotice)
				return {
					prayer,
					state: 'IDLE',
					timeRemaining: beforeNotice - nowMs,
					nextTransition: new Date(beforeNotice)
				};

			if (nowMs < noticeStart)
				return {
					prayer,
					state: 'COUNTDOWN',
					timeRemaining: noticeStart - nowMs,
					nextTransition: new Date(noticeStart)
				};

			if (nowMs < noticeEnd)
				return {
					prayer,
					state: 'NOTICE',
					timeRemaining: noticeEnd - nowMs,
					nextTransition: new Date(noticeEnd)
				};

			return { prayer, state: 'FINISHED', timeRemaining: 0, nextTransition: null };
		}

		if (isJumuah(prayer, adhanTime)) {
			const beforeAdhan = new Date(adhanTime.getTime() - (config?.beforeAdhan || 0) * MINUTE);
			const adhanEnd = new Date(adhanTime.getTime() + (config?.adhanDuration || 0) * MINUTE);
			const prayerEnd = new Date(adhanEnd.getTime() + (config?.jumuahDuration || 0) * MINUTE);

			if (now < beforeAdhan)
				return {
					prayer,
					state: 'IDLE',
					timeRemaining: beforeAdhan.getTime() - nowMs,
					nextTransition: beforeAdhan
				};

			if (now < adhanTime)
				return {
					prayer,
					state: 'COUNTDOWN',
					timeRemaining: adhanTime.getTime() - nowMs,
					nextTransition: adhanTime
				};

			if (now < adhanEnd)
				return {
					prayer,
					state: 'ADHAN',
					timeRemaining: adhanEnd.getTime() - nowMs,
					nextTransition: adhanEnd
				};

			if (now < prayerEnd)
				return {
					prayer,
					state: 'JUMUAH',
					timeRemaining: prayerEnd.getTime() - nowMs,
					nextTransition: prayerEnd
				};

			return { prayer, state: 'FINISHED', timeRemaining: 0, nextTransition: null };
		}

		const t = buildPrayerSequence(adhanTime, config, prayer);

		if (now < t.beforeAdhan)
			return {
				prayer,
				state: 'IDLE',
				timeRemaining: t.beforeAdhan.getTime() - nowMs,
				nextTransition: t.beforeAdhan
			};

		if (now < t.adhanStart)
			return {
				prayer,
				state: 'COUNTDOWN',
				timeRemaining: t.adhanStart.getTime() - nowMs,
				nextTransition: t.adhanStart
			};

		if (now < t.adhanEnd)
			return {
				prayer,
				state: 'ADHAN',
				timeRemaining: t.adhanEnd.getTime() - nowMs,
				nextTransition: t.adhanEnd
			};

		if (now < t.iqamahTime)
			return {
				prayer,
				state: 'IQAMAH',
				timeRemaining: t.iqamahTime.getTime() - nowMs,
				nextTransition: t.iqamahTime
			};

		if (now < t.prayerEnd)
			return {
				prayer,
				state: 'PRAYER',
				timeRemaining: t.prayerEnd.getTime() - nowMs,
				nextTransition: t.prayerEnd
			};

		return { prayer, state: 'FINISHED', timeRemaining: 0, nextTransition: null };
	}

	function update(now: Date) {
		const nowMs = now.getTime();

		if (finishedUntil && nowMs < finishedUntil) return;
		if (finishedUntil && nowMs >= finishedUntil) {
			currentPrayer = null;
			finishedUntil = null;
			currentState = null;
		}

		let targetPrayer: PrayerLabel | null = currentPrayer;

		if (!targetPrayer) {
			const current = getCurrentPrayer(prayerTimes, now, Infinity);
			// getCurrentPrayer deliberately has a broad display window. Only select it
			// when its event sequence is actually still active, otherwise a completed
			// prayer would repeatedly enter FINISHED instead of advancing.
			if (
				current &&
				!['IDLE', 'FINISHED'].includes(computeStateForPrayer(now, current.name, current.time).state)
			) {
				targetPrayer = current.name;
			} else {
				targetPrayer = getNextPrayer(prayerTimes, now).name;
			}
		}

		const adhanTime = prayerTimes[targetPrayer];
		const newState = computeStateForPrayer(now, targetPrayer, adhanTime);

		const prev = currentState;
		currentState = newState;

		if (!currentPrayer && newState.state !== 'IDLE') {
			currentPrayer = targetPrayer;
		}

		if (!prev || prev.state !== newState.state || prev.prayer !== newState.prayer) {
			switch (newState.state) {
				case 'NOTICE':
					// do nothing
					break;
				case 'COUNTDOWN':
					// do nothing
					break;
				case 'ADHAN':
					// do nothing
					break;
				case 'IQAMAH':
					// do nothing
					break;
				case 'PRAYER':
					// do nothing
					break;
				case 'FINISHED':
					finishedUntil = nowMs + FINISHED_HOLD;
					newState.timeRemaining = FINISHED_HOLD;
					newState.nextTransition = new Date(finishedUntil);
					break;
			}

			callbacks?.(newState);
		}
	}

	return {
		update,
		getState() {
			return currentState;
		},
		reset() {
			currentPrayer = null;
			currentState = null;
			finishedUntil = null;
		}
	};
}
