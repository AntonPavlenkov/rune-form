<script lang="ts">
	import { RuneForm } from '$lib/RuneForm.svelte';
	import { z } from 'zod';

	const formSchema = z.object({
		name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long'),
		email: z.string().email('Invalid email address'),
		password: z
			.string()
			.min(8, 'Password must be at least 8 characters')
			.max(50, 'Password too long'),
		address: z.object({
			street: z.string().min(2, 'Street is required').max(50, 'Street too long'),
			city: z.string().min(2, 'City is required').max(50, 'City too long'),
			state: z.string().min(2, 'State is required').max(50, 'State too long'),
			zip: z.string().min(2, 'ZIP is required').max(50, 'ZIP too long'),
			parkingLots: z
				.array(
					z.object({
						name: z
							.string()
							.min(5, 'Lot name must be at least 5 characters')
							.max(50, 'Lot name too long'),
						lat: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
						lng: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude')
					})
				)
				.min(1, 'At least one parking lot is required')
		})
	});

	const form = RuneForm.fromSchema(formSchema, {
		name: 'John Doe',
		email: 'john.doe@example.com',
		password: 'securepassword123',
		address: {
			street: '123 Main St',
			city: 'Anytown',
			state: 'CA',
			zip: '12345',
			parkingLots: [
				{
					name: 'Downtown Parking',
					lat: 37.7749,
					lng: -122.4194
				},
				{
					name: 'Mall Parking Lot',
					lat: 37.7849,
					lng: -122.4094
				}
			]
		}
	});

	// Helper functions for random data
	function randomString(len = 8) {
		return Math.random()
			.toString(36)
			.substring(2, 2 + len);
	}

	function randomEmail() {
		return `${randomString(5)}@${randomString(3)}.com`;
	}

	function randomNumber(min = 0, max = 100) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	function getParkingLotTemplate() {
		return {
			name: `Parking Lot ${randomString(4)}`,
			lat: randomNumber(-90, 90),
			lng: randomNumber(-180, 180)
		};
	}

	// Form submission handler
	const handleSubmit = async (event: SubmitEvent) => {
		event.preventDefault();

		// Validate form before submission
		await form.validateSchema();

		if (!form.isValid) {
			// Mark all fields as touched to show validation errors
			form.markAllTouched();
			return;
		}

		console.log('Form submitted with data:', form.data);
		alert('Form submitted successfully! Check console for data.');
	};

	// Array operation handlers
	const addParkingLot = () => {
		form.push('address.parkingLots', getParkingLotTemplate());
	};

	const removeParkingLot = (index: number) => {
		form.splice('address.parkingLots', index, 1);
	};

	const moveParkingLotUp = (index: number) => {
		if (index > 0) {
			form.swap('address.parkingLots', index, index - 1);
		}
	};

	const moveParkingLotDown = (index: number) => {
		if (index < form.data.address.parkingLots.length - 1) {
			form.swap('address.parkingLots', index, index + 1);
		}
	};

	const insertParkingLot = (index: number) => {
		form.splice('address.parkingLots', index, 0, getParkingLotTemplate());
	};

	// Form state management
	const resetForm = () => {
		form.reset();
	};

	const markAllTouched = () => {
		form.markAllTouched();
	};

	const markAllPristine = () => {
		form.markAllAsPristine();
	};

	// Custom error demonstration
	const addCustomError = () => {
		form.setCustomError('email', 'This email is already taken');
	};

	const clearCustomErrors = () => {
		form.setCustomErrors('email', []);
	};

	// Create reactive field helpers for cleaner template
	const nameField = form.getField('name');
	const emailField = form.getField('email');
	const passwordField = form.getField('password');

	// Direct data access demonstration - the reactive proxy automatically tracks changes
	const streetValue = $derived(form.data.address.street);
	const cityValue = $derived(form.data.address.city);
	const stateValue = $derived(form.data.address.state);
	const zipValue = $derived(form.data.address.zip);

	// Reactive error and touched state for address fields
	const streetError = $derived(
		form.touched['address.street'] ? form.errors['address.street']?.[0] : undefined
	);
	const cityError = $derived(
		form.touched['address.city'] ? form.errors['address.city']?.[0] : undefined
	);
	const stateError = $derived(
		form.touched['address.state'] ? form.errors['address.state']?.[0] : undefined
	);
	const zipError = $derived(
		form.touched['address.zip'] ? form.errors['address.zip']?.[0] : undefined
	);

	// Debug inspection in development
	if (import.meta.env.DEV) {
		$inspect(form.touched);
		$inspect(form.errors);
	}
</script>

<form
	onsubmit={handleSubmit}
	class="mx-auto max-w-4xl space-y-8 rounded-xl border border-emerald-100 bg-white/90 p-8 shadow-lg"
>
	<div class="flex items-center justify-between">
		<h2 class="text-3xl font-bold tracking-tight text-emerald-700">RuneForm Demo</h2>
		<div class="flex gap-2">
			<button type="button" class="btn btn-sm btn-outline" onclick={resetForm}>Reset</button>
			<button type="button" class="btn btn-sm btn-outline" onclick={markAllTouched}
				>Mark All Touched</button
			>
			<button type="button" class="btn btn-sm btn-outline" onclick={markAllPristine}
				>Mark All Pristine</button
			>
		</div>
	</div>

	<!-- Form State Display -->
	<div class="rounded-lg bg-gray-50 p-4">
		<h3 class="mb-3 text-lg font-semibold text-gray-700">Form State</h3>
		<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
			<div class="text-center">
				<div class="text-2xl font-bold {form.isValid ? 'text-green-600' : 'text-red-600'}">
					{form.isValid ? '✓' : '✗'}
				</div>
				<div class="text-sm text-gray-600">Valid</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold {form.isValidating ? 'text-blue-600' : 'text-gray-600'}">
					{form.isValidating ? '⏳' : '✓'}
				</div>
				<div class="text-sm text-gray-600">Validating</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold text-blue-600">{Object.keys(form.touched).length}</div>
				<div class="text-sm text-gray-600">Touched Fields</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold text-red-600">{Object.keys(form.errors).length}</div>
				<div class="text-sm text-gray-600">Errors</div>
			</div>
		</div>
	</div>

	<!-- Basic Information - Using Field Objects -->
	<div class="space-y-6">
		<h3 class="text-xl font-semibold text-gray-700">Basic Information (Field Objects)</h3>
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div>
				<label for="name" class="mb-1 block font-semibold text-gray-700">Name</label>
				<div class="flex items-center gap-2">
					<input
						id="name"
						type="text"
						bind:value={nameField.value}
						placeholder="Enter your name"
						class="input input-bordered w-full"
						class:input-error={nameField.touched && nameField.error}
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (nameField.value = randomString(8))}>Random</button
					>
				</div>
				{#if nameField.touched && nameField.error}
					<div class="mt-1 text-sm text-red-600">{nameField.error}</div>
				{/if}
			</div>

			<div>
				<label for="email" class="mb-1 block font-semibold text-gray-700">Email</label>
				<div class="flex items-center gap-2">
					<input
						id="email"
						type="email"
						bind:value={emailField.value}
						placeholder="Enter your email"
						class="input input-bordered w-full"
						class:input-error={emailField.touched && emailField.error}
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (emailField.value = randomEmail())}>Random Email</button
					>
				</div>
				{#if emailField.touched && emailField.error}
					<div class="mt-1 text-sm text-red-600">{emailField.error}</div>
				{/if}
				<div class="mt-2 flex gap-2">
					<button type="button" class="btn btn-xs btn-error" onclick={addCustomError}
						>Add Custom Error</button
					>
					<button type="button" class="btn btn-xs btn-success" onclick={clearCustomErrors}
						>Clear Custom Errors</button
					>
				</div>
			</div>

			<div>
				<label for="password" class="mb-1 block font-semibold text-gray-700">Password</label>
				<div class="flex items-center gap-2">
					<input
						id="password"
						type="password"
						bind:value={passwordField.value}
						placeholder="Enter your password"
						class="input input-bordered w-full"
						class:input-error={passwordField.touched && passwordField.error}
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (passwordField.value = randomString(12))}>Random</button
					>
				</div>
				{#if passwordField.touched && passwordField.error}
					<div class="mt-1 text-sm text-red-600">{passwordField.error}</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Address Information - Using Direct Data Access -->
	<div class="space-y-6">
		<h3 class="text-xl font-semibold text-gray-700">Address Information (Direct Data Access)</h3>
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div>
				<label for="street" class="mb-1 block text-gray-700">Street</label>
				<div class="flex items-center gap-2">
					<input
						id="street"
						type="text"
						bind:value={form.data.address.street}
						placeholder="Enter street address"
						class="input input-bordered w-full"
						class:input-error={streetError}
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (form.data.address.street = randomString(10))}>Random</button
					>
				</div>
				{#if streetError}
					<div class="mt-1 text-sm text-red-600">{streetError}</div>
				{/if}
			</div>

			<div>
				<label for="city" class="mb-1 block text-gray-700">City</label>
				<div class="flex items-center gap-2">
					<input
						id="city"
						type="text"
						bind:value={form.data.address.city}
						placeholder="Enter city"
						class="input input-bordered w-full"
						class:input-error={cityError}
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (form.data.address.city = randomString(8))}>Random</button
					>
				</div>
				{#if cityError}
					<div class="mt-1 text-sm text-red-600">{cityError}</div>
				{/if}
			</div>

			<div>
				<label for="state" class="mb-1 block text-gray-700">State</label>
				<div class="flex items-center gap-2">
					<input
						id="state"
						type="text"
						bind:value={form.data.address.state}
						placeholder="Enter state"
						class="input input-bordered w-full"
						class:input-error={stateError}
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (form.data.address.state = randomString(2).toUpperCase())}>Random</button
					>
				</div>
				{#if stateError}
					<div class="mt-1 text-sm text-red-600">{stateError}</div>
				{/if}
			</div>

			<div>
				<label for="zip" class="mb-1 block text-gray-700">ZIP</label>
				<div class="flex items-center gap-2">
					<input
						id="zip"
						type="text"
						bind:value={form.data.address.zip}
						placeholder="Enter ZIP code"
						class="input input-bordered w-full"
						class:input-error={zipError}
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (form.data.address.zip = String(randomNumber(10000, 99999)))}
						>Random</button
					>
				</div>
				{#if zipError}
					<div class="mt-1 text-sm text-red-600">{zipError}</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Parking Lots Array - Direct Array Access -->
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<h3 class="text-xl font-semibold text-emerald-700">
				Parking Lots ({form.data.address.parkingLots.length})
			</h3>
			<div class="flex gap-2">
				<button type="button" class="btn btn-sm btn-success" onclick={addParkingLot}>
					+ Add Parking Lot
				</button>
			</div>
		</div>

		{#each form.data.address.parkingLots as lot, i (i)}
			{@const nameError = form.touched[`address.parkingLots.${i}.name`]
				? form.errors[`address.parkingLots.${i}.name`]?.[0]
				: undefined}
			{@const latError = form.touched[`address.parkingLots.${i}.lat`]
				? form.errors[`address.parkingLots.${i}.lat`]?.[0]
				: undefined}
			{@const lngError = form.touched[`address.parkingLots.${i}.lng`]
				? form.errors[`address.parkingLots.${i}.lng`]?.[0]
				: undefined}

			<div class="relative rounded-lg border border-gray-200 bg-gray-50 p-4">
				<div class="mb-3 flex items-center justify-between">
					<h4 class="font-semibold text-gray-700">Parking Lot {i + 1}</h4>
					<div class="flex gap-1">
						<button
							type="button"
							class="btn btn-xs btn-outline"
							onclick={() => moveParkingLotUp(i)}
							disabled={i === 0}
							title="Move up">↑</button
						>
						<button
							type="button"
							class="btn btn-xs btn-outline"
							onclick={() => moveParkingLotDown(i)}
							disabled={i === form.data.address.parkingLots.length - 1}
							title="Move down">↓</button
						>
						<button
							type="button"
							class="btn btn-xs btn-outline"
							onclick={() => insertParkingLot(i)}
							title="Insert before">+</button
						>
						<button
							type="button"
							class="btn btn-xs btn-error"
							onclick={() => removeParkingLot(i)}
							disabled={form.data.address.parkingLots.length === 1}
							title="Remove">×</button
						>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div>
						<label for="lot-name-{i}" class="mb-1 block text-xs text-gray-600">Lot Name</label>
						<input
							id="lot-name-{i}"
							type="text"
							bind:value={lot.name}
							placeholder="Enter lot name"
							class="input input-sm input-bordered w-full"
							class:input-error={nameError}
						/>
						{#if nameError}
							<div class="mt-1 text-xs text-red-600">
								{nameError}
							</div>
						{/if}
					</div>

					<div>
						<label for="lot-lat-{i}" class="mb-1 block text-xs text-gray-600">Latitude</label>
						<input
							id="lot-lat-{i}"
							type="number"
							bind:value={lot.lat}
							placeholder="Latitude"
							step="0.0001"
							class="input input-sm input-bordered w-full"
							class:input-error={latError}
						/>
						{#if latError}
							<div class="mt-1 text-xs text-red-600">
								{latError}
							</div>
						{/if}
					</div>

					<div>
						<label for="lot-lng-{i}" class="mb-1 block text-xs text-gray-600">Longitude</label>
						<input
							id="lot-lng-{i}"
							type="number"
							bind:value={lot.lng}
							placeholder="Longitude"
							step="0.0001"
							class="input input-sm input-bordered w-full"
							class:input-error={lngError}
						/>
						{#if lngError}
							<div class="mt-1 text-xs text-red-600">
								{lngError}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}

		{#if form.errors['address.parkingLots']}
			<div class="text-sm text-red-600">{form.errors['address.parkingLots'][0]}</div>
		{/if}
	</div>

	<!-- Submit Button -->
	<div class="flex justify-center">
		<button
			type="submit"
			class="btn btn-primary btn-lg"
			disabled={!form.isValid || form.isValidating}
		>
			{form.isValidating ? 'Validating...' : form.isValid ? 'Submit Form' : 'Fix Errors to Submit'}
		</button>
	</div>

	<!-- Debug Information -->
	<details class="rounded-lg bg-gray-100 p-4">
		<summary class="cursor-pointer text-lg font-semibold text-gray-700">Debug Information</summary>
		<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<h4 class="font-semibold text-gray-600">
					Touched Fields ({Object.keys(form.touched).length}):
				</h4>
				<pre class="mt-1 max-h-60 overflow-auto text-xs text-gray-700">{JSON.stringify(
						form.touched,
						null,
						2
					)}</pre>
			</div>
			<div>
				<h4 class="font-semibold text-gray-600">Errors ({Object.keys(form.errors).length}):</h4>
				<pre class="mt-1 max-h-60 overflow-auto text-xs text-gray-700">{JSON.stringify(
						form.errors,
						null,
						2
					)}</pre>
			</div>
			<div>
				<h4 class="font-semibold text-gray-600">
					Custom Errors ({Object.keys(form.customErrors).length}):
				</h4>
				<pre class="mt-1 max-h-60 overflow-auto text-xs text-gray-700">{JSON.stringify(
						form.customErrors,
						null,
						2
					)}</pre>
			</div>
			<div>
				<h4 class="font-semibold text-gray-600">Form Data:</h4>
				<pre class="mt-1 max-h-60 overflow-auto text-xs text-gray-700">{JSON.stringify(
						form.data,
						null,
						2
					)}</pre>
			</div>
		</div>
	</details>
</form>
