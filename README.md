# RuneForm

A powerful, type-safe, deeply reactive form builder for Svelte 5 — built on runes and schema validation. Supports nested fields, arrays, async validation, and ergonomic field access for modern SvelteKit apps.

[![npm version](https://img.shields.io/npm/v/rune-form.svg)](https://npmjs.com/package/rune-form)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/source-github-blue?logo=github)](https://github.com/AntonPavlenkov/rune-form)

---

## ✨ Features

- ⚡️ **Svelte 5 runes** (`$state`, `$effect`, etc.) for deep reactivity
- ✅ **Type-safe** path access: `form.getField("user.email")`
- 📦 **Zod**-powered schema validation (sync & async)
- 🔁 **Nested objects & arrays** with full reactivity
- 🔍 **Custom & schema validation errors** (array format)
- 📤 **FormData** support for SvelteKit actions
- 💬 **HTML input constraint generation** (type, min, etc.)
- 🧠 **Async validation** tracking
- 🎯 **SSR/SSG ready** and works with `use:enhance`
- 🧪 **Fully tested**

---

## 📦 Installation

```bash
npm install rune-form zod
# or
pnpm add rune-form zod
```

---

## 🚀 Quick Start

### 1. Define your Zod schema

```ts
import { z } from 'zod';

const formSchema = z.object({
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
});
```

### 2. Create a RuneForm instance

```ts
import { RuneForm } from 'rune-form';
import { createZodValidator } from 'rune-form/zodAdapter';

const form = new RuneForm(createZodValidator(formSchema), {
	name: 'John Doe',
	email: 'test@test.com',
	password: 'password'
});
```

### 3. Use in your Svelte component

```svelte
<script lang="ts">
	// ...import and setup as above
</script>

<form use:form.enhance>
	<input type="text" bind:value={form.data.name} placeholder="Name" />
	<input type="email" bind:value={form.data.email} placeholder="Email" />
	<input type="password" bind:value={form.data.password} placeholder="Password" />

	<!-- Nested fields -->
	<input type="text" bind:value={form.data.address.street} placeholder="Street" />
	<input type="text" bind:value={form.data.address.city} placeholder="City" />

	<!-- Array fields -->
	{#each form.data.address.parkingLots as lot, i}
		<input type="text" bind:value={lot.name} placeholder="Parking Lot Name" />
		<input type="number" bind:value={lot.lat} placeholder="Lat" />
		<input type="number" bind:value={lot.lng} placeholder="Lng" />
		<button type="button" on:click={() => form.remove('address.parkingLots', i)}>&times;</button>
	{/each}
	<button
		type="button"
		on:click={() => form.push('address.parkingLots', { name: '', lat: 0, lng: 0 })}
	>
		Add Parking Lot
	</button>

	<button type="submit">Submit</button>
</form>
```

---

## 🧩 API Overview

### `RuneForm<T>`

- **`form.data`** — Reactive form data, deeply bound to your schema.
- **`form.errors`** — Reactive error object, keyed by field path.
- **`form.getField(path)`** — Get a field object for advanced control (value, error, constraints, etc).
- **`form.push(path, value)`** — Add an item to an array field.
- **`form.remove(path, index)`** — Remove an item from an array field.
- **`form.setCustomError(path, message)`** — Set a custom error for a field.
- **`form.validateSchema()`** — Manually trigger validation.
- **`form.enhance`** — Svelte action for progressive enhancement.

### Field Object

```ts
const field = form.getField('address.city');
field.value; // get/set value
field.error; // first error message
field.errors; // all error messages
field.touched; // touched state
field.constraints; // HTML input constraints (type, min, etc.)
```

---

## 🛠️ Advanced Usage

- **Deeply nested fields:** Use dot notation with `form.getField('address.city')`.
- **Custom validation:** Use Zod refinements or your own validator.
- **Async validation:** Supported via Zod's async methods.
- **SSR/SSG:** Works out of the box with SvelteKit.
- **Type safety:** All data and errors are fully typed from your schema.

---

## 🧪 Example: Full Svelte 5 Usage

```svelte
<script lang="ts">
	import { RuneForm } from 'rune-form';
	import { createZodValidator } from 'rune-form/zodAdapter';
	import { z } from 'zod';

	const formSchema = z.object({
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
	});

	const form = new RuneForm(createZodValidator(formSchema), {});
</script>

<form use:form.enhance>
	<input type="text" bind:value={form.data.name} placeholder="Name" />
	<input type="email" bind:value={form.data.email} placeholder="Email" />
	<input type="password" bind:value={form.data.password} placeholder="Password" />

	<input type="text" bind:value={form.data.address.street} placeholder="Street" />
	<input type="text" bind:value={form.data.address.city} placeholder="City" />

	{#each form.data.address.parkingLots as lot, i}
		<input type="text" bind:value={lot.name} placeholder="Parking Lot Name" />
		<input type="number" bind:value={lot.lat} placeholder="Lat" />
		<input type="number" bind:value={lot.lng} placeholder="Lng" />
		<button type="button" on:click={() => form.remove('address.parkingLots', i)}>&times;</button>
	{/each}
	<button
		type="button"
		on:click={() => form.push('address.parkingLots', { name: '', lat: 0, lng: 0 })}
	>
		Add Parking Lot
	</button>

	<button type="submit">Submit</button>
</form>
```

---

## 📚 More

- [API Reference](https://github.com/AntonPavlenkov/rune-form#api)
- [Live Playground & Docs](https://github.com/AntonPavlenkov/rune-form)
- [Zod Documentation](https://zod.dev/)

---

## 📝 License

MIT © [Anton Pavlenkov](https://github.com/AntonPavlenkov)
