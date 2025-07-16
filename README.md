# RuneForm: Svelte 5 + Zod Form Library

A professional, ergonomic, and type-safe Svelte 5 form library with Zod schema validation, supporting deeply nested objects and arrays. Built for modern SvelteKit and TypeScript workflows.

---

## Features

- **Type-safe**: Full TypeScript autocomplete for all nested field paths
- **Schema-driven**: Zod schema is always the source of truth
- **Deeply nested support**: Works with objects, arrays, and complex structures
- **SSR/SSG ready**: Designed for SvelteKit
- **Minimal boilerplate**: No need to manually type or infer types

---

## Quick Start

### 1. Install

```bash
npm install zod
```

### 2. Define Your Zod Schema

```ts
import { z } from 'zod';

export const formSchema = z.object({
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

### 3. Create a Form Instance (Recommended)

```ts
import { RuneForm } from '$lib/RuneForm.svelte';
import { formSchema } from './your-schema-file';

const form = RuneForm.fromSchema(formSchema, {
	name: 'John Doe',
	email: 'test@test.com',
	password: 'password'
});
```

- **No need to use `createZodValidator` or manually specify types.**
- The schema is always the source of truth for all type inference and autocomplete.

### 4. Use in Svelte Components

```svelte
<script lang="ts">
	import { RuneForm } from '$lib/RuneForm.svelte';
	import { formSchema } from './your-schema-file';

	const form = RuneForm.fromSchema(formSchema);
	const nameField = form.getField('name');
	const streetField = form.getField('address.street');
	// ...
</script>

<input bind:value={nameField.value} />
{#if nameField.error}
	<span class="error">{nameField.error}</span>
{/if}
```

---

## API

### `RuneForm.fromSchema(schema, initialData?, options?)`

- **schema**: Your Zod object schema
- **initialData**: (optional) Partial initial values
- **options**: (optional) { onSubmit, onError }
- **Returns:** A `RuneForm` instance with full type safety and autocomplete for all nested fields.

### `form.getField(path)`

- **path**: Dot-notation string path (e.g., `'address.street'`, `'address.parkingLots.0.name'`)
- **Returns:** Field object `{ value, error, errors, touched, constraints }`
- **Autocomplete:** All valid paths from the schema are autocompleted in your editor.

---

## Migration Notes

- **Old usage:**
  ```ts
  // ❌ No longer recommended
  const form = new RuneForm(createZodValidator(schema), { ... });
  ```
- **New usage:**
  ```ts
  // ✅ Recommended
  const form = RuneForm.fromSchema(schema, { ... });
  ```

---

## Best Practices

- Always use `RuneForm.fromSchema` for form creation.
- The Zod schema is the single source of truth for all type inference and validation.
- You get full TypeScript autocomplete for all nested fields—no manual typing needed.

---

## License

MIT
