<script lang="ts">
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import {
		TIMED_PRAYERS,
		IQAMAH_PRAYERS,
		type ConfigField,
		type ConfigType
	} from '$lib/types/config';
	import { Loader } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import ConfigInput from './config-input.svelte';

	const initialConfig: ConfigType = {
		logo: null as File | null,
		title: '',
		subtitle: '',
		latitude: -6.2474466,
		longitude: 107.1484521,
		hijriAdj: 0,
		carouselDuration: 5,
		beforeNotice: 5,
		beforeAdhan: 5,
		adhanDuration: 10,
		beforeIqamah: 5,
		prayerDuration: 10,
		jumuahDuration: 30,
		taraweehFromIsya: 30,
		taraweehDuration: 60
	};

	function withPrayerDefaults(values: Partial<ConfigType> | null): ConfigType {
		const result = { ...initialConfig, ...values };
		for (const prayer of TIMED_PRAYERS) result[`adjustment${prayer}`] ??= 0;
		for (const prayer of IQAMAH_PRAYERS) result[`iqamah${prayer}`] ??= result.beforeIqamah;
		return result;
	}

	let logoUrl: string | undefined = $state(undefined);
	let updatedAt: string | undefined = $state(undefined);
	let loading = $state(true);

	let configValues = $state<ConfigType>(initialConfig);

	const fields: ConfigField[] = [
		...TIMED_PRAYERS.map(
			(prayer): ConfigField => ({
				key: `adjustment${prayer}`,
				type: 'number',
				label: `${prayer} adjustment (minutes)`,
				minValue: -180,
				maxValue: 180,
				withButton: true
			})
		),
		...IQAMAH_PRAYERS.map(
			(prayer): ConfigField => ({
				key: `iqamah${prayer}`,
				type: 'number',
				label: `${prayer} iqamah countdown (minutes)`,
				minValue: 0,
				maxValue: 180,
				withButton: true
			})
		),
		{ key: 'logo', type: 'image', label: 'Logo', placeholder: 'Select file' },
		{ key: 'title', type: 'string', label: 'Mosque name', placeholder: 'e.g. Masjid Al-Ikhlas' },
		{ key: 'subtitle', type: 'string', label: 'Address or subtitle', placeholder: 'Subtitle' },
		{
			key: 'carouselDuration',
			type: 'number',
			label: 'Announcement duration (seconds)',
			placeholder: 'duration (second)',
			minValue: 5,
			withButton: true
		},
		{
			key: 'hijriAdj',
			type: 'number',
			label: 'Hijri date adjustment (days)',
			placeholder: 'day',
			minValue: -3,
			withButton: true
		},
		{ key: 'latitude', type: 'number', label: 'Latitude', placeholder: 'Latitude' },
		{ key: 'longitude', type: 'number', label: 'Longitude', placeholder: 'Longitude' },
		{
			key: 'beforeNotice',
			type: 'number',
			label: 'Imsyak/Syuruq countdown (minutes)',
			placeholder: 'duration (minutes)',
			minValue: 0,
			withButton: true
		},
		{
			key: 'beforeAdhan',
			type: 'number',
			label: 'Adzan countdown (minutes)',
			placeholder: 'duration (minutes)',
			minValue: 1,
			withButton: true
		},
		{
			key: 'adhanDuration',
			type: 'number',
			label: 'Adzan duration (minutes)',
			placeholder: 'duration (minutes)',
			minValue: 5,
			withButton: true
		},
		{
			key: 'beforeIqamah',
			type: 'number',
			label: 'Default iqamah countdown (minutes)',
			placeholder: 'duration (minutes)',
			minValue: 5,
			withButton: true
		},
		{
			key: 'prayerDuration',
			type: 'number',
			label: 'Prayer duration (minutes)',
			placeholder: 'duration (minutes)',
			minValue: 5,
			withButton: true
		},
		{
			key: 'jumuahDuration',
			type: 'number',
			label: 'Jumuah duration (minutes)',
			placeholder: 'duration (minutes)',
			minValue: 5,
			withButton: true
		},
		{
			key: 'taraweehFromIsya',
			type: 'number',
			label: 'Isya to Taraweeh time (minutes)',
			placeholder: 'duration (minutes)',
			minValue: 0,
			withButton: true
		},
		{
			key: 'taraweehDuration',
			type: 'number',
			label: 'Taraweeh Duration (minutes)',
			placeholder: 'duration (minutes)',
			minValue: 0,
			withButton: true
		}
	];

	let saving = $state(false);
	let error = $state('');
	let success = $state('');
	let loaded = $state(false);
	let savedValues = $state('');
	const dirty = $derived(
		loaded && (JSON.stringify(configValues) !== savedValues || configValues.logo instanceof File)
	);
	const sections = [
		{
			id: 'identity',
			title: 'Masjid Information',
			description: 'Personalise your display name, logo and announcements.',
			keys: ['logo', 'title', 'subtitle', 'carouselDuration']
		},
		{
			id: 'location',
			title: 'Location & calendar',
			description:
				'Use the mosque’s decimal coordinates. Latitude: -90 to 90. Longitude: -180 to 180. Hijri adjustment is measured in days.',
			keys: ['latitude', 'longitude', 'hijriAdj']
		},
		{
			id: 'prayer',
			title: 'Daily prayer timings',
			description: 'Set the countdown and screen durations. All values below are in minutes.',
			keys: ['beforeNotice', 'beforeAdhan', 'adhanDuration', 'beforeIqamah', 'prayerDuration']
		},
		{
			id: 'adjustments',
			title: 'Prayer time adjustments',
			description:
				'Minutes added to calculated times: positive is later, negative is earlier. Imsyak follows adjusted Subuh minus 10 minutes, plus its own adjustment.',
			keys: TIMED_PRAYERS.map((prayer) => `adjustment${prayer}`)
		},
		{
			id: 'iqamah',
			title: 'Iqamah countdown',
			description:
				'Minutes after the adzan screen ends. Set 0 to skip the countdown. Friday Dzuhur uses the Jumuah sequence instead.',
			keys: IQAMAH_PRAYERS.map((prayer) => `iqamah${prayer}`)
		},
		{
			id: 'special',
			title: 'Jumuah & Taraweeh',
			description: 'Configure Friday and Taraweeh screen timings in minutes.',
			keys: ['jumuahDuration', 'taraweehFromIsya', 'taraweehDuration']
		}
	];
	const help: Partial<Record<keyof ConfigType, string>> = {
		logo: 'JPG, PNG, WebP or SVG. Maximum 5 MB.',
		carouselDuration: 'Seconds each announcement stays on screen.',
		hijriAdj: 'Use 0 for no adjustment, or a negative value for an earlier date.',
		beforeNotice: 'Countdown before Imsyak and Syuruq.',
		beforeAdhan: 'Countdown leading up to the prayer time.',
		adhanDuration: 'How long the adzan message is displayed.',
		beforeIqamah:
			'Fallback for prayers without an individual countdown. Individual values below take priority.',
		prayerDuration: 'How long the prayer screen stays visible.',
		taraweehFromIsya: 'Time from Isya until the Taraweeh session.'
	};
	async function loadConfig() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/config');
			if (!res.ok) throw new Error(`Unable to load config (${res.status})`);

			const data = await res.json();
			loaded = true;

			configValues = withPrayerDefaults(data);

			logoUrl = data?.logo ?? undefined;
			updatedAt = data?.updatedAt;
			savedValues = JSON.stringify(configValues);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}

	onMount(loadConfig);

	async function submit() {
		if (saving || loading || !loaded) return;
		saving = true;
		error = '';
		success = '';

		const formData = new FormData();

		for (const [key, value] of Object.entries(configValues)) {
			if (value === null || value === undefined) continue;

			// If File
			if (value instanceof File) {
				formData.append(key, value);
			}
			// If number
			else if (typeof value === 'number') {
				formData.append(key, value.toString());
			}
			// If string
			else {
				formData.append(key, value);
			}
		}

		try {
			const res = await fetch('/api/config', {
				method: 'POST',
				body: formData
			});
			if (!res.ok) throw new Error(`Unable to save config (${res.status})`);

			const { data } = await res.json();
			configValues = withPrayerDefaults(data);
			logoUrl = data.logo ?? undefined;
			updatedAt = data.updatedAt;
			savedValues = JSON.stringify(configValues);
			success = 'Settings saved. Your display has been updated.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Something went wrong. Please try again.';
		} finally {
			loading = false;
			saving = false;
		}
	}
</script>

<svelte:head><title>Display settings | Manar</title></svelte:head>

<div class="m-auto my-2 w-4xl max-w-[95vw] space-y-4 md:my-4 md:max-w-[90vw]">
	<header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-semibold">App Config</h1>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button href="/" class="min-h-8">Open display</Button>
			<Button href="/upload" class="min-h-8">Manage media</Button>
		</div>
	</header>

	<div class="space-y-4 rounded-md bg-foreground p-4 text-primary shadow-sm">
		{#if error}
			<div
				role="alert"
				class="mb-4 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
			>
				<p>{error}</p>
				{#if !loaded}<Button type="button" variant="outline" onclick={loadConfig} disabled={loading}
						>Try again</Button
					>{/if}
			</div>
		{/if}
		{#if loading && !loaded}
			<div role="status" class="flex items-center justify-center gap-3 rounded-xl bg-white p-12">
				<Loader class="size-5 animate-spin motion-reduce:animate-none" /> Loading settings…
			</div>
		{/if}
		{#if loaded}
			<nav aria-label="Settings sections" class="mb-6 flex hidden flex-wrap gap-2">
				{#each sections as section}
					<Button
						href={`#${section.id}`}
						variant="outline"
						class="min-h-11 rounded-full bg-white text-slate-700">{section.title}</Button
					>
				{/each}
			</nav>
			<form
				onsubmit={(event) => {
					event.preventDefault();
					submit();
				}}
				oninput={() => (success = '')}
				class="space-y-5"
			>
				<fieldset disabled={loading || saving} class="min-w-0 space-y-5">
					{#each sections as section, index}
						{#if index > 0}<Separator class="my-8 bg-gray-200" />{/if}
						<Card.Root
							id={section.id}
							class="scroll-mt-6 gap-5 rounded-none border-0 bg-transparent py-0 text-primary shadow-none"
						>
							<Card.Header class="px-0">
								<Card.Title class="text-xl">{section.title}</Card.Title>
								<Card.Description class="text-sm leading-relaxed text-slate-500"
									>{section.description}</Card.Description
								>
							</Card.Header>
							<Card.Content class="grid gap-6 px-0 sm:grid-cols-2">
								{#each fields.filter((field) => section.keys.includes(field.key)) as field}
									{@const key = field.key}
									<div class={field.type === 'image' ? 'sm:col-span-2' : 'min-w-0'}>
										{#if field.type === 'image'}
											{#key updatedAt}
												<ConfigInput
													disabled={loading || saving}
													type="image"
													label={field.label}
													description={help[key]}
													src={logoUrl}
													bind:value={configValues[key] as File | undefined}
												/>
											{/key}
										{:else if field.type === 'string'}
											<ConfigInput
												disabled={loading || saving}
												type="string"
												label={field.label}
												description={help[key]}
												placeholder={field.placeholder}
												bind:value={configValues[key] as string}
											/>
										{:else}
											<ConfigInput
												disabled={loading || saving}
												type="number"
												label={field.label}
												description={help[key]}
												placeholder={field.placeholder}
												minValue={key === 'latitude'
													? -90
													: key === 'longitude'
														? -180
														: field.minValue}
												maxValue={key === 'latitude'
													? 90
													: key === 'longitude'
														? 180
														: field.maxValue}
												withButton={field.withButton}
												bind:value={configValues[key] as number}
											/>
										{/if}
									</div>
								{/each}
							</Card.Content>
						</Card.Root>
					{/each}
				</fieldset>
				<div
					class="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-gray-200 bg-foreground py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between"
				>
					<div role="status" aria-live="polite" class="text-sm text-slate-600">
						{#if saving}Saving settings…
						{:else if dirty}You have unsaved changes.
						{:else if success}<span class="text-emerald-700">{success}</span>
						{:else if updatedAt}Last saved: {new Date(updatedAt).toLocaleString()}
						{:else}Save your settings to update the display.{/if}
					</div>
					<Button type="submit" disabled={loading || saving} class="min-h-12 w-full px-6 sm:w-auto">
						{#if saving}<Loader class="size-4 animate-spin motion-reduce:animate-none" />{/if}
						{saving ? 'Saving…' : 'Save settings'}
					</Button>
				</div>
			</form>
		{/if}
	</div>
</div>
