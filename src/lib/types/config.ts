export const TIMED_PRAYERS = [
	'Imsyak',
	'Subuh',
	'Syuruq',
	'Dzuhur',
	'Ashar',
	'Maghrib',
	'Isya'
] as const;
export const IQAMAH_PRAYERS = ['Subuh', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'] as const;
export type TimedPrayer = (typeof TIMED_PRAYERS)[number];
export type IqamahPrayer = (typeof IQAMAH_PRAYERS)[number];
export type PrayerTimingConfig = Partial<
	Record<`adjustment${TimedPrayer}` | `iqamah${IqamahPrayer}`, number>
>;

type StringField = {
	type: 'string';
	label: string;
	placeholder?: string;
};

type NumberField = {
	type: 'number';
	label: string;
	placeholder?: string;
	minValue?: number;
	maxValue?: number;
	withButton?: boolean;
};

type ImageField = {
	type: 'image';
	label: string;
	placeholder?: string;
};

export type ConfigType = PrayerTimingConfig & {
	logo: File | string | null;
	title: string;
	subtitle: string;
	carouselDuration: number;
	hijriAdj: number;
	latitude: number;
	longitude: number;
	beforeNotice: number;
	beforeAdhan: number;
	adhanDuration: number;
	beforeIqamah: number;
	prayerDuration: number;
	jumuahDuration: number;
	taraweehFromIsya: number;
	taraweehDuration: number;
};

export type ConfigField = (StringField | NumberField | ImageField) & {
	key: keyof ConfigType;
};
