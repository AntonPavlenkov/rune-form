/* eslint-disable @typescript-eslint/no-explicit-any */
// This file needs to use 'any' types for Zod v3/v4 compatibility

import { z, type ZodTypeAny } from 'zod';
import type { Validator } from './RuneForm.svelte.js';
import { flattenZodIssues } from './helpers.js';
import {
    getArrayElement,
    getDefaultValue,
    getInnerType,
    getNumberChecks,
    getObjectShape,
    getUnionOptions,
    isOptionalish,
    isZodArray,
    isZodDefault,
    isZodNumber,
    isZodObject,
    isZodUnion,
    unwrapSchema as unwrapSchemaCompat
} from './zodCompat.js';

// --- Caching for performance ---
const shapeCache = new WeakMap<any, Record<string, ZodTypeAny>>();
const elementCache = new WeakMap<any, ZodTypeAny>();
const unwrappedCache = new WeakMap<ZodTypeAny, ZodTypeAny>();
const pathsCache = new WeakMap<ZodTypeAny, string[]>();

function getShape(schema: any): Record<string, ZodTypeAny> {
	if (!shapeCache.has(schema)) {
		const shape = getObjectShape(schema);
		shapeCache.set(schema, shape);
	}
	return shapeCache.get(schema)!;
}

function getElement(schema: any): ZodTypeAny {
	if (!elementCache.has(schema)) {
		const element = getArrayElement(schema);
		elementCache.set(schema, element);
	}
	return elementCache.get(schema)!;
}

function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
	if (unwrappedCache.has(schema)) return unwrappedCache.get(schema)!;
	const unwrapped = unwrapSchemaCompat(schema);
	unwrappedCache.set(schema, unwrapped);
	return unwrapped;
}

export function getZodInputConstraints(schema: ZodTypeAny): Record<string, unknown> {
	const constraints: Record<string, unknown> = {};

	// required flag based on original schema
	constraints.required = !isOptionalish(schema);

	const base = unwrapSchemaCompat(schema);

	if (isZodNumber(base)) {
		constraints.type = 'number';

		for (const check of getNumberChecks(base)) {
			if (check && typeof check === 'object' && 'kind' in check) {
				switch (check.kind) {
					case 'min':
						if ('value' in check) constraints.min = (check as { value: unknown }).value;
						break;
					case 'max':
						if ('value' in check) constraints.max = (check as { value: unknown }).value;
						break;
					case 'int':
						constraints.step = 1;
						break;
				}
			}
		}
	} else if (isZodArray(base)) {
		constraints.type = 'array';
	}

	// Optional: Add more cases for boolean, date, enum, etc.

	return constraints;
}

export function getAllPaths(schema: ZodTypeAny, base = '', depth = 0, maxDepth = 8): string[] {
	schema = unwrapSchema(schema);
	if (!schema || typeof schema !== 'object') return [];
	if (depth > maxDepth) return [];

	// Handle ZodUnion
	if (isZodUnion(schema)) {
		const options = getUnionOptions(schema);
		const all = options.flatMap((opt) => getAllPaths(opt, base, depth + 1, maxDepth));
		return [...new Set(all)];
	}

	if (isZodObject(schema)) {
		const shape = getShape(schema);
		const childPaths = Object.entries(shape).flatMap(([key, sub]) =>
			getAllPaths(sub as ZodTypeAny, base ? `${base}.${key}` : key, depth + 1, maxDepth)
		);
		return base ? [base, ...childPaths] : childPaths;
	}

	if (isZodArray(schema)) {
		const arrayBase = base ? `${base}.0` : '0';
		const element = getElement(schema);
		const inner = getAllPaths(element as ZodTypeAny, arrayBase, depth + 1, maxDepth);
		return base ? [base, ...inner] : inner;
	}

	return base ? [base] : [];
}

// --- Precompute all valid paths for a schema (once) ---
export function getPrecomputedPaths(schema: ZodTypeAny, maxDepth = 8): string[] {
	if (pathsCache.has(schema)) return pathsCache.get(schema) || [];
	const paths = getAllPaths(schema, '', 0, maxDepth);
	pathsCache.set(schema, paths);
	return paths;
}

// --- Batch validation helper ---
export function batchValidate(schema: ZodTypeAny, data: unknown) {
	return schema.safeParse(data);
}

// --- Metadata helper (from .describe()) ---
// getFieldDescription is now imported from helpers.js

import { RuneForm } from './RuneForm.svelte.js';

/**
 * Create a RuneForm instance from a Zod schema.
 * The schema must produce an object type.
 */
export function createForm<S extends ZodTypeAny>(
	schema: S,
	initialData?: Partial<z.infer<S>>
) {
	type T = z.infer<S> extends Record<string, unknown> ? z.infer<S> : Record<string, unknown>;
	return new RuneForm<T>(createZodValidator(schema) as Validator<T>, initialData as Partial<T>);
}

export function createZodValidator<S extends ZodTypeAny>(schema: S): Validator<z.infer<S>> {
	return {
		parse(data: unknown): z.infer<S> {
			return schema.parse(data);
		},
		safeParse(
			data: unknown
		): { success: true; data: z.infer<S> } | { success: false; errors: Record<string, string[]> } {
			const result = schema.safeParse(data);
			if (result.success) return { success: true, data: result.data };
			return { success: false, errors: flattenZodIssues(result.error.issues) };
		},

		async safeParseAsync(
			data: unknown
		): Promise<
			{ success: true; data: z.infer<S> } | { success: false; errors: Record<string, string[]> }
		> {
			const result = await schema.safeParseAsync(data);
			if (result.success) return { success: true, data: result.data };
			return { success: false, errors: flattenZodIssues(result.error.issues) };
		},
		resolveDefaults(data: Partial<z.infer<S>>): z.infer<S> {
			const walk = (schema: ZodTypeAny, value: unknown): unknown => {
				if (isZodDefault(schema)) {
					const innerType = getInnerType(schema);
					const defaultValue = getDefaultValue(schema);

					if (value !== undefined) {
						return walk(innerType, value);
					}

					return walk(innerType, defaultValue);
				}

				if (isZodObject(schema)) {
					const result: Record<string, unknown> = {};
					const shape = getShape(schema);
					for (const key in shape) {
						const fieldSchema = shape[key];
						const val = (value as Record<string, unknown> | undefined)?.[key];
						result[key] = walk(fieldSchema, val);
					}
					return result;
				}

				if (isZodArray(schema)) {
					if (Array.isArray(value)) {
						const element = getElement(schema);
						return value.map((v) => walk(element, v));
					}
					return [];
				}

				// primitive or unhandled type
				return value !== undefined ? value : undefined;
			};

			return walk(schema, data ?? {}) as z.infer<S>;
		},
		getPaths: () => getAllPaths(schema),
		getInputAttributes(path: string) {
			let current: ZodTypeAny = schema;
			for (const key of path.split('.')) {
				if (isZodObject(current)) {
					const shape = getShape(current);
					current = shape[key];
				} else if (isZodArray(current) && /^\d+$/.test(key)) {
					current = getElement(current);
				} else {
					return {};
				}
			}
			return getZodInputConstraints(current); // 🧠 Zod-specific utility
		}
	};
}

