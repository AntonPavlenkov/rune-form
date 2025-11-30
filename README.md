# RuneForm

<div align="center">

[![npm version](https://img.shields.io/npm/v/rune-form.svg)](https://www.npmjs.com/package/rune-form)
[![License](https://img.shields.io/npm/l/rune-form.svg)](https://github.com/AntonPavlenkov/rune-form/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5.0+-orange.svg)](https://svelte.dev/)
[![Zod Compatible](https://img.shields.io/badge/Zod-v3%20%7C%20v4-green.svg)](https://zod.dev/)
[![Valibot Compatible](https://img.shields.io/badge/Valibot-v1-green.svg)](https://valibot.dev/)

**The most powerful reactive form library for Svelte 5**

[Documentation](#-documentation) • [Quick Start](#-quick-start) • [Examples](#-examples) • [API Reference](#-api-reference)

</div>

---

## ✨ Why RuneForm?

RuneForm is a next-generation form library designed specifically for Svelte 5's rune system. It provides automatic reactivity, type safety, and powerful features with minimal boilerplate.

### 🎯 Key Benefits

- **Zero Configuration**: Works out of the box with sensible defaults
- **Automatic Everything**: Touched tracking, validation, error handling - all automatic
- **Type-Safe**: Full TypeScript support with perfect type inference
- **Memory Efficient**: Built-in memory management and resource disposal
- **Performance Optimized**: Intelligent caching, debounced validation, minimal re-renders
- **Developer Friendly**: Intuitive API that feels natural to use
- **Validation Agnostic**: Works with Zod, Valibot, or custom validators

## 🚀 Features

<table>
<tr>
<td width="50%">

### Core Features

- 🎯 **Svelte 5 Runes** - Built with latest runes for optimal reactivity
- 🔒 **Type-Safe Validation** - Zod, Valibot, or custom validators
- ⚡ **Auto Touched Tracking** - Automatic field modification detection
- 🔄 **Real-time Validation** - Debounced validation with error handling
- 🌳 **Deep Nesting** - Full support for complex nested structures
- 📋 **Array Operations** - Rich array manipulation with state sync

</td>
<td width="50%">

### Advanced Features

- 🧠 **Smart Memory Management** - Automatic disposal with `Symbol.dispose`
- 💾 **Intelligent Caching** - Path compilation and field caching
- 🔧 **Custom Validators** - Support for custom validation functions
- 🎨 **Flexible API** - Multiple ways to interact with form data
- ⚡ **Performance Optimized** - Minimal re-renders and efficient updates
- 🔍 **Developer Experience** - Excellent debugging and error messages

</td>
</tr>
</table>

## 📦 Installation

```bash
npm install rune-form
```

### Requirements

- **Svelte**: ^5.0.0
- **Zod**: ^3.0.0 or ^4.0.0 (optional, for Zod validation)
- **Valibot**: ^1.0.0 (optional, for Valibot validation)
- **TypeScript**: Recommended for best experience

## 🎓 Quick Start

### Basic Form with Zod Validation

```svelte
<script lang="ts">
	import { createForm } from 'rune-form/zodAdapter';
	import { z } from 'zod';

	// Define your schema
	const schema = z.object({
		username: z.string().min(3, 'Username must be at least 3 characters'),
		email: z.string().email('Invalid email address'),
		age: z.number().min(18, 'Must be at least 18 years old')
	});

	// Create form instance
	const form = createForm(schema);

	// Handle form submission
	async function handleSubmit() {
		if (!form.isValid) return;

		console.log('Submitting:', form.data);
		// Your submission logic here
	}
</script>

<form on:submit|preventDefault={handleSubmit}>
	<label>
		Username
		<input bind:value={form.data.username} />
		{#if form.touched.username && form.errors.username}
			<span class="error">{form.errors.username[0]}</span>
		{/if}
	</label>

	<label>
		Email
		<input type="email" bind:value={form.data.email} />
		{#if form.touched.email && form.errors.email}
			<span class="error">{form.errors.email[0]}</span>
		{/if}
	</label>

	<label>
		Age
		<input type="number" bind:value={form.data.age} />
		{#if form.touched.age && form.errors.age}
			<span class="error">{form.errors.age[0]}</span>
		{/if}
	</label>

	<button type="submit" disabled={!form.isValid || form.isValidating}>
		{form.isValidating ? 'Validating...' : 'Submit'}
	</button>
</form>
```

## 📖 Documentation

### Form Creation

RuneForm supports multiple validation libraries through dedicated adapters:

#### With Zod (Recommended)

```typescript
import { createForm } from 'rune-form/zodAdapter';
import { z } from 'zod';

const schema = z.object({
	name: z.string().min(2),
	email: z.string().email(),
	profile: z.object({
		bio: z.string(),
		avatar: z.string().url()
	})
});

// Create form
const form = createForm(schema);

// With initial data
const form = createForm(schema, {
	name: 'John Doe',
	email: 'john@example.com'
});
```

#### With Valibot

```typescript
import { createForm } from 'rune-form/valibotAdapter';
import * as v from 'valibot';

const schema = v.object({
	name: v.pipe(v.string(), v.minLength(2)),
	email: v.pipe(v.string(), v.email())
});

const form = createForm(schema);
```

#### With Custom Validators

```typescript
import { createForm } from 'rune-form';

const customValidators = {
	username: (value) => {
		if (!value || value.length < 3) {
			return ['Username must be at least 3 characters'];
		}
		if (!/^[a-zA-Z0-9_]+$/.test(value)) {
			return ['Username can only contain letters, numbers, and underscores'];
		}
		return [];
	},
	email: async (value) => {
		// Async validation example
		const exists = await checkEmailExists(value);
		return exists ? ['Email already taken'] : [];
	}
};

const form = createForm(customValidators, { username: '', email: '' });
```

#### Advanced: Using RuneForm Directly

For maximum control, you can create a `RuneForm` instance directly with any validator:

```typescript
import { RuneForm, createCustomValidator } from 'rune-form';
import { createZodValidator } from 'rune-form/zodAdapter';
import { createValibotValidator } from 'rune-form/valibotAdapter';

// With a custom validator
const form = new RuneForm(createCustomValidator(validators), initialData);

// With Zod validator
const form = new RuneForm(createZodValidator(zodSchema), initialData);

// With Valibot validator
const form = new RuneForm(createValibotValidator(valibotSchema), initialData);
```

### Automatic Touched State Tracking

RuneForm automatically tracks which fields have been modified. No manual `markTouched` calls needed!

```svelte
<script>
	import { createForm } from 'rune-form/zodAdapter';

	const form = createForm(schema);
</script>

<!-- Touched state is automatically set when user modifies the field -->
<input bind:value={form.data.name} />
{#if form.touched.name && form.errors.name}
	<span class="error">{form.errors.name[0]}</span>
{/if}

<!-- Works with nested objects -->
<input bind:value={form.data.address.street} />
{#if form.touched['address.street'] && form.errors['address.street']}
	<span class="error">{form.errors['address.street'][0]}</span>
{/if}

<!-- And arrays too -->
<input bind:value={form.data.items[0].name} />
{#if form.touched['items.0.name'] && form.errors['items.0.name']}
	<span class="error">{form.errors['items.0.name'][0]}</span>
{/if}
```

### Field Access Patterns

RuneForm provides multiple ways to access and work with form fields:

#### Direct Data Binding (Simplest)

```svelte
<input bind:value={form.data.name} />
```

#### Using getField (Advanced Features)

```svelte
<script>
	// Get field object with additional metadata
	const nameField = form.getField('name');
	const addressField = form.getField('address.street');
</script>

<input bind:value={nameField.value} />
{#if nameField.touched && nameField.error}
	<span>{nameField.error}</span>
{/if}

<!-- Field object provides: -->
<!-- - value: current value -->
<!-- - error: first error message -->
<!-- - errors: all error messages -->
<!-- - touched: boolean -->
<!-- - constraints: validation constraints -->
<!-- - isValidating: boolean -->
```

### Dynamic Arrays

RuneForm provides powerful array manipulation with automatic state synchronization:

```svelte
<script>
	import { createForm } from 'rune-form/zodAdapter';
	import { z } from 'zod';

	const schema = z.object({
		todos: z.array(
			z.object({
				text: z.string().min(1),
				completed: z.boolean()
			})
		)
	});

	const form = createForm(schema, {
		todos: [{ text: 'First task', completed: false }]
	});

	function addTodo() {
		form.push('todos', { text: '', completed: false });
	}

	function removeTodo(index: number) {
		form.splice('todos', index, 1);
	}

	function moveTodoUp(index: number) {
		if (index > 0) {
			form.swap('todos', index, index - 1);
		}
	}
</script>

{#each form.data.todos as todo, i (i)}
	<div class="todo-item">
		<input bind:value={todo.text} placeholder="Todo text" />
		<input type="checkbox" bind:checked={todo.completed} />

		<button on:click={() => moveTodoUp(i)} disabled={i === 0}> ↑ </button>
		<button on:click={() => removeTodo(i)}> Remove </button>
	</div>
{/each}

<button on:click={addTodo}>Add Todo</button>
```

### Array Operation Methods

```typescript
// Add items to the end
form.push('items', newItem);

// Remove items
form.splice('items', startIndex, deleteCount);

// Insert items
form.splice('items', index, 0, newItem1, newItem2);

// Replace items
form.splice('items', index, 1, replacementItem);

// Swap items
form.swap('items', index1, index2);

// Direct array mutations (also tracked!)
form.data.items.push(newItem);
form.data.items[0] = updatedItem;
form.data.items.splice(1, 1);
```

### Validation

#### Automatic Validation

Validation runs automatically with debouncing (100ms default):

```svelte
<script>
	const form = createForm(schema);
	// Validation happens automatically as user types
</script>

{#if form.isValidating}
	<p>Validating...</p>
{/if}

{#if form.isValid}
	<p>✓ Form is valid</p>
{/if}
```

#### Manual Validation

```typescript
// Validate entire form
await form.validateSchema();

// Custom error handling
form.setCustomError('email', 'This email is already taken');
form.setCustomErrors('password', ['Password is too weak', 'Must contain special characters']);
```

### Form State Management

```typescript
// Check form state
form.isValid; // boolean - true if all validations pass
form.isValidating; // boolean - true during async validation
form.errors; // Record<string, string[]> - validation errors
form.touched; // Record<string, boolean> - touched fields

// Reset form
form.reset(); // Clear all data, errors, and touched state

// Mark fields as touched/pristine
form.markTouched('email');
form.markFieldAsPristine('email');
form.markAllTouched();
form.markAllAsPristine();
```

### Memory Management

RuneForm automatically manages memory to prevent leaks:

```svelte
<script>
	import { onDestroy } from 'svelte';

	const form = createForm(schema);

	// Manual disposal (optional - happens automatically)
	onDestroy(() => {
		form.dispose();
	});
</script>
```

#### Symbol.dispose Support

```typescript
// Automatic disposal in using blocks (TC39 proposal)
{
	using form = createForm(schema);
	// Form is automatically disposed when leaving scope
}
```

## 🎯 Advanced Examples

### Complex Nested Form

```svelte
<script lang="ts">
	import { createForm } from 'rune-form/zodAdapter';
	import { z } from 'zod';

	const schema = z.object({
		company: z.object({
			name: z.string().min(2),
			address: z.object({
				street: z.string().min(5),
				city: z.string().min(2),
				country: z.string().length(2),
				coordinates: z.object({
					lat: z.number().min(-90).max(90),
					lng: z.number().min(-180).max(180)
				})
			}),
			employees: z
				.array(
					z.object({
						name: z.string().min(2),
						role: z.string().min(2),
						skills: z.array(z.string())
					})
				)
				.min(1)
		})
	});

	const form = createForm(schema);
</script>

<!-- Deep nesting with automatic tracking -->
<input bind:value={form.data.company.address.coordinates.lat} type="number" step="0.0001" />

<!-- Array within nested object -->
{#each form.data.company.employees as employee, i (i)}
	<div>
		<input bind:value={employee.name} />
		<input bind:value={employee.role} />

		<!-- Nested array -->
		{#each employee.skills as skill, j (j)}
			<input bind:value={employee.skills[j]} />
		{/each}
	</div>
{/each}
```

### Conditional Validation

```typescript
const schema = z
	.object({
		accountType: z.enum(['personal', 'business']),
		companyName: z.string().optional(),
		taxId: z.string().optional()
	})
	.refine(
		(data) => {
			if (data.accountType === 'business') {
				return data.companyName && data.taxId;
			}
			return true;
		},
		{
			message: 'Company name and tax ID required for business accounts',
			path: ['companyName']
		}
	);
```

### Async Validation

```typescript
const schema = z.object({
	username: z
		.string()
		.min(3)
		.refine(
			async (username) => {
				const response = await fetch(`/api/check-username/${username}`);
				return response.ok;
			},
			{ message: 'Username already taken' }
		)
});
```

## 📊 Performance Optimizations

RuneForm is designed for maximum performance:

- **Intelligent Caching**: Path compilation and field objects are cached
- **Debounced Validation**: Prevents excessive validation during typing
- **Minimal Re-renders**: Uses Svelte 5 runes for optimal reactivity
- **Memory Management**: Automatic cleanup and disposal
- **Lazy Evaluation**: Only computes what's needed

## 🔧 API Reference

### Imports

```typescript
// Main exports (custom validators)
import { RuneForm, createForm, createCustomValidator, type Validator } from 'rune-form';

// Zod adapter
import { createForm, createZodValidator } from 'rune-form/zodAdapter';

// Valibot adapter
import { createForm, createValibotValidator } from 'rune-form/valibotAdapter';
```

### createForm Functions

Each adapter exports a `createForm` function with the same signature pattern:

```typescript
// Zod
function createForm<S extends ZodTypeAny>(
	schema: S,
	initialData?: Partial<z.infer<S>>
): RuneForm<z.infer<S>>;

// Valibot
function createForm<S extends BaseSchema>(
	schema: S,
	initialData?: Partial<InferOutput<S>>
): RuneForm<InferOutput<S>>;

// Custom
function createForm<T extends Record<string, unknown>>(
	validator: CustomValidator<T>,
	initialData?: Partial<T>
): RuneForm<T>;
```

### RuneForm Class

```typescript
class RuneForm<T extends Record<string, unknown>> {
	// Properties
	data: T; // Reactive form data
	errors: Record<string, string[]>; // Validation errors
	touched: Record<string, boolean>; // Touched fields
	isValid: boolean; // Form validity
	isValidating: boolean; // Validation in progress

	// Constructor
	constructor(validator: Validator<T>, initialData?: Partial<T>);

	// Field access
	getField<K extends Paths<T>>(path: K): FieldObject;

	// Array operations
	push<K extends ArrayPaths<T>>(path: K, value: PathValue<T, `${K}.${number}`>): void;
	splice<K extends ArrayPaths<T>>(
		path: K,
		start: number,
		deleteCount?: number,
		...items: PathValue<T, `${K}.${number}`>[]
	): void;
	swap<K extends ArrayPaths<T>>(path: K, i: number, j: number): void;

	// State management
	markTouched(path: Paths<T>): void;
	markFieldAsPristine(path: Paths<T>): void;
	markAllTouched(): void;
	markAllAsPristine(): void;
	reset(): void;

	// Validation
	validateSchema(): Promise<void>;
	setCustomError(path: Paths<T>, message: string): void;
	setCustomErrors(path: Paths<T>, messages: string[]): void;

	// Cleanup
	dispose(): void;
	[Symbol.dispose](): void;
}
```

### FieldObject Interface

```typescript
interface FieldObject {
	value: any; // Current field value
	error: string | undefined; // First error message
	errors: string[]; // All error messages
	touched: boolean; // Field touched state
	constraints: Record<string, any>; // Validation constraints
	isValidating: boolean; // Field validation in progress
}
```

### Validator Interface

```typescript
interface Validator<T> {
	parse(data: unknown): T;
	safeParse(data: unknown): SafeParseResult<T>;
	safeParseAsync?(data: unknown): Promise<SafeParseResult<T>>;
	resolveDefaults?(data: Partial<T>): T;
	getPaths?(): string[];
	getInputAttributes?(path: string): Record<string, unknown>;
}
```

### CustomValidator Type

```typescript
type ValidationFunction<T> = (value: T, allData?: Record<string, unknown>) => string[] | Promise<string[]>;

type CustomValidator<T> = {
	[K in keyof T]?: ValidationFunction<T[K]>;
};
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/AntonPavlenkov/rune-form/blob/main/CONTRIBUTING.md) for details.

## 📄 License

MIT © [Anton Pavlenkov](https://github.com/AntonPavlenkov)

## 🙏 Acknowledgments

- Built for [Svelte 5](https://svelte.dev/)
- Validation powered by [Zod](https://zod.dev/) and [Valibot](https://valibot.dev/)
- Inspired by modern form libraries

## 📚 Resources

- [Documentation](https://github.com/AntonPavlenkov/rune-form#readme)
- [Examples](https://github.com/AntonPavlenkov/rune-form/tree/main/examples)
- [API Reference](#-api-reference)
- [GitHub](https://github.com/AntonPavlenkov/rune-form)
- [NPM Package](https://www.npmjs.com/package/rune-form)
- [Issue Tracker](https://github.com/AntonPavlenkov/rune-form/issues)

---

<div align="center">

**Made with ❤️ for the Svelte Community**

[⬆ Back to top](#runeform)

</div>
