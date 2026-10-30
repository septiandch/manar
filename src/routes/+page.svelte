<script lang="ts">
	import { Monitor, Cast, Settings, Images, ArrowUpRight } from '@lucide/svelte';
	const items = [
		{
			href: '/display',
			title: 'Display',
			description: 'Open the prayer schedule and slideshow on your TV.',
			icon: Monitor,
			label: 'Open display'
		},
		{
			href: '/connect',
			title: 'Cast your screen',
			description: 'Connect your laptop and share a screen with the community.',
			icon: Cast,
			label: 'Connect to TV'
		},
		{
			href: '/config',
			title: 'Settings',
			description: 'Update mosque details, prayer times, and display preferences.',
			icon: Settings,
			label: 'Manage settings'
		},
		{
			href: '/upload',
			title: 'Media library',
			description: 'Upload and arrange the images and videos on your display.',
			icon: Images,
			label: 'Manage media'
		}
	];
</script>

<svelte:head><title>Manar | Home</title></svelte:head>
<main class="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
	<p class="mb-3 text-sm font-semibold tracking-widest text-emerald-700 uppercase">
		Welcome to Manar
	</p>
	<h1 class="text-3xl font-semibold tracking-tight sm:text-5xl">Your community, on display.</h1>
	<p class="mt-4 max-w-xl text-lg text-slate-600">
		Everything you need to keep your display up to date. Choose where you would like to go.
	</p>
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
