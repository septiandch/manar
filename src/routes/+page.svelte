<script lang="ts">
	import { Monitor, Cast, Settings, Images, ArrowUpRight } from '@lucide/svelte';
	const items = [
		{
			href: '/display',
			title: 'Tampilan TV',
			description: 'Tampilkan jadwal salat dan tayangan media di TV.',
			icon: Monitor,
			label: 'Buka tampilan TV'
		},
		{
			href: '/connect',
			title: 'Bagikan layar',
			description: 'Hubungkan laptop dan bagikan layar ke TV.',
			icon: Cast,
			label: 'Hubungkan ke TV'
		},
		{
			href: '/config',
			title: 'Pengaturan',
			description: 'Atur informasi masjid, waktu salat, dan tampilan TV.',
			icon: Settings,
			label: 'Kelola pengaturan'
		},
		{
			href: '/upload',
			title: 'Koleksi media',
			description: 'Unggah dan susun gambar serta video untuk ditampilkan.',
			icon: Images,
			label: 'Kelola media'
		}
	];
</script>

<svelte:head><title>Manar | Beranda</title></svelte:head>
<main class="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
	<div class="mt-10 grid gap-5 sm:grid-cols-2">
		{#each items as item}<a
				href={item.href}
				class="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:border-emerald-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
			>
				<item.icon size={28} class="mb-6 text-emerald-700" />
				<h2 class="text-2xl font-semibold">{item.title}</h2>
				<p class="mt-2 min-h-12 text-base text-slate-600">{item.description}</p>
				<span class="mt-6 flex items-center gap-2 font-medium text-emerald-700"
					>{item.label}<ArrowUpRight size={18} /></span
				>
			</a>{/each}
	</div>
</main>
