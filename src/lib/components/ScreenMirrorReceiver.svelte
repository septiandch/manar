<script lang="ts">
	import { onMount } from 'svelte';
	import { mirror, type MirrorState } from '$lib/webrtc/mirror';
	let code = $state('');
	let pairingVisible = $state(false);
	let video: HTMLVideoElement;
	let mirrorStatus = $state<MirrorState>('IDLE');
	onMount(() => {
		const token =
			new URL(location.href).searchParams.get('displayToken') ||
			localStorage.getItem('mirrorDisplayToken');
		if (token) {
			localStorage.setItem('mirrorDisplayToken', token);
			return mirror(
				'receiver',
				token,
				video,
				(s) => (mirrorStatus = s),
				undefined,
				(value) => (code = value),
				undefined,
				(visible) => (pairingVisible = visible)
			);
		}
	});
</script>

<div class:hidden={mirrorStatus !== 'MIRRORING'} class="fixed inset-0 z-[100] bg-black">
	<video bind:this={video} autoplay playsinline muted class="h-full w-full object-contain"
		><track kind="captions" /></video
	>
</div>

{#if pairingVisible && code && mirrorStatus !== 'MIRRORING'}
	<div
		class="pointer-events-none absolute inset-0 z-[90] flex items-center justify-center"
		aria-label="Screen sharing pairing code"
	>
		<strong
			class="rounded-2xl bg-black/75 px-8 py-4 font-mono text-[clamp(3rem,10vw,10rem)] leading-none font-bold tracking-widest text-white tabular-nums shadow-xl"
			>{code}</strong
		>
	</div>
{/if}
