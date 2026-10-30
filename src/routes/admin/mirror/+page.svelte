<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Cast } from '@lucide/svelte';
	import { mirror, type MirrorState } from '$lib/webrtc/mirror';
	let token = $state('');
	let error = $state('');
	let mirrorStatus = $state<MirrorState>('IDLE');
	let choosing = $state(false);
	let video: HTMLVideoElement;
	let stop: (() => void) | undefined;
	const active = $derived(mirrorStatus === 'CONNECTING' || mirrorStatus === 'MIRRORING');
	function finish() {
		stop?.();
		stop = undefined;
	}
	async function start() {
		if (choosing || active) return;
		error = '';
		choosing = true;
		try {
			if (!window.isSecureContext)
				throw new Error('Berbagi layar memerlukan koneksi HTTPS yang tepercaya.');
			const capture = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
			finish();
			mirrorStatus = 'CONNECTING';
			stop = mirror('sender', token, video, (s) => (mirrorStatus = s), capture);
			video.srcObject = capture;
			await video.play();
		} catch (e) {
			finish();
			mirrorStatus = 'DISCONNECTED';
			error =
				e instanceof DOMException && e.name === 'NotAllowedError'
					? 'Berbagi layar dibatalkan atau belum diizinkan. Klik Mulai untuk mencoba lagi.'
					: e instanceof Error
						? e.message
						: 'Tidak dapat berbagi layar. Silakan coba lagi.';
		} finally {
			choosing = false;
		}
	}
	onMount(() => {
		token = localStorage.getItem('mirrorSenderToken') || '';
	});
	onDestroy(finish);
</script>

<svelte:head><title>Bagikan layar | Manar</title></svelte:head>
<main
	class="mx-auto my-10 max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8"
>
	<Cast size={32} class="mx-auto text-emerald-700" />
	<h1 class="text-2xl font-semibold">Bagikan layar ke TV</h1>
	<p class="text-slate-600" role="status" aria-live="polite">
		{#if !token}Hubungkan perangkat menggunakan kode di TV.
		{:else if choosing}Pilih layar yang ingin dibagikan.
		{:else if mirrorStatus === 'MIRRORING'}Layar Anda sedang dibagikan.
		{:else if mirrorStatus === 'CONNECTING'}Menghubungkan ke TV...
		{:else}Tekan Mulai, lalu pilih layar yang ingin dibagikan.{/if}
	</p>
	<video
		bind:this={video}
		muted
		autoplay
		playsinline
		class:hidden={!active}
		class="aspect-video w-full rounded-xl bg-slate-950 object-contain"
		><track kind="captions" /></video
	>
	{#if !token}
		<a
			href="/connect"
			class="block rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800"
			>Hubungkan ke TV</a
		>
	{:else}
		<button
			class="w-full rounded-xl px-6 py-3 font-semibold text-white disabled:opacity-50 {active
				? 'bg-red-600 hover:bg-red-700'
				: 'bg-emerald-700 hover:bg-emerald-800'}"
			disabled={choosing}
			onclick={() => (active ? finish() : void start())}
		>
			{active ? 'Berhenti' : choosing ? 'Memilih layar...' : 'Mulai'}
		</button>
	{/if}
	{#if error}<p role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>{/if}
	{#if token && !active && !choosing}
		<button
			class="text-sm text-slate-500 underline underline-offset-4 hover:text-emerald-700"
			onclick={() => {
				finish();
				localStorage.removeItem('mirrorSenderToken');
				token = '';
				void goto('/connect');
			}}>Hubungkan ulang</button
		>
	{/if}
</main>
