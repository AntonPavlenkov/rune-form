<script lang="ts">
	import { RuneForm } from '$lib/RuneForm.svelte.js';
	import { createZodValidator } from '$lib/zodAdapter.js';
	import { z } from 'zod';

	// Default schema as string for playground
	const defaultSchemaString = `z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(50),
  address: z.object({
    street: z.string().min(2).max(50),
    city: z.string().min(2).max(50),
    state: z.string().min(2).max(50),
    zip: z.string().min(2).max(50),
    parkingLots: z.array(
      z.object({
        name: z.string().min(5).max(50),
        lat: z.number(),
        lng: z.number()
      })
    )
  })
})`;

	const basicUsageCode = `import { RuneForm } from '$lib/RuneForm.svelte.js';
import { createZodValidator } from '$lib/zodAdapter.js';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email()
});

const form = new RuneForm(createZodValidator(schema), {});
`;

	let schemaString = defaultSchemaString;
	let schemaError = '';
	let playgroundSchema: z.ZodTypeAny = z.object({});

	function parseSchema(str: string): z.ZodTypeAny {
		try {
			// eslint-disable-next-line no-eval
			const s = eval(str);
			if (!(s instanceof z.ZodType)) throw new Error('Not a Zod schema');
			return s;
		} catch (e) {
			schemaError = e instanceof Error ? e.message : String(e);
			return z.object({});
		}
	}

	$: playgroundSchema = parseSchema(schemaString);

	let form: RuneForm<Record<string, any>>;
	$: form = new RuneForm(createZodValidator(playgroundSchema), {});

	function addArrayItem(path: string, template: any) {
		const arr = path.split('.').reduce((obj, k) => obj?.[k], form.data);
		if (Array.isArray(arr)) arr.push(structuredClone(template));
	}
	function removeArrayItem(path: string, i: number) {
		const arr = path.split('.').reduce((obj, k) => obj?.[k], form.data);
		if (Array.isArray(arr)) arr.splice(i, 1);
	}

	// Helper to get a template for new array items
	function getArrayTemplate(arr: any[]): any {
		if (arr.length > 0) return structuredClone(arr[0]);
		return {};
	}
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
	<pre class="mb-6 overflow-x-auto rounded bg-gray-100 p-4 text-sm"><code>{basicUsageCode}</code
		></pre>

	<h3 class="mb-2 text-xl font-semibold">Deeply Nested Example</h3>
	<pre class="mb-6 overflow-x-auto rounded bg-gray-100 p-4 text-sm"><code
			>{defaultSchemaString}</code
		></pre>
</section>

<!-- Playground Section -->
<section class="border-t border-b bg-white px-4 py-10">
	<h2 class="mb-4 text-center text-2xl font-semibold">Live Playground</h2>
	<div class="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
		<div>
			<label class="mb-2 block font-semibold">Edit Zod Schema</label>
			<textarea
				bind:value={schemaString}
				rows={18}
				spellcheck={false}
				class="min-h-[300px] w-full resize-y rounded border bg-gray-50 p-2 font-mono text-sm focus:outline-amber-400"
			></textarea>
			{#if schemaError}
				<p class="mt-2 text-red-600">{schemaError}</p>
			{/if}
			<p class="mt-2 text-xs text-gray-500">
				You can use any valid <a href="https://zod.dev/" class="underline" target="_blank">Zod</a> schema
				syntax.
			</p>
		</div>
		<div>
			<form use:form.enhance class="space-y-4" autocomplete="off">
				<button
					type="submit"
					class="mt-4 rounded bg-emerald-500 px-6 py-2 text-white shadow transition hover:bg-emerald-600"
					>Submit</button
				>
			</form>
		</div>
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
