<script lang="ts">
	import { dev } from '$app/environment';
	import { RenderScan } from 'svelte-render-scan';
	import '../app.css';
	let { children } = $props();
	console.log('children', children);
</script>

{@render children()}

{#if dev}
	<RenderScan />
{/if}
