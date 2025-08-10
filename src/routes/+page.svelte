<script lang="ts">
	import FormTester from './FormTester.svelte';
</script>

<!-- Hero Section -->
<section class="bg-gradient-to-br from-amber-100 to-emerald-50 px-4 py-12 text-center">
	<h1 class="mb-2 text-4xl font-bold">RuneForm for SvelteKit</h1>
	<p class="mx-auto mb-4 max-w-3xl text-lg text-gray-700">
		A powerful, type-safe, and deeply reactive form library for Svelte 5. Built with the latest
		runes, featuring automatic memory management, advanced array operations, and seamless Zod
		integration. Minimal boilerplate, maximum power.
	</p>
	<div class="flex justify-center gap-4">
		<a
			href="https://github.com/AntonPavlenkov/rune-form"
			target="_blank"
			class="inline-block rounded bg-amber-400 px-6 py-2 text-white shadow transition hover:bg-amber-500"
			>GitHub</a
		>
		<a
			href="#playground"
			class="inline-block rounded bg-emerald-500 px-6 py-2 text-white shadow transition hover:bg-emerald-600"
			>Try Demo</a
		>
	</div>
</section>

<!-- Features Section -->
<section class="mx-auto max-w-6xl px-4 py-10">
	<h2 class="mb-8 text-center text-3xl font-bold">✨ Powerful Features</h2>
	<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<div class="mb-3 text-2xl">🚀</div>
			<h3 class="mb-2 text-lg font-semibold">Svelte 5 Runes</h3>
			<p class="text-gray-600">
				Built with the latest Svelte 5 runes for optimal performance and minimal re-renders.
			</p>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<div class="mb-3 text-2xl">🔒</div>
			<h3 class="mb-2 text-lg font-semibold">Type-Safe Validation</h3>
			<p class="text-gray-600">
				Full TypeScript support with Zod schemas and comprehensive validation.
			</p>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<div class="mb-3 text-2xl">🎯</div>
			<h3 class="mb-2 text-lg font-semibold">Automatic Tracking</h3>
			<p class="text-gray-600">
				Automatically tracks touched fields, validation state, and form changes.
			</p>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<div class="mb-3 text-2xl">📋</div>
			<h3 class="mb-2 text-lg font-semibold">Advanced Arrays</h3>
			<p class="text-gray-600">
				Rich array operations: push, splice, swap, insert with automatic state sync.
			</p>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<div class="mb-3 text-2xl">🧠</div>
			<h3 class="mb-2 text-lg font-semibold">Memory Management</h3>
			<p class="text-gray-600">
				Automatic resource disposal with Symbol.dispose and intelligent caching.
			</p>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<div class="mb-3 text-2xl">⚡</div>
			<h3 class="mb-2 text-lg font-semibold">Performance Optimized</h3>
			<p class="text-gray-600">
				Debounced validation, intelligent caching, and optimized reactivity.
			</p>
		</div>
	</div>
</section>

<!-- Documentation Section -->
<section class="mx-auto max-w-4xl px-4 py-10">
	<h2 class="mb-6 text-center text-3xl font-bold">🚀 Getting Started</h2>

	<div class="mb-8 rounded-lg bg-gray-50 p-6">
		<h3 class="mb-4 text-xl font-semibold">Installation</h3>
		<pre class="overflow-x-auto rounded bg-gray-100 p-4 text-sm"><code>npm install rune-form</code
			></pre>
	</div>

	<div class="mb-8 rounded-lg bg-gray-50 p-6">
		<h2 class="mb-4 text-xl font-semibold">Custom Validation Example</h2>
		<p class="mb-4 text-gray-600">
			This example shows how to use RuneForm with custom validation functions instead of Zod
			schemas.
		</p>

		<div class="mb-6 rounded-lg bg-gray-50 p-4">
			<pre class="text-sm text-gray-800"><code
					>{`import { RuneForm } from '$lib';

// Define custom validation functions
const customValidator = {
  name: (value: string) => {
    if (!value || value.length < 2) {
      return ['Name must be at least 2 characters long'];
    }
    return [];
  },
  email: (value: string) => {
    if (!value || !value.includes('@')) {
      return ['Email must be valid'];
    }
    return [];
  },
  age: (value: number) => {
    if (value < 18) {
      return ['Must be at least 18 years old'];
    }
    return [];
  }
};

// Create form with custom validator
const form = RuneForm.fromCustom(customValidator, {
  name: 'John',
  email: 'john@example.com',
  age: 25
});`}</code
				></pre>
		</div>

		<div class="rounded-lg border bg-white p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium">Custom Validation Form</h3>

			<div class="space-y-4">
				<div>
					<label for="custom-name" class="mb-1 block text-sm font-medium text-gray-700">
						Name
					</label>
					<input
						id="custom-name"
						type="text"
						placeholder="Enter your name"
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</div>

				<div>
					<label for="custom-email" class="mb-1 block text-sm font-medium text-gray-700">
						Email
					</label>
					<input
						id="custom-email"
						type="email"
						placeholder="Enter your email"
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</div>

				<div>
					<label for="custom-age" class="mb-1 block text-sm font-medium text-gray-700"> Age </label>
					<input
						id="custom-age"
						type="number"
						placeholder="Enter your age"
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</div>
			</div>

			<div class="mt-6">
				<button
					type="button"
					class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				>
					Validate Form
				</button>
			</div>
		</div>

		<h2 class="mt-8 mb-4 text-xl font-semibold">Zod Schema Example</h2>

		<div class="mb-8 rounded-lg bg-gray-50 p-6">
			<pre class="overflow-x-auto rounded bg-gray-100 p-4 text-sm"><code
					>{`import { RuneForm } from 'rune-form';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address')
});

const form = RuneForm.fromSchema(schema);

// Bind directly to form.data
<input type="text" bind:value={form.data.name} />
{#if form.touched.name && form.errors.name}
  <span class="error">{form.errors.name[0]}</span>
{/if}`}</code
				></pre>
		</div>

		<div class="mb-8 rounded-lg bg-gray-50 p-6">
			<h3 class="mb-4 text-xl font-semibold">Advanced Array Operations</h3>
			<pre class="overflow-x-auto rounded bg-gray-100 p-4 text-sm"><code
					>{`// Add items
form.push('items', newItem);

// Insert at position
form.splice('items', index, 0, newItem);

// Remove items
form.splice('items', index, 1);

// Swap items
form.swap('items', index1, index2);

// Direct mutations (also tracked)
form.data.items.push(newItem);
form.data.items.splice(index, 1);`}</code
				></pre>
		</div>

		<div class="mb-8 rounded-lg bg-gray-50 p-6">
			<h3 class="mb-4 text-xl font-semibold">Memory Management</h3>
			<pre class="overflow-x-auto rounded bg-gray-100 p-4 text-sm"><code
					>{`// Automatic disposal with Symbol.dispose
{
  const form = RuneForm.fromSchema(schema);
  // Use form...
  // form[Symbol.dispose]() is automatically called
}

// Manual disposal
const form = RuneForm.fromSchema(schema);
// Use form...
form.dispose(); // Clean up resources`}</code
				></pre>
		</div>
	</div>
</section>

<!-- Playground Section -->
<section id="playground" class="border-t border-b bg-white px-4 py-10">
	<h2 class="mb-4 text-center text-3xl font-bold">🎮 Live Playground</h2>
	<p class="mx-auto mb-8 max-w-2xl text-center text-gray-600">
		Try out RuneForm's powerful features in real-time. Test array operations, validation, and see
		how automatic touched tracking works.
	</p>
	<div class="mx-auto max-w-6xl">
		<FormTester />
	</div>
</section>

<!-- API Reference Section -->
<section class="mx-auto max-w-4xl px-4 py-10">
	<h2 class="mb-6 text-center text-3xl font-bold">📚 API Reference</h2>

	<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-4 text-xl font-semibold">Core Methods</h3>
			<ul class="space-y-2 text-sm">
				<li>
					<code class="rounded bg-gray-100 px-1">RuneForm.fromSchema(schema, initialData?)</code>
				</li>
				<li>
					<code class="rounded bg-gray-100 px-1">form.getField(path)</code> - Get field object
				</li>
				<li>
					<code class="rounded bg-gray-100 px-1">form.validateSchema()</code> - Manual validation
				</li>
				<li><code class="rounded bg-gray-100 px-1">form.reset()</code> - Reset form state</li>
				<li><code class="rounded bg-gray-100 px-1">form.dispose()</code> - Clean up resources</li>
			</ul>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-4 text-xl font-semibold">Array Operations</h3>
			<ul class="space-y-2 text-sm">
				<li><code class="rounded bg-gray-100 px-1">form.push(path, value)</code> - Add to end</li>
				<li>
					<code class="rounded bg-gray-100 px-1"
						>form.splice(path, start, deleteCount?, ...items)</code
					> - Insert/remove
				</li>
				<li><code class="rounded bg-gray-100 px-1">form.swap(path, i, j)</code> - Swap items</li>
				<li>
					<code class="rounded bg-gray-100 px-1">form.data.array.push()</code> - Direct mutation
				</li>
			</ul>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-4 text-xl font-semibold">State Management</h3>
			<ul class="space-y-2 text-sm">
				<li>
					<code class="rounded bg-gray-100 px-1">form.markTouched(path)</code> - Mark field touched
				</li>
				<li>
					<code class="rounded bg-gray-100 px-1">form.markAllTouched()</code> - Mark all touched
				</li>
				<li>
					<code class="rounded bg-gray-100 px-1">form.markAllAsPristine()</code> - Mark all pristine
				</li>
				<li>
					<code class="rounded bg-gray-100 px-1">form.setCustomError(path, message)</code> - Set custom
					error
				</li>
			</ul>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-4 text-xl font-semibold">Reactive Properties</h3>
			<ul class="space-y-2 text-sm">
				<li><code class="rounded bg-gray-100 px-1">form.data</code> - Form data (reactive)</li>
				<li><code class="rounded bg-gray-100 px-1">form.errors</code> - Validation errors</li>
				<li><code class="rounded bg-gray-100 px-1">form.touched</code> - Touched state</li>
				<li><code class="rounded bg-gray-100 px-1">form.isValid</code> - Form validity</li>
				<li><code class="rounded bg-gray-100 px-1">form.isValidating</code> - Validation state</li>
			</ul>
		</div>
	</div>
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
