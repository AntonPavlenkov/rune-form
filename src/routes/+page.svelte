<script lang="ts">
	import FormTester from './FormTester.svelte';
</script>

<!-- Hero Section -->
<section class="bg-gradient-to-br from-amber-100 to-emerald-50 px-4 py-12 text-center">
	<h1 class="mb-2 text-4xl font-bold">RuneForm for SvelteKit</h1>
	<p class="mx-auto mb-4 max-w-2xl text-lg text-gray-700">
		A type-safe, deeply reactive, and ergonomic form builder for Svelte 5. Powered by Zod for
		validation, with full support for nested objects, arrays, and custom constraints. Minimal
		boilerplate, maximum flexibility.
	</p>
	<a
		href="https://github.com/AntonPavlenkov/rune-form"
		target="_blank"
		class="mt-2 inline-block rounded bg-amber-400 px-6 py-2 text-white shadow transition hover:bg-amber-500"
		>GitHub</a
	>
</section>

<!-- Documentation Section -->
<section class="mx-auto max-w-3xl px-4 py-10">
	<h2 class="mb-4 text-2xl font-semibold">How RuneForm Works</h2>
	<ul class="mb-6 list-disc pl-6 text-left text-gray-800">
		<li><b>Type-safe:</b> All form data and errors are fully typed via your Zod schema.</li>
		<li>
			<b>Deep reactivity:</b> Changes to any nested field or array are instantly reflected in the UI.
		</li>
		<li>
			<b>Validation:</b> Uses Zod for synchronous and async validation, with error mapping to fields.
		</li>
		<li><b>Array fields:</b> Add, remove, and reorder array items with full reactivity.</li>
		<li><b>Custom errors:</b> Set custom errors programmatically for any field.</li>
		<li><b>SSR/SSG ready:</b> Works seamlessly with SvelteKit's server-side rendering.</li>
		<li><b>Minimal boilerplate:</b> Just define your schema and bind to <code>form.data</code>.</li>
	</ul>

	<h3 class="mb-2 text-xl font-semibold">Basic Usage</h3>
	<pre class="mb-6 overflow-x-auto rounded bg-gray-100 p-4 text-sm"><code
			>{`import { RuneForm } from '$lib/RuneForm.svelte.js';\nimport { createZodValidator } from '$lib/zodAdapter.js';\nimport { z } from 'zod';\n\nconst schema = z.object({\n  name: z.string().min(2),\n  email: z.string().email()\n});\n\nconst form = new RuneForm(createZodValidator(schema), {});\n`}</code
		></pre>

	<h3 class="mb-2 text-xl font-semibold">Deeply Nested Example</h3>
	<pre class="mb-6 overflow-x-auto rounded bg-gray-100 p-4 text-sm"><code
			>{`z.object({\n  name: z.string().min(2).max(50),\n  email: z.string().email(),\n  password: z.string().min(8).max(50),\n  address: z.object({\n    street: z.string().min(2).max(50),\n    city: z.string().min(2).max(50),\n    state: z.string().min(2).max(50),\n    zip: z.string().min(2).max(50),\n    parkingLots: z.array(\n      z.object({\n        name: z.string().min(5).max(50),\n        lat: z.number(),\n        lng: z.number()\n      })\n    )\n  })\n})`}</code
		></pre>
</section>

<!-- Playground Section -->
<section class="border-t border-b bg-white px-4 py-10">
	<h2 class="mb-4 text-center text-2xl font-semibold">Live Playground</h2>
	<div class="mx-auto max-w-5xl">
		<FormTester />
	</div>
</section>

<!-- API Reference Section -->
<section class="mx-auto max-w-3xl px-4 py-10">
	<h2 class="mb-4 text-2xl font-semibold">API Reference</h2>
	<ul class="mb-6 list-disc pl-6 text-left text-gray-800">
		<li>
			<b>RuneForm&lt;T&gt;:</b> Main class. Use <code>form.data</code> for binding,
			<code>form.errors</code> for error messages.
		</li>
		<li>
			<b>form.getField(path):</b> Get a field object for advanced control (value, error, constraints,
			etc).
		</li>
		<li><b>form.push(path, value):</b> Add an item to an array field.</li>
		<li><b>form.setCustomError(path, message):</b> Set a custom error for a field.</li>
		<li><b>form.validateSchema():</b> Manually trigger validation.</li>
		<li><b>form.enhance:</b> Svelte action for progressive enhancement.</li>
	</ul>
	<h3 class="mb-2 text-xl font-semibold">Advanced Tips</h3>
	<ul class="list-disc pl-6 text-gray-800">
		<li>
			Use <code>form.getField('address.city')</code> for fine-grained control of deeply nested fields.
		</li>
		<li>All state is reactive and SSR-friendly.</li>
		<li>Integrates with any Zod schema, including unions and discriminated unions.</li>
		<li>Use <code>form.setCustomErrors</code> for multiple errors per field.</li>
	</ul>
</section>

<!-- Footer -->
<footer class="mt-8 border-t py-6 text-center text-xs text-gray-500">
	RuneForm &copy; {new Date().getFullYear()} &mdash;
	<a href="https://github.com/AntonPavlenkov/rune-form" class="underline">GitHub</a>
</footer>

<style>
	.input:focus {
		outline: 2px solid #f59e42;
		outline-offset: 2px;
	}
</style>
