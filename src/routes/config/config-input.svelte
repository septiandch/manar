<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { cn } from '$lib/utils/cn';
	import { Minus, Plus, Upload } from '@lucide/svelte';
	import type { ClassValue } from 'clsx';

	type StringType = { type: 'string'; value: string };
	type NumberType = {
		type: 'number';
		value: number;
		minValue?: number;
		maxValue?: number;
		withButton?: boolean;
	};
	type ImageType = { type: 'image'; value?: File; src?: string };
	type CommonType = {
		label: string;
		description?: string;
		placeholder?: string;
		class?: ClassValue;
		disabled?: boolean;
	};

	let {
		type = 'string',
		placeholder = '',
		value = $bindable(),
		label,
		description,
		class: className,
		disabled = false,
		...props
	}: (StringType | NumberType | ImageType) & CommonType = $props();
	const id = $props.id();
	let fileInput = $state<HTMLInputElement>();
	let preview = $state<string>();
	let fileError = $state('');

	$effect(() => {
		if (type !== 'image' || !(value instanceof File)) {
			preview = undefined;
			return;
		}
		const url = URL.createObjectURL(value);
		preview = url;
		return () => URL.revokeObjectURL(url);
	});

	function chooseImage(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!/\.(jpg|jpeg|png|webp|svg)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
			fileError = 'Choose a JPG, PNG, WebP or SVG image smaller than 5 MB.';
			input.value = '';
			return;
		}
		fileError = '';
		value = file;
	}
</script>

<div class={cn('min-w-0 space-y-2', className)}>
	<Label for={id} class="text-sm font-semibold text-slate-900">{label}</Label>
	{#if type === 'image'}
		{@const { src } = props as ImageType}
		<div class="flex flex-wrap items-center gap-4">
			<div
				class="flex size-20 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2"
			>
				{#if preview || src}
					<img
						src={preview || src}
						alt="Mosque logo preview"
						class="max-h-full max-w-full object-contain"
					/>
				{:else}
					<Upload class="size-6 text-slate-400" aria-hidden="true" />
				{/if}
			</div>
			<div class="min-w-0 flex-1 space-y-2">
				<input
					bind:this={fileInput}
					{id}
					type="file"
					class="sr-only"
					{disabled}
					accept=".jpg,.jpeg,.png,.webp,.svg"
					onchange={chooseImage}
					aria-describedby={`${id}-help`}
				/>
				<Button
					type="button"
					variant="outline"
					{disabled}
					onclick={() => fileInput?.click()}
					class="min-h-11 bg-white text-slate-900"
				>
					<Upload class="size-4" /> Choose logo
				</Button>
				{#if value instanceof File}<p class="truncate text-sm text-slate-600">{value.name}</p>{/if}
			</div>
		</div>
		{#if fileError}<p role="alert" class="text-sm text-red-700">{fileError}</p>{/if}
	{:else if type === 'number'}
		{@const { withButton, minValue, maxValue } = props as NumberType}
		<div class="flex items-center gap-2">
			{#if withButton}
				<Button
					type="button"
					variant="outline"
					class="size-11 shrink-0 bg-white text-slate-900"
					disabled={disabled || (minValue !== undefined && Number(value) <= minValue)}
					aria-label={`Kurangi ${label}`}
					onclick={() => (value = Math.max(minValue ?? -Infinity, (Number(value) || 0) - 1))}
				>
					<Minus class="size-4" />
				</Button>
			{/if}
			<Input
				{id}
				{disabled}
				type="number"
				bind:value
				{placeholder}
				min={minValue}
				max={maxValue}
				step={withButton ? 1 : 'any'}
				required
				aria-describedby={description ? `${id}-help` : undefined}
				class="h-11 bg-white text-base text-slate-900 placeholder:text-slate-400 md:text-base"
			/>
			{#if withButton}
				<Button
					type="button"
					variant="outline"
					class="size-11 shrink-0 bg-white text-slate-900"
					disabled={disabled || (maxValue !== undefined && Number(value) >= maxValue)}
					aria-label={`Tambah ${label}`}
					onclick={() => (value = Math.min(maxValue ?? Infinity, (Number(value) || 0) + 1))}
				>
					<Plus class="size-4" />
				</Button>
			{/if}
		</div>
	{:else}
		<Input
			{id}
			{disabled}
			bind:value
			{placeholder}
			aria-describedby={description ? `${id}-help` : undefined}
			class="h-11 bg-white text-base text-slate-900 placeholder:text-slate-400 md:text-base"
		/>
	{/if}
	{#if description}<p id={`${id}-help`} class="text-sm leading-relaxed text-slate-500">
			{description}
		</p>{/if}
</div>
