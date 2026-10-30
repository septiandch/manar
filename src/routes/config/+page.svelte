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
				label: `${prayer} penyesuaian (menit)`,
				minValue: -180,
				maxValue: 180,
				withButton: true
			})
		),
		...IQAMAH_PRAYERS.map(
			(prayer): ConfigField => ({
				key: `iqamah${prayer}`,
				type: 'number',
				label: `${prayer} hitung mundur ikamah (menit)`,
				minValue: 0,
				maxValue: 180,
				withButton: true
			})
		),
		{ key: 'logo', type: 'image', label: 'Logo', placeholder: 'Pilih berkas' },
		{ key: 'title', type: 'string', label: 'Nama masjid', placeholder: 'Contoh: Masjid Al-Ikhlas' },
		{ key: 'subtitle', type: 'string', label: 'Alamat atau keterangan', placeholder: 'Keterangan' },
		{
			key: 'carouselDuration',
			type: 'number',
			label: 'Durasi tayangan media (detik)',
			placeholder: 'duration (second)',
			minValue: 5,
			withButton: true
		},
		{
			key: 'hijriAdj',
			type: 'number',
			label: 'Penyesuaian tanggal Hijriah (hari)',
			placeholder: 'day',
			minValue: -3,
			withButton: true
		},
		{ key: 'latitude', type: 'number', label: 'Lintang', placeholder: 'Lintang' },
		{ key: 'longitude', type: 'number', label: 'Bujur', placeholder: 'Bujur' },
		{
			key: 'beforeNotice',
			type: 'number',
			label: 'Hitung mundur Imsyak/Syuruq (menit)',
			placeholder: 'durasi (menit)',
			minValue: 0,
			withButton: true
		},
		{
			key: 'beforeAdhan',
			type: 'number',
			label: 'Hitung mundur azan (menit)',
			placeholder: 'durasi (menit)',
			minValue: 1,
			withButton: true
		},
		{
			key: 'adhanDuration',
			type: 'number',
			label: 'Durasi tampilan azan (menit)',
			placeholder: 'durasi (menit)',
			minValue: 5,
			withButton: true
		},
		{
			key: 'beforeIqamah',
			type: 'number',
			label: 'Default hitung mundur ikamah (menit)',
			placeholder: 'durasi (menit)',
			minValue: 5,
			withButton: true
		},
		{
			key: 'prayerDuration',
			type: 'number',
			label: 'Durasi tampilan salat (menit)',
			placeholder: 'durasi (menit)',
			minValue: 5,
			withButton: true
		},
		{
			key: 'jumuahDuration',
			type: 'number',
			label: 'Durasi salat Jumat (menit)',
			placeholder: 'durasi (menit)',
			minValue: 5,
			withButton: true
		},
		{
			key: 'taraweehFromIsya',
			type: 'number',
			label: 'Jeda Isya ke Tarawih (menit)',
			placeholder: 'durasi (menit)',
			minValue: 0,
			withButton: true
		},
		{
			key: 'taraweehDuration',
			type: 'number',
			label: 'Durasi Tarawih (menit)',
			placeholder: 'durasi (menit)',
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
			title: 'Informasi masjid',
			description: 'Atur nama masjid, logo, dan tayangan informasi.',
			keys: ['logo', 'title', 'subtitle', 'carouselDuration']
		},
		{
			id: 'location',
			title: 'Lokasi dan kalender',
			description:
				'Gunakan koordinat desimal masjid. Lintang: -90 hingga 90. Bujur: -180 hingga 180. Penyesuaian Hijriah dalam hari.',
			keys: ['latitude', 'longitude', 'hijriAdj']
		},
		{
			id: 'prayer',
			title: 'Waktu salat harian',
			description: 'Atur hitung mundur dan durasi tampilan. Semua nilai di bawah dalam menit.',
			keys: ['beforeNotice', 'beforeAdhan', 'adhanDuration', 'beforeIqamah', 'prayerDuration']
		},
		{
			id: 'adjustments',
			title: 'Penyesuaian waktu salat',
			description:
				'Nilai positif memundurkan waktu, nilai negatif memajukan waktu. Imsyak mengikuti Subuh dikurangi 10 menit, ditambah penyesuaiannya sendiri.',
			keys: TIMED_PRAYERS.map((prayer) => `adjustment${prayer}`)
		},
		{
			id: 'iqamah',
			title: 'Hitung mundur ikamah',
			description:
				'Dihitung sejak tampilan azan berakhir. Isi 0 untuk melewati hitung mundur. Dzuhur hari Jumat mengikuti rangkaian salat Jumat.',
			keys: IQAMAH_PRAYERS.map((prayer) => `iqamah${prayer}`)
		},
		{
			id: 'special',
			title: 'Jumat dan Tarawih',
			description: 'Atur durasi tampilan Jumat dan Tarawih dalam menit.',
			keys: ['jumuahDuration', 'taraweehFromIsya', 'taraweehDuration']
		}
	];
	const help: Partial<Record<keyof ConfigType, string>> = {
		logo: 'JPG, PNG, WebP, atau SVG. Maksimal 5 MB.',
		carouselDuration: 'Lama setiap media ditampilkan, dalam detik.',
		hijriAdj: 'Isi 0 tanpa penyesuaian, atau nilai negatif untuk memundurkan tanggal.',
		beforeNotice: 'Hitung mundur sebelum Imsyak dan Syuruq.',
		beforeAdhan: 'Hitung mundur menjelang waktu salat.',
		adhanDuration: 'Lama pesan azan ditampilkan.',
		beforeIqamah:
			'Digunakan jika hitung mundur per salat belum diatur. Pengaturan per salat di bawah lebih diutamakan.',
		prayerDuration: 'Lama tampilan salat ditampilkan.',
		taraweehFromIsya: 'Jeda dari Isya hingga Tarawih.'
	};
	async function loadConfig() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/config');
			if (!res.ok) throw new Error(`Tidak dapat memuat pengaturan (${res.status})`);

			const data = await res.json();
			loaded = true;

			configValues = withPrayerDefaults(data);

			logoUrl = data?.logo ?? undefined;
			updatedAt = data?.updatedAt;
			savedValues = JSON.stringify(configValues);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Terjadi kesalahan. Silakan coba lagi.';
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
			if (!res.ok) throw new Error(`Tidak dapat menyimpan pengaturan (${res.status})`);

			const { data } = await res.json();
			configValues = withPrayerDefaults(data);
			logoUrl = data.logo ?? undefined;
			updatedAt = data.updatedAt;
			savedValues = JSON.stringify(configValues);
			success = 'Pengaturan tersimpan. Tampilan TV telah diperbarui.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Terjadi kesalahan. Silakan coba lagi.';
		} finally {
			loading = false;
			saving = false;
		}
	}
</script>

<svelte:head><title>Pengaturan tampilan | Manar</title></svelte:head>

<div class="mx-auto w-full max-w-5xl space-y-6 px-5 py-10 sm:px-8">
	<header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-semibold">Pengaturan</h1>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button href="/display" class="min-h-8">Buka tampilan TV</Button>
			<Button href="/upload" class="min-h-8">Kelola media</Button>
		</div>
	</header>

	<div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
		{#if error}
			<div
				role="alert"
				class="mb-4 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
			>
				<p>{error}</p>
				{#if !loaded}<Button type="button" variant="outline" onclick={loadConfig} disabled={loading}
						>Coba lagi</Button
					>{/if}
			</div>
		{/if}
		{#if loading && !loaded}
			<div role="status" class="flex items-center justify-center gap-3 rounded-xl bg-white p-12">
				<Loader class="size-5 animate-spin motion-reduce:animate-none" /> Memuat pengaturan…
			</div>
		{/if}
		{#if loaded}
			<nav aria-label="Bagian pengaturan" class="mb-6 flex hidden flex-wrap gap-2">
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
						{#if saving}Menyimpan pengaturan...
						{:else if dirty}Ada perubahan yang belum disimpan.
						{:else if success}<span class="text-emerald-700">{success}</span>
						{:else if updatedAt}Terakhir disimpan: {new Date(updatedAt).toLocaleString('id-ID')}
						{:else}Simpan pengaturan untuk memperbarui tampilan TV.{/if}
					</div>
					<Button type="submit" disabled={loading || saving} class="min-h-12 w-full px-6 sm:w-auto">
						{#if saving}<Loader class="size-4 animate-spin motion-reduce:animate-none" />{/if}
						{saving ? 'Menyimpan...' : 'Simpan pengaturan'}
					</Button>
				</div>
			</form>
		{/if}
	</div>
</div>
