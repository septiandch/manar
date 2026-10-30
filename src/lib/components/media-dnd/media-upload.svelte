<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ImageUp, Loader, Upload } from '@lucide/svelte';

	let { onupload }: { onupload: (data: FormData) => Promise<void> } = $props();

	let ref: HTMLInputElement | null = $state(null);
	let fileNames: string[] = $state([]);
	let uploading = $state(false);
	let formData: FormData | null = null;

	function onchange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;

		const form = new FormData();

		for (const file of input.files) {
			form.append('files', file);
			fileNames = [...fileNames, file.name];
		}

		formData = form;
	}

	async function upload() {
		if (!!ref && !!formData) {
			uploading = true;
			try {
				await onupload(formData);
				formData = null;
				ref.value = '';
				fileNames = [];
			} finally {
				uploading = false;
			}
		}
	}

	const fileCount = $derived(fileNames.length);

	const label = $derived(() => {
		if (fileCount === 0) return 'Pilih berkas';
		if (fileCount === 1) return '1 berkas dipilih';
		return `${fileCount} berkas dipilih`;
	});
</script>

<h1 class="text-xl font-semibold">Pilih gambar atau video</h1>

<div class="flex w-full flex-col items-end gap-4">
	<input bind:this={ref} type="file" multiple accept="image/*,video/*" {onchange} hidden />

	<Button
		variant="ghost"
		class="h-32 w-full gap-4 rounded-md border border-dashed border-primary bg-primary/8 hover:cursor-pointer hover:bg-primary/12 hover:text-primary"
		onclick={() => ref?.click()}
	>
		<ImageUp class="ml-2 size-6" />

		<span class="text-xl">
			{label()}
		</span>
	</Button>

	<Button class="w-full" onclick={upload}>
		{#if uploading}
			<Loader />
		{:else}
			<Upload />
			<span>Unggah</span>
		{/if}
	</Button>
</div>
