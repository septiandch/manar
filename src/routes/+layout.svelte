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
		<header class="border-b border-slate-200 bg-white">
			<nav
				aria-label="Main navigation"
				class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8"
			>
				<a href="/" class="text-2xl font-bold tracking-tight text-emerald-800"
					>Manar<span class="ml-2 text-sm font-normal text-slate-500">Community display</span></a
				>
				<div class="flex flex-wrap gap-1">
					{#each [{ href: '/', label: 'Home' }, { href: '/display', label: 'Display' }, { href: '/connect', label: 'Cast' }, { href: '/config', label: 'Settings' }, { href: '/upload', label: 'Media' }] as link}
						<a
							href={link.href}
							aria-current={page.url.pathname === link.href ||
							(link.href === '/connect' && page.url.pathname === '/admin/mirror')
								? 'page'
								: undefined}
							class="rounded-lg px-4 py-2.5 text-base font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 aria-[current=page]:bg-emerald-50 aria-[current=page]:text-emerald-800"
							>{link.label}</a
						>
					{/each}
				</div>
			</nav>
		</header>
		{@render children()}
		<footer class="mx-auto max-w-6xl px-5 py-8 text-sm text-slate-500 sm:px-8">
			Manar � A connected community
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
