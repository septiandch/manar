<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();
	onMount(() => {
		let current: string | null = null;
		let checking = false;
		const abort = new AbortController();
		async function checkRelease() {
			if (checking) return;
			checking = true;
			try {
				const response = await fetch('/api/version', { cache: 'no-store', signal: abort.signal });
				if (!response.ok) return;
				const { version } = await response.json();
				if (typeof version !== 'string' || !version) return;
				if (current && current !== version && location.pathname === '/display') location.reload();
				current = version;
			} catch {
				/* Retry after a server restart or network interruption. */
			} finally {
				checking = false;
			}
		}
		void checkRelease();
		const timer = setInterval(checkRelease, 30000);
		return () => {
			clearInterval(timer);
			abort.abort();
		};
	});

	$effect(() => {
		document.documentElement.classList.toggle(
			'home-cursor-hidden',
			page.url.pathname === '/display'
		);
		return () => document.documentElement.classList.remove('home-cursor-hidden');
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if page.url.pathname === '/display'}
	{@render children()}
{:else}
	<div class="management min-h-screen bg-slate-50 text-slate-900">
		<header class="px-5 pt-8 text-center sm:px-8">
			<a
				href="/"
				class="inline-flex items-center justify-center gap-2 text-xl font-semibold tracking-tight text-emerald-800 sm:text-4xl"
			>
				<span class="italic">Manar</span>
				<span class="text-sm font-normal text-gray-600 sm:text-xl">| Media Syiar Al-Ikhlash</span>
			</a>
		</header>
		{@render children()}
		<footer class="mx-auto max-w-6xl px-5 py-8 text-center text-sm text-slate-500 sm:px-8">
			{page.url.hostname}:{page.url.port || (page.url.protocol === 'https:' ? '443' : '80')}
		</footer>
	</div>
{/if}

<style>
	.management {
		--background: #f8fafc;
		--foreground: #ffffff;
		--primary: #047857;
		--primary-foreground: #ffffff;
		--border: #e2e8f0;
		--input: #ffffff;
		--input-foreground: #0f172a;
		--ring: #047857;
	}
	.management :global(button),
	.management :global(input),
	.management :global(select) {
		min-height: 44px;
	}
	.management :global(button) {
		cursor: pointer;
	}
	.management :global(button:disabled) {
		cursor: default;
	}
	:global(html.home-cursor-hidden),
	:global(html.home-cursor-hidden *) {
		cursor: none !important;
	}
</style>
