<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	$effect(() => {
		document.documentElement.classList.toggle('home-cursor-hidden', page.url.pathname === '/');
		return () => document.documentElement.classList.remove('home-cursor-hidden');
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

<style>
	:global(html.home-cursor-hidden),
	:global(html.home-cursor-hidden *) {
		cursor: none !important;
	}
</style>
