import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	getArrayElement,
	getDefaultValue,
	getInnerType,
	getNumberChecks,
	getObjectShape,
	getUnionOptions,
	isOptionalish,
	isZodArray,
	isZodBoolean,
	isZodDefault,
	isZodNullable,
	isZodNumber,
	isZodObject,
	isZodOptional,
	isZodString,
	isZodUnion,
	unwrapSchema
} from './zodCompat.js';

describe('Zod Compatibility Functions', () => {
	describe('Type Checkers', () => {
		it('should correctly identify Zod types', () => {
			const objectSchema = z.object({ name: z.string() });
			const arraySchema = z.array(z.string());
			const numberSchema = z.number();
			const stringSchema = z.string();
			const booleanSchema = z.boolean();
			const unionSchema = z.union([z.string(), z.number()]);
			const optionalSchema = z.string().optional();
			const nullableSchema = z.string().nullable();
			const defaultSchema = z.string().default('test');

			expect(isZodObject(objectSchema)).toBe(true);
			expect(isZodArray(arraySchema)).toBe(true);
			expect(isZodNumber(numberSchema)).toBe(true);
			expect(isZodString(stringSchema)).toBe(true);
			expect(isZodBoolean(booleanSchema)).toBe(true);
			expect(isZodUnion(unionSchema)).toBe(true);
			expect(isZodOptional(optionalSchema)).toBe(true);
			expect(isZodNullable(nullableSchema)).toBe(true);
			expect(isZodDefault(defaultSchema)).toBe(true);

			// Negative tests
			expect(isZodObject(stringSchema)).toBe(false);
			expect(isZodArray(objectSchema)).toBe(false);
		});
	});

	describe('Object Shape', () => {
		it('should get shape from object schema', () => {
			const schema = z.object({
				name: z.string(),
				age: z.number(),
				email: z.string().email()
			});

			const shape = getObjectShape(schema);
			expect(shape).toBeDefined();
			expect(Object.keys(shape)).toEqual(['name', 'age', 'email']);
			expect(isZodString(shape.name)).toBe(true);
			expect(isZodNumber(shape.age)).toBe(true);
		});

		it('should return empty object for non-object schemas', () => {
			const stringSchema = z.string();
			const shape = getObjectShape(stringSchema);
			expect(shape).toEqual({});
		});
	});

	describe('Array Element', () => {
		it('should get element type from array schema', () => {
			const stringArraySchema = z.array(z.string());
			const element = getArrayElement(stringArraySchema);
			expect(isZodString(element)).toBe(true);

			const objectArraySchema = z.array(z.object({ id: z.number() }));
			const objElement = getArrayElement(objectArraySchema);
			expect(isZodObject(objElement)).toBe(true);
		});
	});

	describe('Inner Type', () => {
		it('should get inner type from optional schema', () => {
			const optionalString = z.string().optional();
			const inner = getInnerType(optionalString);
			expect(isZodString(inner)).toBe(true);
		});

		it('should get inner type from nullable schema', () => {
			const nullableNumber = z.number().nullable();
			const inner = getInnerType(nullableNumber);
			expect(isZodNumber(inner)).toBe(true);
		});

		it('should get inner type from default schema', () => {
			const defaultString = z.string().default('test');
			const inner = getInnerType(defaultString);
			expect(isZodString(inner)).toBe(true);
		});
	});

	describe('Default Value', () => {
		it('should get static default value', () => {
			const schema = z.string().default('hello');
			const defaultValue = getDefaultValue(schema);
			expect(defaultValue).toBe('hello');
		});

		it('should get function default value', () => {
			const schema = z.number().default(() => 42);
			const defaultValue = getDefaultValue(schema);
			expect(defaultValue).toBe(42);
		});

		it('should return undefined for schemas without defaults', () => {
			const schema = z.string();
			const defaultValue = getDefaultValue(schema);
			expect(defaultValue).toBeUndefined();
		});
	});

	describe('Optional Check', () => {
		it('should identify optional schemas', () => {
			const optional = z.string().optional();
			const nullable = z.string().nullable();
			const withDefault = z.string().default('test');
			const required = z.string();

			expect(isOptionalish(optional)).toBe(true);
			expect(isOptionalish(nullable)).toBe(true);
			expect(isOptionalish(withDefault)).toBe(true);
			expect(isOptionalish(required)).toBe(false);
		});
	});

	describe('Unwrap Schema', () => {
		it('should unwrap nested optional/nullable/default schemas', () => {
			const schema = z.string().optional().nullable().default('test');
			const unwrapped = unwrapSchema(schema);
			expect(isZodString(unwrapped)).toBe(true);
		});

		it('should return the same schema if not wrapped', () => {
			const schema = z.string();
			const unwrapped = unwrapSchema(schema);
			expect(unwrapped).toBe(schema);
		});
	});

	describe('Number Checks', () => {
		it('should get checks from number schema', () => {
			const schema = z.number().min(0).max(100).int();
			const checks = getNumberChecks(schema);
			expect(checks).toBeDefined();
			expect(checks.length).toBeGreaterThan(0);

			// In v4, checks are represented differently
			// Just verify that we got checks for this schema
			// The actual format varies between v3 and v4
			const hasChecks = checks.length >= 3; // min, max, and int
			expect(hasChecks).toBe(true);
		});

		it('should return empty array for non-number schemas', () => {
			const schema = z.string();
			const checks = getNumberChecks(schema);
			expect(checks).toEqual([]);
		});
	});

	describe('Union Options', () => {
		it('should get options from union schema', () => {
			const schema = z.union([z.string(), z.number(), z.boolean()]);
			const options = getUnionOptions(schema);
			expect(options).toHaveLength(3);
			expect(isZodString(options[0])).toBe(true);
			expect(isZodNumber(options[1])).toBe(true);
			expect(isZodBoolean(options[2])).toBe(true);
		});

		it('should return empty array for non-union schemas', () => {
			const schema = z.string();
			const options = getUnionOptions(schema);
			expect(options).toEqual([]);
		});
	});
});
