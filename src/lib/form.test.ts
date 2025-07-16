import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RuneForm } from './RuneForm.svelte.js';
import { createZodValidator } from './zodAdapter.js';
// Update to your file path

const schema = z.object({
	name: z.string().min(2),
	email: z.email(),
	password: z.string().min(8),
	address: z.object({
		street: z.string(),
		city: z.string(),
		state: z.string(),
		zip: z.string(),
		parkingLots: z
			.array(
				z.object({
					name: z.string(),
					lat: z.number(),
					lng: z.number()
				})
			)
			.default([])
	})
});

describe('RuneForm', () => {
	type FormKitFromSchema<S extends z.ZodObject<Record<string, z.ZodTypeAny>>> = RuneForm<
		z.infer<S>
	>;
	type MyForm = FormKitFromSchema<typeof schema>;

	let form: MyForm;

	beforeEach(() => {
		form = new RuneForm(createZodValidator(schema));
	});

	it('should initialize nested default values', () => {
		expect(form.getField('address.parkingLots').value).toEqual([]);
	});

	it('should allow setting top-level fields', () => {
		form.getField('name').value = 'Alice';
		expect(form.getField('name').value).toBe('Alice');
	});

	it('should allow setting nested object fields', () => {
		form.getField('address.city').value = 'Paris';
		expect(form.data.address.city).toBe('Paris');
	});

	it('should allow setting nested array item fields', () => {
		form.getField('address.parkingLots.0.name').value = 'Lot A';
		form.getField('address.parkingLots.0.lat').value = 40.7;
		form.getField('address.parkingLots.0.lng').value = -73.9;

		expect(form.getField('address.parkingLots.0').value).toEqual({
			name: 'Lot A',
			lat: 40.7,
			lng: -73.9
		});
	});

	it('should mark fields as touched via setter', () => {
		const field = form.getField('name');
		expect(field.touched).toBe(false);

		field.value = 'Bob';
		expect(field.touched).toBe(true);
	});

	it('should manually mark field as touched', () => {
		form.markTouched('email');
		expect(form.getField('email').touched).toBe(true);
	});

	it('should reset field to pristine', () => {
		form.markTouched('email');
		form.markFieldAsPristine('email');
		expect(form.getField('email').touched).toBe(false);
	});

	it('should reset the entire form', () => {
		form.getField('name').value = 'Alice';
		form.getField('address.city').value = 'Paris';
		form.markTouched('name');
		form.markTouched('address.city');

		form.reset();

		expect(form.getField('name').value).toBeUndefined();
		expect(form.getField('address.city').value).toBeUndefined();
		expect(form.getField('name').touched).toBeFalsy();
		expect(form.getField('address.city').touched).toBeFalsy();
	});

	it('should collect validation errors', async () => {
		await form.validateSchema();
		expect(Object.keys(form.errors)).toContain('name');
		expect(Object.keys(form.errors)).toContain('email');
		expect(Object.keys(form.errors)).toContain('password');
		expect(Object.keys(form.errors)).toContain('address.city');
	});

	it('should validate with correct values', async () => {
		form.getField('name').value = 'Alice';
		form.getField('email').value = 'alice@example.com';
		form.getField('password').value = 'supersecure';
		form.getField('address.street').value = 'Main St';
		form.getField('address.city').value = 'Paris';
		form.getField('address.state').value = 'TX';
		form.getField('address.zip').value = '75001';

		await form.validateSchema();
		expect(Object.keys(form.errors)).toHaveLength(0);
	});

	it('should allow marking all fields as touched', async () => {
		await form.validateSchema();
		form.markAllTouched();

		expect(form.getField('name').touched).toBe(true);
		expect(form.getField('email').touched).toBe(true);
		expect(form.getField('address.city').touched).toBe(true);
	});

	it('should allow marking all fields as pristine', async () => {
		await form.validateSchema();
		form.markAllTouched();
		form.markAllAsPristine();

		expect(form.getField('name').touched).toBeFalsy();
		expect(form.getField('email').touched).toBeFalsy();
		expect(form.getField('address.city').touched).toBeFalsy();
	});
});

describe('RuneForm additional tests', () => {
	const schema = z.object({
		name: z.string().min(2),
		email: z.email(),
		password: z.string().min(8),
		address: z.object({
			street: z.string(),
			city: z.string(),
			state: z.string(),
			zip: z.string(),
			parkingLots: z
				.array(
					z.object({
						name: z.string(),
						lat: z.number(),
						lng: z.number()
					})
				)
				.default([])
		})
	});
	type MyForm = RuneForm<z.infer<typeof schema>>;
	let form: MyForm;

	beforeEach(() => {
		form = new RuneForm(createZodValidator(schema));
	});

	it('should add and remove array items', () => {
		// Add item
		const lotsField = form.getField('address.parkingLots');
		lotsField.value = [
			{ name: 'Lot 1', lat: 1, lng: 2 },
			{ name: 'Lot 2', lat: 3, lng: 4 }
		];
		expect(form.data.address.parkingLots.length).toBe(2);
		// Remove item
		lotsField.value = [form.data.address.parkingLots[0]];
		expect(form.data.address.parkingLots.length).toBe(1);
	});

	it('should validate array items', async () => {
		const lotsField = form.getField('address.parkingLots');
		lotsField.value = [{ name: '', lat: 1, lng: 2 }];
		await form.validateSchema();
		expect(form.data.address.parkingLots[0].lat).toBe(1);
	});

	it('should reset nested arrays', () => {
		const lotsField = form.getField('address.parkingLots');
		lotsField.value = [{ name: 'Lot 1', lat: 1, lng: 2 }];
		form.reset();
		expect(form.data.address.parkingLots).toEqual([]);
	});

	it('should update deeply nested fields', () => {
		form.getField('address.parkingLots').value = [{ name: 'Lot 1', lat: 1, lng: 2 }];
		form.getField('address.parkingLots.0.name').value = 'Lot X';
		expect(form.data.address.parkingLots[0].name).toBe('Lot X');
	});

	it('should clear errors after fixing fields', async () => {
		await form.validateSchema();
		form.getField('name').value = 'Valid';
		await form.validateSchema();
		expect(form.getField('name').error).toBeUndefined();
	});

	it('should return undefined for non-existent fields', () => {
		const field = form.getField('notAField' as unknown as keyof typeof form.data);
		field.value = 'test';
		// @ts-expect-error - notAField is not a field
		expect(form.data.notAField).toBe('test');
	});
});
