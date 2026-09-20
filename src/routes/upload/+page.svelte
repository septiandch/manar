<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { MediaUpload } from '@/components/media-dnd';
	import MediaDnd from '@/components/media-dnd/media-dnd.svelte';
	import type { CarouselMediaType } from '@/components/ui/carousel';
	import { onMount } from 'svelte';

	let media: CarouselMediaType[] = $state([]);

	async function load() {
		const res = await fetch('/api/media');
		if (!res.ok) throw new Error(`Unable to load media (${res.status})`);
		const data = await res.json();

		media = data.map((m: any) => ({
			...m,
			id: m.name
		}));
	}

	onMount(load);

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

<div class="m-auto my-2 w-4xl max-w-[95vw] space-y-4 md:my-4 md:max-w-[90vw]">
	<header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-semibold">Media Upload</h1>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button href="/" class="min-h-8">Open display</Button>
			<Button href="/config" class="min-h-8">Configure</Button>
		</div>
	</header>

	<div class="space-y-4 rounded-md bg-foreground p-4 text-primary shadow-sm">
		<MediaUpload {onupload} />

		<Separator class="my-8 bg-gray-200" />

		<h1 class="text-xl font-semibold">Uploaded Media</h1>

		<MediaDnd bind:media {onchange} {onremove} />
	</div>
</div>
