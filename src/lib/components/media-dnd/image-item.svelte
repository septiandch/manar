<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { CarouselMediaType } from '@/components/ui/carousel';
	import { GripVertical, X, Download } from '@lucide/svelte';
	import { dragHandle } from 'svelte-dnd-action';

	type Props = {
		item: CarouselMediaType;
		onremove: (name: string) => void;
	};

	let { item, onremove }: Props = $props();
</script>

<div
	class="flex items-center justify-between gap-2 rounded-lg border bg-input p-2 ring ring-transparent hover:ring-primary"
>
	<div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
		<button
			type="button"
			use:dragHandle
			aria-label={`Reorder ${item.name}`}
			class="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground select-none active:cursor-grabbing"
		>
			<GripVertical />
		</button>

		<div
			class="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4"
		>
			{#if item.type === 'image'}
				<img
					src={item.url}
					alt={item.name}
					class="h-24 w-24 max-w-full shrink-0 rounded border object-cover"
					loading="lazy"
				/>
			{:else}
				<video
					src={item.url}
					class="h-24 w-24 max-w-full shrink-0 rounded border object-cover"
					muted
					playsinline
				>
				</video>
			{/if}

			<span class="w-full min-w-0 truncate sm:max-w-44" title={item.name}>{item.name}</span>
		</div>
	</div>

	<div class="flex shrink-0 flex-col justify-between gap-2">
		<Button size="sm" variant="outline" class="h-8" href={item.url} download={item.name}>
			<Download />
			Download
		</Button>

		<Button
			variant="outline"
			class="h-8 border-red-500 text-red-500 hover:bg-red-500/10 hover:text-red-500"
			size="sm"
			onclick={() => onremove(item.name)}
		>
			<X /> Delete
		</Button>
	</div>
</div>
