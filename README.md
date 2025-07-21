# RuneForm

A reactive form library for Svelte 5 using runes and Zod validation.

## Features

- **Reactive Forms**: Built with Svelte 5 runes for optimal performance
- **Zod Integration**: Full TypeScript support with Zod schemas
- **Automatic Touched Tracking**: Automatically tracks which fields have been modified
- **Validation**: Real-time validation with error handling
- **Nested Objects**: Support for deeply nested form structures
- **Array Support**: Dynamic arrays with add/remove operations

## Installation

```bash
npm install rune-form
```

## Basic Usage

```svelte
<script lang="ts">
	import { RuneForm } from 'rune-form';
	import { z } from 'zod';

	const schema = z.object({
		name: z.string().min(2),
		email: z.string().email(),
		age: z.number().min(18)
	});

	const form = RuneForm.fromSchema(schema);

	// Handle form submission
	const handleSubmit = async (data) => {
		console.log('Form data:', data);
	};
</script>

<form use:form.enhance={{ onSubmit: handleSubmit }}>
	<input type="text" bind:value={form.data.name} />
	{#if form.touched.name && form.errors.name}
		<span class="error">{form.errors.name[0]}</span>
	{/if}

	<button type="submit">Submit</button>
</form>
```

## Automatic Touched Tracking

RuneForm automatically tracks which fields have been modified, regardless of how you interact with the form data.

### Direct Data Binding (Automatic)

When binding directly to `form.data`, touched tracking is automatic:

```svelte
<script>
	const form = RuneForm.fromSchema(schema);
</script>

<input type="text" bind:value={form.data.name} />
<!-- form.touched.name will be true after user modifies the field -->
```

### Deep Nested Object Tracking (Automatic)

RuneForm automatically tracks changes to deeply nested objects:

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
<!-- form.touched['address.street'] will be true -->

<input type="text" bind:value={form.data.address.country.name} />
<!-- form.touched['address.country.name'] will be true -->
```

### Using getField (Automatic)

When using `getField()`, touched tracking is also automatic:

```svelte
<script>
	const nameField = form.getField('name');
	const streetField = form.getField('address.street');
</script>

<input type="text" bind:value={nameField.value} />
<!-- nameField.touched will be true after user modifies the field -->

<input type="text" bind:value={streetField.value} />
<!-- streetField.touched will be true after user modifies the field -->
```

### Array Changes (Fully Automatic)

RuneForm automatically tracks changes to array elements:

```svelte
<script>
	const schema = z.object({
		items: z.array(
			z.object({
				name: z.string(),
				quantity: z.number()
			})
		)
	});

	const form = RuneForm.fromSchema(schema, {
		items: [{ name: 'Item 1', quantity: 1 }]
	});
</script>

{#each form.data.items as item, i (i)}
	<input type="text" bind:value={item.name} />
	<!-- form.touched[`items.${i}.name`] automatically becomes true -->
{/each}
```

### Checking Touched State

```svelte
{#if form.touched.name}
	<span>Name field has been modified</span>
{/if}

{#if form.touched['address.street']}
	<span>Street address has been modified</span>
{/if}

{#if form.touched['address.country.name']}
	<span>Country name has been modified</span>
{/if}

{#if form.touched['items.0.name']}
	<span>First item name has been modified</span>
{/if}
```

### Managing Touched State

```typescript
// Mark specific field as touched
form.markTouched('name');

// Mark field as pristine (untouched)
form.markFieldAsPristine('name');

// Mark all fields as touched
form.markAllTouched();

// Mark all fields as pristine
form.markAllAsPristine();

// Reset form (clears touched state)
form.reset();
```

## API Reference

### RuneForm Class

#### Constructor

```typescript
new RuneForm<T>(
  validator: Validator<T>,
  initialData?: Partial<T>,
  options?: {
    onSubmit?: (data: T) => void | Promise<void>;
    onError?: (errors: Record<string, string[]>) => void;
  }
)
```

#### Static Methods

```typescript
RuneForm.fromSchema<S extends ZodObject>(
  schema: S,
  initialData?: Partial<z.infer<S>>,
  options?: {
    onSubmit?: (data: z.infer<S>) => void | Promise<void>;
    onError?: (errors: Record<string, string[]>) => void;
  }
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
insert<K extends ArrayPaths<T>>(path: K, index: number, value: PathValue<T, `${K}.${number}`>): void
remove<K extends ArrayPaths<T>>(path: K, index: number): void
swap<K extends ArrayPaths<T>>(path: K, i: number, j: number): void
replace<K extends ArrayPaths<T>>(path: K, value: PathValue<T, K>): void

// Form enhancement
get enhance(): (node: HTMLFormElement) => { destroy(): void }
```

## Advanced Usage

### Nested Objects

```svelte
<script>
	const schema = z.object({
		address: z.object({
			street: z.string(),
			city: z.string(),
			zip: z.string()
		})
	});

	const form = RuneForm.fromSchema(schema);
</script>

<input type="text" bind:value={form.data.address.street} />
<!-- form.touched['address.street'] automatically becomes true -->
```

### Dynamic Arrays

```svelte
<script>
	const schema = z.object({
		items: z.array(
			z.object({
				name: z.string(),
				quantity: z.number()
			})
		)
	});

	const form = RuneForm.fromSchema(schema);
</script>

{#each form.data.items as item, i (i)}
	<div>
		<input type="text" bind:value={item.name} />
		<input type="number" bind:value={item.quantity} />
		<button on:click={() => form.remove('items', i)}>Remove</button>
	</div>
{/each}

<button on:click={() => form.push('items', { name: '', quantity: 1 })}> Add Item </button>
```

### Custom Validation

```svelte
<script>
	const handleSubmit = async (data) => {
		// Custom validation logic
		if (data.password !== data.confirmPassword) {
			form.setCustomError('confirmPassword', 'Passwords do not match');
			return;
		}

		// Submit form
		await submitToServer(data);
	};
</script>
```

## License

MIT
