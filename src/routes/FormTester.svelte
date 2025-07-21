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

	// Field objects for demonstration
	const nameField = form.getField('name');
	const emailField = form.getField('email');
	const passwordField = form.getField('password');
	const streetField = form.getField('address.street');
	const cityField = form.getField('address.city');
	const stateField = form.getField('address.state');
	const zipField = form.getField('address.zip');

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
	const handleSubmit = async (data: any) => {
		console.log('Form submitted with data:', data);
		alert('Form submitted successfully! Check console for data.');
	};

	const handleError = (errors: Record<string, string[]>) => {
		console.log('Form validation errors:', errors);
		alert('Form has validation errors. Check console for details.');
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

	$inspect(form.touched);
</script>

<form
	use:form.enhance={{ onSubmit: handleSubmit, onError: handleError }}
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

	<!-- Basic Information -->
	<div class="space-y-6">
		<h3 class="text-xl font-semibold text-gray-700">Basic Information</h3>
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div>
				<label class="mb-1 block font-semibold text-gray-700">Name</label>
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={nameField.value}
						placeholder="Enter your name"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (form.data.name = randomString(8))}>Random</button
					>
				</div>
				{#if nameField.touched && nameField.error}
					<div class="mt-1 text-sm text-red-600">{nameField.error}</div>
				{/if}
			</div>

			<div>
				<label class="mb-1 block font-semibold text-gray-700">Email</label>
				<div class="flex items-center gap-2">
					<input
						type="email"
						bind:value={emailField.value}
						placeholder="Enter your email"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (form.data.email = randomEmail())}>Random Email</button
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
				<label class="mb-1 block font-semibold text-gray-700">Password</label>
				<div class="flex items-center gap-2">
					<input
						type="password"
						bind:value={passwordField.value}
						placeholder="Enter your password"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (form.data.password = randomString(12))}>Random</button
					>
				</div>
				{#if passwordField.touched && passwordField.error}
					<div class="mt-1 text-sm text-red-600">{passwordField.error}</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Address Information -->
	<div class="space-y-6">
		<h3 class="text-xl font-semibold text-gray-700">Address Information</h3>
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div>
				<label class="mb-1 block text-gray-700">Street</label>
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={streetField.value}
						placeholder="Enter street address"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (streetField.value = randomString(10))}>Random</button
					>
				</div>
				{#if streetField.touched && streetField.error}
					<div class="mt-1 text-sm text-red-600">{streetField.error}</div>
				{/if}
			</div>

			<div>
				<label class="mb-1 block text-gray-700">City</label>
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={cityField.value}
						placeholder="Enter city"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (cityField.value = randomString(8))}>Random</button
					>
				</div>
				{#if cityField.touched && cityField.error}
					<div class="mt-1 text-sm text-red-600">{cityField.error}</div>
				{/if}
			</div>

			<div>
				<label class="mb-1 block text-gray-700">State</label>
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={stateField.value}
						placeholder="Enter state"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (stateField.value = randomString(6))}>Random</button
					>
				</div>
				{#if stateField.touched && stateField.error}
					<div class="mt-1 text-sm text-red-600">{stateField.error}</div>
				{/if}
			</div>

			<div>
				<label class="mb-1 block text-gray-700">ZIP</label>
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={zipField.value}
						placeholder="Enter ZIP code"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => (zipField.value = randomString(5))}>Random</button
					>
				</div>
				{#if zipField.touched && zipField.error}
					<div class="mt-1 text-sm text-red-600">{zipField.error}</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Parking Lots Array -->
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<h3 class="text-xl font-semibold text-emerald-700">Parking Lots</h3>
			<div class="flex gap-2">
				<button type="button" class="btn btn-sm btn-success" onclick={addParkingLot}>
					+ Add Parking Lot
				</button>
			</div>
		</div>

		{#each form.data.address.parkingLots as lot, i (i)}
			<div class="relative rounded-lg border border-gray-200 bg-gray-50 p-4">
				<div class="mb-3 flex items-center justify-between">
					<h4 class="font-semibold text-gray-700">Parking Lot {i + 1}</h4>
					<div class="flex gap-1">
						<button
							type="button"
							class="btn btn-xs btn-outline"
							onclick={() => moveParkingLotUp(i)}
							disabled={i === 0}>↑</button
						>
						<button
							type="button"
							class="btn btn-xs btn-outline"
							onclick={() => moveParkingLotDown(i)}
							disabled={i === form.data.address.parkingLots.length - 1}>↓</button
						>
						<button type="button" class="btn btn-xs btn-outline" onclick={() => insertParkingLot(i)}
							>+</button
						>
						<button type="button" class="btn btn-xs btn-error" onclick={() => removeParkingLot(i)}
							>-</button
						>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div>
						<label class="mb-1 block text-xs text-gray-600">Lot Name</label>
						<input
							type="text"
							bind:value={lot.name}
							placeholder="Enter lot name"
							class="input input-sm input-bordered w-full"
						/>
						{#if form.touched[`address.parkingLots.${i}.name`] && form.errors[`address.parkingLots.${i}.name`]}
							<div class="mt-1 text-xs text-red-600">
								{form.errors[`address.parkingLots.${i}.name`][0]}
							</div>
						{/if}
					</div>

					<div>
						<label class="mb-1 block text-xs text-gray-600">Latitude</label>
						<input
							type="number"
							bind:value={lot.lat}
							placeholder="Latitude"
							class="input input-sm input-bordered w-full"
						/>
						{#if form.touched[`address.parkingLots.${i}.lat`] && form.errors[`address.parkingLots.${i}.lat`]}
							<div class="mt-1 text-xs text-red-600">
								{form.errors[`address.parkingLots.${i}.lat`][0]}
							</div>
						{/if}
					</div>

					<div>
						<label class="mb-1 block text-xs text-gray-600">Longitude</label>
						<input
							type="number"
							bind:value={lot.lng}
							placeholder="Longitude"
							class="input input-sm input-bordered w-full"
						/>
						{#if form.touched[`address.parkingLots.${i}.lng`] && form.errors[`address.parkingLots.${i}.lng`]}
							<div class="mt-1 text-xs text-red-600">
								{form.errors[`address.parkingLots.${i}.lng`][0]}
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
	<div class="rounded-lg bg-gray-100 p-4">
		<h3 class="mb-2 text-lg font-semibold text-gray-700">Debug Information</h3>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<h4 class="font-semibold text-gray-600">Touched Fields:</h4>
				<pre class="mt-1 text-xs text-gray-700">{JSON.stringify(form.touched, null, 2)}</pre>
			</div>
			<div>
				<h4 class="font-semibold text-gray-600">Errors:</h4>
				<pre class="mt-1 text-xs text-gray-700">{JSON.stringify(form.errors, null, 2)}</pre>
			</div>
		</div>
	</div>
</form>
