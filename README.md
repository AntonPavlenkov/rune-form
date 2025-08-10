# RuneForm

A powerful, reactive form library for Svelte 5 using runes and Zod validation with automatic memory management.

## ✨ Features

- **🚀 Svelte 5 Runes**: Built with the latest Svelte 5 runes for optimal performance
- **🔒 Zod Integration**: Full TypeScript support with Zod schemas and validation
- **🎯 Automatic Touched Tracking**: Automatically tracks which fields have been modified
- **⚡ Real-time Validation**: Debounced validation with error handling
- **🌳 Nested Objects**: Deep support for complex nested form structures
- **📋 Dynamic Arrays**: Advanced array operations with automatic state synchronization
- **🧠 Memory Management**: Automatic resource disposal with `Symbol.dispose`

- **🔧 Array Manipulation**: Rich set of array operations (push, splice, swap, etc.)
- **💾 Caching**: Intelligent caching with memory leak prevention

## 📦 Installation

```bash
npm install rune-form
```

## 🚀 Quick Start

```svelte
<script lang="ts">
	import { RuneForm } from 'rune-form';
	import { z } from 'zod';

	const schema = z.object({
		name: z.string().min(2, 'Name must be at least 2 characters'),
		email: z.string().email('Invalid email address'),
		age: z.number().min(18, 'Must be at least 18 years old')
	});

	const form = RuneForm.fromSchema(schema);

	const handleSubmit = async (data) => {
		console.log('Form data:', data);
		// Submit to server...
	};
</script>

<form on:submit|preventDefault={handleSubmit}>
	<div>
		<input type="text" bind:value={form.data.name} placeholder="Name" />
		{#if form.touched.name && form.errors.name}
			<span class="error">{form.errors.name[0]}</span>
		{/if}
	</div>

	<div>
		<input type="email" bind:value={form.data.email} placeholder="Email" />
		{#if form.touched.email && form.errors.email}
			<span class="error">{form.errors.email[0]}</span>
		{/if}
	</div>

	<button type="submit" disabled={!form.isValid || form.isValidating}>
		{form.isValidating ? 'Validating...' : 'Submit'}
	</button>
</form>
```

## 🎯 Automatic Touched Tracking

RuneForm automatically tracks which fields have been modified, regardless of how you interact with the form data.

### Direct Data Binding (Automatic)

```svelte
<script>
	const form = RuneForm.fromSchema(schema);
</script>

<input type="text" bind:value={form.data.name} />
<!-- form.touched.name automatically becomes true after user modifies the field -->
```

### Deep Nested Object Tracking

```svelte
<script>
	const schema = z.object({
		address: z.object({
			street: z.string(),
			city: z.string(),
			country: z.object({
				name: z.string(),
				code: z.string()
			})
		})
	});

	const form = RuneForm.fromSchema(schema);
</script>

<input type="text" bind:value={form.data.address.street} />
<!-- form.touched['address.street'] automatically becomes true -->

<input type="text" bind:value={form.data.address.country.name} />
<!-- form.touched['address.country.name'] automatically becomes true -->
```

### Using getField (Automatic)

```svelte
<script>
	const nameField = form.getField('name');
	const streetField = form.getField('address.street');
</script>

<input type="text" bind:value={nameField.value} />
<!-- nameField.touched automatically becomes true -->

<input type="text" bind:value={streetField.value} />
<!-- streetField.touched automatically becomes true -->
```

## 📋 Advanced Array Operations

RuneForm provides powerful array manipulation capabilities with automatic state synchronization.

### Dynamic Arrays with Rich Operations

```svelte
<script>
	const schema = z.object({
		items: z.array(
			z.object({
				name: z.string(),
				quantity: z.number(),
				tags: z.array(z.string())
			})
		)
	});

	const form = RuneForm.fromSchema(schema, {
		items: [{ name: 'Item 1', quantity: 1, tags: ['tag1'] }]
	});
</script>

{#each form.data.items as item, i (i)}
	<div class="item">
		<input type="text" bind:value={item.name} />
		<input type="number" bind:value={item.quantity} />

		<!-- Array operations -->
		<button onclick={() => form.splice('items', i, 1)}>Remove</button>
		<button onclick={() => form.swap('items', i, i - 1)} disabled={i === 0}>Move Up</button>
		<button onclick={() => form.swap('items', i, i + 1)} disabled={i === form.data.items.length - 1}
			>Move Down</button
		>
	</div>
{/each}

<!-- Add new items -->
<button onclick={() => form.push('items', { name: '', quantity: 1, tags: [] })}> Add Item </button>

<!-- Insert at specific position -->
<button onclick={() => form.splice('items', 1, 0, { name: 'New Item', quantity: 1, tags: [] })}>
	Insert at Position 1
</button>
```

### Array Operations API

```typescript
// Add items to the end
form.push('items', newItem);

// Insert at specific position
form.splice('items', index, 0, newItem);

// Remove items
form.splice('items', index, 1);

// Replace items
form.splice('items', index, 1, newItem);

// Swap items
form.swap('items', index1, index2);

// Direct array mutations (also tracked automatically)
form.data.items.push(newItem);
form.data.items.splice(index, 1);
form.data.items[0] = updatedItem;
```

## 🧠 Memory Management

RuneForm includes automatic memory management to prevent memory leaks.

### Automatic Resource Disposal

```svelte
<script>
	import { onDestroy } from 'svelte';

	const form = RuneForm.fromSchema(schema);

	// Automatic disposal when component is destroyed
	onDestroy(() => {
		form.dispose(); // Optional: explicit cleanup
	});
</script>
```

### Symbol.dispose Support

RuneForm implements `Symbol.dispose` for automatic resource management:

```typescript
// Automatic disposal when form goes out of scope
{
	const form = RuneForm.fromSchema(schema);
	// Use form...
	// form[Symbol.dispose]() is automatically called when leaving scope
}
```

## 🔧 Advanced Features

### Custom Error Handling

```svelte
<script>
	const handleSubmit = async (data) => {
		// Custom validation
		if (data.password !== data.confirmPassword) {
			form.setCustomError('confirmPassword', 'Passwords do not match');
			return;
		}

		// Multiple custom errors
		form.setCustomErrors('email', ['Email already exists', 'Please use a different email']);

		// Submit form
		await submitToServer(data);
	};
</script>
```

### Form State Management

```typescript
// Check form state
console.log(form.isValid); // boolean
console.log(form.isValidating); // boolean
console.log(form.errors); // Record<string, string[]>
console.log(form.touched); // Record<string, boolean>

// Manage touched state
form.markTouched('name');
form.markFieldAsPristine('name');
form.markAllTouched();
form.markAllAsPristine();

// Reset form
form.reset(); // Clears all data, errors, and touched state
```

### Field Access with getField

```svelte
<script>
	const nameField = form.getField('name');
	const addressField = form.getField('address');
	const nestedField = form.getField('address.street');
	const arrayField = form.getField('items.0.name');
</script>

<!-- Field object provides rich information -->
<div>
	<input type="text" bind:value={nameField.value} />
	{#if nameField.touched && nameField.error}
		<span class="error">{nameField.error}</span>
	{/if}
	<span>Validating: {nameField.isValidating}</span>
</div>
```

## 📚 API Reference

### RuneForm Class

#### Constructor

```typescript
new RuneForm<T>(
  validator: Validator<T>,
  initialData?: Partial<T>
)
```

#### Static Methods

```typescript
RuneForm.fromSchema<S extends ZodObject>(
  schema: S,
  initialData?: Partial<z.infer<S>>
): RuneForm<z.infer<S>>
```

#### Instance Methods

```typescript
// Field access
getField<K extends Paths<T>>(path: K): FieldObject

// Touched state management
markTouched(path: Paths<T>): void
markFieldAsPristine(path: Paths<T>): void
markAllTouched(): void
markAllAsPristine(): void

// Form state
reset(): void
validateSchema(): Promise<void>

// Array operations
push<K extends ArrayPaths<T>>(path: K, value: PathValue<T, `${K}.${number}`>): void
splice<K extends ArrayPaths<T>>(path: K, start: number, deleteCount?: number, ...items: PathValue<T, `${K}.${number}`>[]): void
swap<K extends ArrayPaths<T>>(path: K, i: number, j: number): void

// Custom errors
setCustomError(path: Paths<T>, message: string): void
setCustomErrors(path: Paths<T>, messages: string[]): void

// Resource management
dispose(): void
[Symbol.dispose](): void


```

#### Properties

```typescript
// Reactive state
data: T;
errors: Record<string, string[]>;
customErrors: Partial<Record<string, string[]>>;
touched: Record<string, boolean>;
isValid: boolean;
isValidating: boolean;
```

### FieldObject Interface

```typescript
interface FieldObject {
	value: PathValue<T, K>;
	error: string | undefined;
	errors: string[];
	touched: boolean;
	constraints: Record<string, unknown>;
	isValidating: boolean;
}
```

## 🎨 Complete Example

```svelte
<script lang="ts">
	import { RuneForm } from 'rune-form';
	import { z } from 'zod';

	const schema = z.object({
		name: z.string().min(2, 'Name must be at least 2 characters'),
		email: z.string().email('Invalid email address'),
		address: z.object({
			street: z.string().min(2, 'Street is required'),
			city: z.string().min(2, 'City is required'),
			zip: z.string().regex(/^\d{5}$/, 'Invalid ZIP code')
		}),
		items: z
			.array(
				z.object({
					name: z.string().min(1, 'Item name is required'),
					quantity: z.number().min(1, 'Quantity must be at least 1')
				})
			)
			.min(1, 'At least one item is required')
	});

	const form = RuneForm.fromSchema(schema, {
		name: '',
		email: '',
		address: {
			street: '',
			city: '',
			zip: ''
		},
		items: []
	});

	const handleSubmit = async (data) => {
		console.log('Submitting:', data);
		// Submit to server...
	};
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-6">
	<!-- Basic fields -->
	<div>
		<label for="name">Name</label>
		<input id="name" type="text" bind:value={form.data.name} />
		{#if form.touched.name && form.errors.name}
			<span class="error">{form.errors.name[0]}</span>
		{/if}
	</div>

	<div>
		<label for="email">Email</label>
		<input id="email" type="email" bind:value={form.data.email} />
		{#if form.touched.email && form.errors.email}
			<span class="error">{form.errors.email[0]}</span>
		{/if}
	</div>

	<!-- Nested object -->
	<fieldset>
		<legend>Address</legend>
		<div>
			<label for="street">Street</label>
			<input id="street" type="text" bind:value={form.data.address.street} />
			{#if form.touched['address.street'] && form.errors['address.street']}
				<span class="error">{form.errors['address.street'][0]}</span>
			{/if}
		</div>
		<!-- More address fields... -->
	</fieldset>

	<!-- Dynamic array -->
	<fieldset>
		<legend>Items</legend>
		{#each form.data.items as item, i (i)}
			<div class="item">
				<input type="text" bind:value={item.name} placeholder="Item name" />
				<input type="number" bind:value={item.quantity} min="1" />
				<button type="button" onclick={() => form.splice('items', i, 1)}>Remove</button>
				<button type="button" onclick={() => form.swap('items', i, i - 1)} disabled={i === 0}
					>↑</button
				>
				<button
					type="button"
					onclick={() => form.swap('items', i, i + 1)}
					disabled={i === form.data.items.length - 1}>↓</button
				>
			</div>
		{/each}
		<button type="button" onclick={() => form.push('items', { name: '', quantity: 1 })}>
			Add Item
		</button>
	</fieldset>

	<button type="submit" disabled={!form.isValid || form.isValidating}>
		{form.isValidating ? 'Validating...' : 'Submit'}
	</button>

	<!-- Form state display -->
	<div class="form-state">
		<p>Valid: {form.isValid}</p>
		<p>Validating: {form.isValidating}</p>
		<p>Touched fields: {Object.keys(form.touched).length}</p>
		<p>Error count: {Object.keys(form.errors).length}</p>
	</div>
</form>
```

## 🔧 Performance Features

- **Intelligent Caching**: Path compilation and field object caching with automatic cleanup
- **Debounced Validation**: Prevents excessive validation calls during rapid typing
- **Memory Management**: Automatic resource disposal and memory leak prevention
- **Optimized Reactivity**: Efficient Svelte 5 rune usage for minimal re-renders

## 📄 License

MIT
