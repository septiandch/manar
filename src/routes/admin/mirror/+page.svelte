<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { mirror, type MirrorState } from '$lib/webrtc/mirror';
	let token = $state(''),
		error = $state(''),
		mirrorStatus = $state<MirrorState>('IDLE');
	let video: HTMLVideoElement;
	let stop: (() => void) | undefined;
	async function start() {
		error = '';
		try {
			if (!window.isSecureContext) throw new Error('Trusted HTTPS is required for screen capture.');
			const capture = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
			stop?.();
			mirrorStatus = 'CONNECTING';
			stop = mirror('sender', token, video, (s) => (mirrorStatus = s), capture);
			video.srcObject = capture;
			await video.play();
		} catch (e) {
			error = String(e);
			mirrorStatus = 'DISCONNECTED';
		}
	}
	onMount(() => {
		token = localStorage.getItem('mirrorSenderToken') || '';
	});
	onDestroy(() => stop?.());
</script>

<main
	class="mx-auto my-10 max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
>
	<h1 class="text-2xl font-bold">Screen mirroring</h1>
	{#if token}<p>Connected. Choose a screen, window, or tab to share with the TV.</p>
		<button
			class="rounded border p-2"
			onclick={() => {
				stop?.();
				localStorage.removeItem('mirrorSenderToken');
				token = '';
			}}>Forget connection</button
		>
	{:else}<a class="underline" href="/connect">Connect using the code on your TV</a>{/if}
	<p
		class="inline-flex rounded-full bg-emerald-50 px-4 py-2 font-medium text-emerald-800"
		role="status"
	>
		{mirrorStatus === 'MIRRORING'
			? 'Sharing your screen'
			: mirrorStatus === 'CONNECTING'
				? 'Connecting to the display...'
				: 'Ready to share'}
	</p>
	<button
		class="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-50"
		onclick={start}
		disabled={!token || mirrorStatus === 'CONNECTING' || mirrorStatus === 'MIRRORING'}
		>Start Mirroring</button
	>
	<button
		class="rounded-xl border border-slate-300 px-6 py-3 font-semibold"
		onclick={() => {
			stop?.();
			stop = undefined;
		}}>Stop Mirroring</button
	>
	{#if error}<p role="alert">{error}</p>{/if}
	<video
		bind:this={video}
		muted
		autoplay
		playsinline
		class="aspect-video w-full rounded-xl bg-slate-950 object-contain"
		><track kind="captions" /></video
	>
	<a href="/config">Display settings</a>
</main>
