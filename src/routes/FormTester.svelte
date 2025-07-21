<script lang="ts">
	import { RuneForm } from '$lib/RuneForm.svelte';
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

	const form = RuneForm.fromSchema(formSchema, {
		name: 'John Doe',
		email: 'test@test.com',
		password: 'password'
	});

	const nameField = form.getField('name');
	const emailField = form.getField('email');
	const passwordField = form.getField('password');
	const addressField = form.getField('address');
	const parkingLotsField = form.getField('address.parkingLots');
	const streetField = form.getField('address.street');
	const cityField = form.getField('address.city');
	const stateField = form.getField('address.state');
	const zipField = form.getField('address.zip');
	parkingLotsField.value = [
		{
			name: 'test',
			lat: 1,
			lng: 1
		},
		{
			name: 'test',
			lat: 1,
			lng: 2
		},
		{
			name: 'test',
			lat: 1,
			lng: 3
		}
	];
	form.getField('address.parkingLots.2').value = {
		name: 'test',
		lat: 1,
		lng: 1
	};

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
		return { name: randomString(8), lat: randomNumber(), lng: randomNumber() };
	}

	$inspect(form.touched);
</script>

<form
	use:form.enhance
	class="mx-auto max-w-2xl space-y-8 rounded-xl border border-emerald-100 bg-white/90 p-8 shadow-lg"
>
	<h2 class="mb-2 text-2xl font-bold tracking-tight text-emerald-700">User Registration</h2>
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<div>
			<label class="mb-1 block font-semibold text-gray-700">Name</label>
			<div class="flex items-center gap-2">
				<input
					type="text"
					bind:value={nameField.value}
					placeholder="Name"
					class="input input-bordered w-full"
				/>
				<button
					type="button"
					class="btn btn-xs btn-outline"
					on:click={() => (form.data.name = randomString(8))}>Random</button
				>
			</div>
			{#if nameField.error}
				<div class="mt-1 text-xs text-red-600">{nameField.error}</div>
			{/if}
		</div>
		<div>
			<label class="mb-1 block font-semibold text-gray-700">Email</label>
			<div class="flex items-center gap-2">
				<input
					type="email"
					bind:value={form.data.email}
					placeholder="Email"
					class="input input-bordered w-full"
				/>
				<button
					type="button"
					class="btn btn-xs btn-outline"
					on:click={() => (form.data.email = randomEmail())}>Random Email</button
				>
			</div>
			{#if emailField.error}
				<div class="mt-1 text-xs text-red-600">{emailField.error}</div>
			{/if}
		</div>
		<div>
			<label class="mb-1 block font-semibold text-gray-700">Password</label>
			<div class="flex items-center gap-2">
				<input
					type="password"
					bind:value={form.data.password}
					placeholder="Password"
					class="input input-bordered w-full"
				/>
				<button
					type="button"
					class="btn btn-xs btn-outline"
					on:click={() => (form.data.password = randomString(12))}>Random</button
				>
			</div>
			{#if passwordField.error}
				<div class="mt-1 text-xs text-red-600">{passwordField.error}</div>
			{/if}
		</div>
	</div>
	<fieldset class="rounded-lg border border-emerald-200 bg-emerald-50/40 p-6">
		<legend class="px-2 font-semibold text-emerald-700">Address</legend>
		<div class="mt-2 grid grid-cols-1 gap-6 md:grid-cols-2">
			<div>
				<label class="mb-1 block text-gray-700">Street</label>
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={streetField.value}
						placeholder="Street"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						on:click={() => (streetField.value = randomString(10))}>Random</button
					>
				</div>
				{#if streetField.error}
					<div class="mt-1 text-xs text-red-600">{streetField.error}</div>
				{/if}
			</div>
			<div>
				<label class="mb-1 block text-gray-700">City</label>
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={cityField.value}
						placeholder="City"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						on:click={() => (cityField.value = randomString(8))}>Random</button
					>
				</div>
				{#if cityField.error}
					<div class="mt-1 text-xs text-red-600">{cityField.error}</div>
				{/if}
			</div>
			<div>
				<label class="mb-1 block text-gray-700">State</label>
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={stateField.value}
						placeholder="State"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						on:click={() => (stateField.value = randomString(6))}>Random</button
					>
				</div>
				{#if stateField.error}
					<div class="mt-1 text-xs text-red-600">{stateField.error}</div>
				{/if}
			</div>
			<div>
				<label class="mb-1 block text-gray-700">Zip</label>
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={zipField.value}
						placeholder="Zip"
						class="input input-bordered w-full"
					/>
					<button
						type="button"
						class="btn btn-xs btn-outline"
						on:click={() => (zipField.value = randomString(5))}>Random</button
					>
				</div>
				{#if zipField.error}
					<div class="mt-1 text-xs text-red-600">{zipField.error}</div>
				{/if}
			</div>
		</div>
		<div class="mt-6">
			<label class="mb-2 block font-semibold text-emerald-700">Parking Lots</label>
			{#each form.data.address.parkingLots as lot, i (i)}
				<div
					class="relative mb-3 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-white/80 p-4 shadow-sm md:flex-row md:items-end"
				>
					<div class="flex-1">
						<label class="mb-1 block text-xs text-gray-600">Lot Name</label>
						<input
							type="text"
							bind:value={form.data.address.parkingLots[i].name}
							placeholder="Lot Name"
							class="input input-bordered w-full"
						/>
					</div>
					<div class="flex-1">
						<label class="mb-1 block text-xs text-gray-600">Lat</label>
						<input
							type="number"
							bind:value={form.data.address.parkingLots[i].lat}
							placeholder="Lat"
							class="input input-bordered w-full"
						/>
					</div>
					<div class="flex-1">
						<label class="mb-1 block text-xs text-gray-600">Lng</label>
						<input
							type="number"
							bind:value={form.data.address.parkingLots[i].lng}
							placeholder="Lng"
							class="input input-bordered w-full"
						/>
					</div>
					<button
						type="button"
						class="btn btn-xs btn-error absolute top-2 right-2"
						on:click={() => form.data.address.parkingLots.splice(i, 1)}>-</button
					>
				</div>
			{/each}
			<button
				type="button"
				class="btn btn-sm btn-success mt-2"
				on:click={() => form.data.address.parkingLots.push(getParkingLotTemplate())}
				>+ Add Parking Lot</button
			>
		</div>
	</fieldset>
	<div class="flex justify-end">
		<button type="submit" class="btn btn-lg btn-primary mt-4">Submit</button>
	</div>
</form>

<div
	class="mx-auto mt-8 max-w-2xl rounded-xl border border-emerald-100 bg-emerald-50/60 p-6 shadow"
>
	<h3 class="mb-2 text-lg font-semibold text-emerald-700">Live Form Data</h3>
	<pre class="text-xs text-gray-700">{JSON.stringify(form.data, null, 2)}</pre>
</div>

<div class="mx-auto mt-8 max-w-2xl rounded-xl border border-blue-100 bg-blue-50/60 p-6 shadow">
	<h3 class="mb-2 text-lg font-semibold text-blue-700">Touched Fields</h3>
	<pre class="text-xs text-gray-700">{JSON.stringify(form.touched, null, 2)}</pre>
</div>
