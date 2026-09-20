import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	buildPrayerSequence,
	getPrayerTimes,
	createPrayerEngine,
	type PrayerEventState,
	type PrayerTimeType
} from './prayer-engine.ts';

const minute = 60_000;
const at = (day: number, hour: number, minuteValue = 0) =>
	new Date(2026, 7, day, hour, minuteValue);

function times(day = 27): PrayerTimeType {
	return {
		Imsyak: at(day, 4, 20),
		Subuh: at(day, 4, 30),
		Syuruq: at(day, 5, 45),
		Dzuhur: at(day, 12),
		Ashar: at(day, 15, 15),
		Maghrib: at(day, 18),
		Isya: at(day, 19, 15),
		Tarawih: at(day, 19, 45)
	};
}

const config = {
	beforeNotice: 5,
	beforeAdhan: 5,
	adhanDuration: 7,
	beforeIqamah: 7,
	prayerDuration: 10,
	jumuahDuration: 30
};

function stateAt(prayerTimes: PrayerTimeType, values: Date[]) {
	const engine = createPrayerEngine(prayerTimes, config);
	return values.map((value) => {
		engine.update(value);
		return engine.getState()?.state;
	});
}

describe('prayer engine boundaries', () => {
	test('builds the normal sequence from configured durations', () => {
		const adhan = at(27, 12);
		const sequence = buildPrayerSequence(adhan, config);
		assert.equal(sequence.beforeAdhan.getTime(), adhan.getTime() - 5 * minute);
		assert.equal(sequence.adhanEnd.getTime(), adhan.getTime() + 7 * minute);
		assert.equal(sequence.iqamahTime.getTime(), adhan.getTime() + 14 * minute);
		assert.equal(sequence.prayerEnd.getTime(), adhan.getTime() + 24 * minute);
	});

	test('transitions countdown -> adhan -> iqamah -> prayer -> finished', () => {
		const prayerTimes = times();
		assert.deepEqual(
			stateAt(prayerTimes, [
				at(27, 11, 55),
				at(27, 12),
				at(27, 12, 7),
				at(27, 12, 14),
				at(27, 12, 24)
			]),
			['COUNTDOWN', 'ADHAN', 'IQAMAH', 'PRAYER', 'FINISHED']
		);
	});

	test('holds finished briefly, then advances to the next prayer', () => {
		const prayerTimes = times();
		const events: PrayerEventState[] = [];
		const engine = createPrayerEngine(prayerTimes, config, (event) => events.push({ ...event }));
		engine.update(at(27, 11, 55));
		engine.update(at(27, 12, 24));
		engine.update(new Date(at(27, 12, 24).getTime() + 4_999));
		assert.equal(engine.getState()?.state, 'FINISHED');
		engine.update(new Date(at(27, 12, 24).getTime() + 5_000));
		assert.equal(engine.getState()?.prayer, 'Ashar');
		assert.equal(engine.getState()?.state, 'IDLE');
		assert.deepEqual(
			events.map((event) => event.state),
			['COUNTDOWN', 'FINISHED', 'IDLE']
		);
	});

	test('transitions notice prayers and does not remain pinned after notice', () => {
		const prayerTimes = times();
		assert.deepEqual(stateAt(prayerTimes, [at(27, 4, 15), at(27, 4, 20), at(27, 4, 21)]), [
			'COUNTDOWN',
			'NOTICE',
			'FINISHED'
		]);
		const engine = createPrayerEngine(prayerTimes, config);
		engine.update(at(27, 4, 15));
		engine.update(at(27, 4, 21));
		engine.update(new Date(at(27, 4, 21).getTime() + 5_000));
		assert.equal(engine.getState()?.prayer, 'Subuh');
	});

	test('uses the Friday Jumuah sequence without iqamah or regular prayer states', () => {
		const prayerTimes = times(28); // Friday
		assert.deepEqual(
			stateAt(prayerTimes, [at(28, 11, 55), at(28, 12), at(28, 12, 7), at(28, 12, 37)]),
			['COUNTDOWN', 'ADHAN', 'JUMUAH', 'FINISHED']
		);
	});

	test('does not replay a sequence when starting after it has ended', () => {
		const engine = createPrayerEngine(times(), config);
		engine.update(at(27, 12, 30));
		assert.equal(engine.getState()?.prayer, 'Ashar');
		assert.equal(engine.getState()?.state, 'IDLE');
	});
});

describe('per-prayer settings', () => {
	test('applies signed adjustments without changing the calculation defaults', () => {
		const date = at(27, 0);
		const base = getPrayerTimes(date, -6.2474466, 107.1484521);
		const adjusted = getPrayerTimes(date, -6.2474466, 107.1484521, 'shafi', 30, {
			adjustmentImsyak: -1,
			adjustmentSubuh: 2,
			adjustmentSyuruq: -2,
			adjustmentDzuhur: 3,
			adjustmentAshar: -3,
			adjustmentMaghrib: 4,
			adjustmentIsya: 5
		});
		const offsets = {
			Imsyak: 1,
			Subuh: 2,
			Syuruq: -2,
			Dzuhur: 3,
			Ashar: -3,
			Maghrib: 4,
			Isya: 5,
			Tarawih: 5
		};
		for (const [prayer, offset] of Object.entries(offsets)) {
			assert.equal(
				adjusted[prayer as keyof PrayerTimeType].getTime() -
					base[prayer as keyof PrayerTimeType].getTime(),
				offset * minute
			);
		}
	});

	test('uses each daily prayer countdown and respects zero', () => {
		const prayers = ['Subuh', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'] as const;
		const overrides = {
			iqamahSubuh: 15,
			iqamahDzuhur: 10,
			iqamahAshar: 8,
			iqamahMaghrib: 0,
			iqamahIsya: 12
		};
		for (const prayer of prayers) {
			const sequence = buildPrayerSequence(times()[prayer], { ...config, ...overrides }, prayer);
			assert.equal(
				sequence.iqamahTime.getTime() - sequence.adhanEnd.getTime(),
				overrides[`iqamah${prayer}`] * minute
			);
			const engine = createPrayerEngine(times(), { ...config, ...overrides });
			engine.update(sequence.adhanEnd);
			assert.equal(engine.getState()?.state, prayer === 'Maghrib' ? 'PRAYER' : 'IQAMAH');
			assert.equal(engine.getState()?.prayer, prayer);
		}
	});

	test('old configurations retain the shared countdown', () => {
		const sequence = buildPrayerSequence(at(27, 12), config, 'Dzuhur');
		assert.equal(
			sequence.iqamahTime.getTime() - sequence.adhanEnd.getTime(),
			config.beforeIqamah * minute
		);
	});

	test('Friday Dzuhur keeps Jumuah even with a specific iqamah value', () => {
		const engine = createPrayerEngine(times(28), { ...config, iqamahDzuhur: 15 });
		engine.update(at(28, 12, 7));
		assert.equal(engine.getState()?.state, 'JUMUAH');
	});

	test('adjusted times drive the adhan and iqamah transitions', () => {
		const settings = { ...config, adjustmentDzuhur: 4, iqamahDzuhur: 12 };
		const prayerTimes = getPrayerTimes(at(27, 0), -6.2474466, 107.1484521, 'shafi', 30, settings);
		const engine = createPrayerEngine(prayerTimes, settings);
		const adhan = prayerTimes.Dzuhur.getTime();
		engine.update(new Date(adhan - minute));
		assert.equal(engine.getState()?.state, 'COUNTDOWN');
		assert.equal(engine.getState()?.nextTransition?.getTime(), adhan);
		engine.update(new Date(adhan));
		assert.equal(engine.getState()?.state, 'ADHAN');
		engine.update(new Date(adhan + 7 * minute));
		assert.equal(engine.getState()?.state, 'IQAMAH');
		assert.equal(engine.getState()?.nextTransition?.getTime(), adhan + 19 * minute);
	});

	test('can resume a long iqamah countdown beyond the display highlight window', () => {
		const engine = createPrayerEngine(times(), { ...config, iqamahDzuhur: 90 });
		engine.update(at(27, 13, 10));
		assert.equal(engine.getState()?.state, 'IQAMAH');
		assert.equal(engine.getState()?.prayer, 'Dzuhur');
		assert.equal(engine.getState()?.nextTransition?.getTime(), at(27, 13, 37).getTime());
	});
});

test('missing iqamah settings default to five minutes while saved zero is preserved', () => {
	for (const values of [undefined, {}, { beforeIqamah: undefined }]) {
		const sequence = buildPrayerSequence(at(27, 12), values, 'Dzuhur');
		assert.equal(sequence.iqamahTime.getTime() - sequence.adhanEnd.getTime(), 5 * minute);
		const engine = createPrayerEngine(times(), values);
		engine.update(at(27, 12, 7));
		assert.equal(engine.getState()?.nextTransition?.getTime(), at(27, 12, 12).getTime());
	}
	const sequence = buildPrayerSequence(at(27, 12), { beforeIqamah: 0 }, 'Dzuhur');
	assert.equal(sequence.iqamahTime.getTime(), sequence.adhanEnd.getTime());
});
