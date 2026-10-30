<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { MediaUpload } from '@/components/media-dnd';
	import MediaDnd from '@/components/media-dnd/media-dnd.svelte';
	import type { CarouselMediaType } from '@/components/ui/carousel';
	import { onMount } from 'svelte';

	let media: CarouselMediaType[] = $state([]);
	let error = $state('');
	let loading = $state(true);

	async function load() {
		const res = await fetch('/api/media');
		if (!res.ok) throw new Error(`Unable to load media (${res.status})`);
		const data = await res.json();

		media = data.map((m: any) => ({
			...m,
			id: m.name
		}));
	}

	onMount(() => {
		void load()
			.catch(() => (error = 'We could not load your media. Please refresh and try again.'))
			.finally(() => (loading = false));
	});

	async function api(method: 'POST' | 'PATCH' | 'DELETE', body?: BodyInit) {
		const res = await fetch('/api/media', {
			method,
			body,
			headers: method !== 'POST' ? { 'Content-Type': 'application/json' } : undefined
		});
		if (!res.ok) throw new Error(`Media request failed (${res.status})`);

		await load();
	}

	async function onupload(data: FormData) {
		await api('POST', data);
	}

	async function onchange() {
		await api('PATCH', JSON.stringify(media.map((m) => m.name)));
	}

	async function onremove(name: string) {
		await api('DELETE', JSON.stringify({ filename: name }));
	}
</script>

<svelte:head><title>Media library | Manar</title></svelte:head>
<div class="mx-auto w-full max-w-5xl space-y-6 px-5 py-10 sm:px-8">
	<header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-semibold">Media library</h1>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button href="/display" class="min-h-8">Open display</Button>
			<Button href="/config" class="min-h-8">Configure</Button>
		</div>
	</header>

	<div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
		<MediaUpload {onupload} />

		<Separator class="my-8 bg-gray-200" />

		<h1 class="text-xl font-semibold">Uploaded Media</h1>

		{#if error}<p role="alert" class="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>
		{:else if loading}<p role="status" class="py-8 text-center text-slate-500">
				Loading your media...
			</p>
		{:else if media.length === 0}<p
				class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500"
			>
				Your library is empty. Upload an image or video to get started.
			</p>
		{:else}<MediaDnd bind:media {onchange} {onremove} />{/if}
	</div>
</div>
