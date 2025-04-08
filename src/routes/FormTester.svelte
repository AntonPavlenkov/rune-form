<script lang="ts">
	import { RuneForm } from '$lib/RuneForm.svelte.js';
	import { createZodValidator } from '$lib/zodAdapter.js';
	import { onMount } from 'svelte';
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

	const form = new RuneForm(createZodValidator(formSchema), {
		name: 'John Doe',
		email: 'test@test.com',
		password: 'password'
	});

	const parkingLots = $derived(form.data.address?.parkingLots);

	$inspect('parkingLots', parkingLots);

	const field = form.getField('address.parkingLots.0.name');
	const field2 = form.getField('password');
	// field.value = 'New Parking Lot1';
	onMount(() => {
		// form.data.address.parkingLots[0].name = 'New Parking Lot';

		setTimeout(() => {
			form.setCustomError('address.city', 'City is required');
		}, 2000);
	});
	// form.push('address.parkingLots', {
	// 	name: 'New Parking Lot',
	// 	lat: 0,
	// 	lng: 0
	// });
	$inspect('DATA', form.data);
	$inspect('ERRORS', form.errors);
	$inspect(field.value);
	$inspect('constraints', field.constraints);
</script>

<form use:form.enhance class="grid grid-cols-4 gap-3 bg-amber-50 p-4 shadow">
	<input type="text" bind:value={form.data.name} placeholder="Name" class="input" />

	<input type="text" bind:value={form.data.email} placeholder="email" class="input" />

	<input type="text" bind:value={form.data.password} placeholder="password" class="input" />
	<input type="text" bind:value={form.data.password} placeholder="password" class="input" />

	<input
		type="text"
		bind:value={field.value}
		{...field.constraints}
		placeholder="city"
		class="input"
	/>
	<input type="text" bind:value={field2.value} placeholder="city" class="input" />
	<button
		onclick={() => {
			if (!field.value) {
				field.value = 'New Parking Lot';
			} else {
				field2.value = 'New Parking Lot';
			}
		}}>Add</button
	>
</form>

<div class="bg-emerald-50-50 grid grid-cols-4 gap-3 p-4 shadow">
	<p>
		{form.data.name}
	</p>

	<p>
		{form.data.email}
	</p>

	<p>
		{form.data.password}
	</p>

	<p>
		{form.data.address?.parkingLots?.[0]?.name}
	</p>

	<p>
		{field.value}
	</p>

	<p>
		{field2.value}
	</p>
</div>
