<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	let code = $state(''),
		error = $state(''),
		busy = $state(false);
	onMount(() => {
		if (localStorage.getItem('mirrorSenderToken')) {
			void goto('/admin/mirror');
			return;
		}
		let socket: WebSocket | undefined;
		let disposed = false;
		let retryTimer: ReturnType<typeof setTimeout>;
		let delay = 500;
		function open() {
			socket = new WebSocket(
				`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/mirror-ws?role=pairing`
			);
			socket.onopen = () => {
				delay = 500;
			};
			socket.onclose = () => {
				if (!disposed) {
					retryTimer = setTimeout(open, delay);
					delay = Math.min(delay * 2, 8000);
				}
			};
		}
		const heartbeat = setInterval(() => {
			if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
		}, 1000);
		const close = () => {
			disposed = true;
			clearInterval(heartbeat);
			clearTimeout(retryTimer);
			socket?.close();
		};
		window.addEventListener('pagehide', close);
		open();
		return () => {
			close();
			window.removeEventListener('pagehide', close);
		};
	});
	async function connect() {
		if (busy) return;
		error = '';
		const normalized = code.normalize('NFKC').replace(/[\s-]/g, '');
		if (!/^[0-9]{6}$/.test(normalized)) {
			error = 'Masukkan kode enam angka yang muncul di TV, misalnya 123456.';
			return;
		}
		code = normalized;
		busy = true;
		try {
			const res = await fetch('/mirror-pair', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: normalized })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);
			localStorage.setItem('mirrorSenderToken', data.token);
			await goto('/admin/mirror');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Tidak dapat terhubung. Silakan coba lagi.';
		} finally {
			busy = false;
		}
	}
</script>

<main
	class="mx-auto my-10 max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
>
	<h1 class="text-3xl font-bold">Hubungkan ke TV</h1>
	<p>Masukkan kode enam angka yang muncul di TV. Kode berubah setiap dua menit.</p>
	<form
		novalidate
		onsubmit={(e) => {
			e.preventDefault();
			void connect();
		}}
		class="space-y-4"
	>
		<label class="block"
			>Kode penghubung <input
				bind:value={code}
				inputmode="numeric"
				autocomplete="one-time-code"
				required
				placeholder="123456"
				aria-invalid={!!error}
				aria-describedby={error ? 'pairing-error' : undefined}
				class="mt-3 block w-full rounded-xl border border-slate-300 bg-slate-50 p-4 text-center font-mono text-3xl tracking-widest focus:outline-2 focus:outline-emerald-600"
			/></label
		>
		<button
			disabled={busy}
			class="w-full rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-50"
			>{busy ? 'Menghubungkan...' : 'Hubungkan'}</button
		>
	</form>
	{#if error}<p id="pairing-error" role="alert">{error}</p>{/if}
</main>
