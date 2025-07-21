import {
	z,
	ZodArray,
	ZodDefault,
	ZodNullable,
	ZodNumber,
	ZodObject,
	ZodOptional,
	ZodUnion,
	type ZodTypeAny
} from 'zod';
import type { Validator } from './RuneForm.svelte.js';

// --- Caching for performance ---
const shapeCache = new WeakMap<ZodObject<Record<string, ZodTypeAny>>, Record<string, ZodTypeAny>>();
const elementCache = new WeakMap<ZodArray<ZodTypeAny>, ZodTypeAny>();
const unwrappedCache = new WeakMap<ZodTypeAny, ZodTypeAny>();
const pathsCache = new WeakMap<ZodTypeAny, string[]>();

function getShape(schema: ZodObject<Record<string, ZodTypeAny>>): Record<string, ZodTypeAny> {
	if (!shapeCache.has(schema)) {
		let shape: Record<string, ZodTypeAny> = {};
		if (schema._def && typeof schema._def.shape === 'function') {
			shape = (schema._def.shape as unknown as () => Record<string, ZodTypeAny>)();
		} else if (schema._def && schema._def.shape) {
			shape = schema._def.shape as Record<string, ZodTypeAny>;
		}
		shapeCache.set(schema, shape);
	}
	return shapeCache.get(schema)!;
}

function getElement(schema: ZodArray<ZodTypeAny>): ZodTypeAny {
	if (!elementCache.has(schema)) {
		let element: ZodTypeAny = z.unknown() as ZodTypeAny;
		if (schema._def && schema._def.element) {
			element = schema._def.element as ZodTypeAny;
		}
		elementCache.set(schema, element);
	}
	return elementCache.get(schema)!;
}

function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
	if (unwrappedCache.has(schema)) return unwrappedCache.get(schema)!;
	let s = schema;
	while (
		s.isOptional?.() ||
		s.isNullable?.() ||
		s instanceof ZodDefault ||
		s instanceof ZodOptional ||
		s instanceof ZodNullable
	) {
		s = (s as unknown as { def: { innerType: ZodTypeAny } }).def.innerType;
	}
	unwrappedCache.set(schema, s);
	return s;
}

export function getZodInputConstraints(schema: ZodTypeAny): Record<string, unknown> {
	const constraints: Record<string, unknown> = {};

	// -- Helper: unwrap inner schema
	const unwrap = (s: ZodTypeAny): ZodTypeAny => {
		while (s instanceof ZodOptional || s instanceof ZodDefault || s instanceof ZodNullable) {
			s = (s as unknown as { def: { innerType: ZodTypeAny } }).def.innerType;
		}
		return s;
	};

	// -- Helper: check if schema is optional-ish
	const isOptionalish = (s: ZodTypeAny): boolean => {
		return s instanceof ZodOptional || s instanceof ZodDefault || s instanceof ZodNullable;
	};

	// required flag based on original schema
	constraints.required = !isOptionalish(schema);

	const base = unwrap(schema);

	switch (true) {
		case base instanceof ZodNumber: {
			constraints.type = 'number';

			for (const check of (base as unknown as { def: { checks: unknown[] } }).def.checks ?? []) {
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
			break;
		}

		case base instanceof ZodArray: {
			constraints.type = 'array';
			break;
		}

		// Optional: Add more cases for boolean, date, enum, etc.
	}

	return constraints;
}

function flattenZodIssues(issues: unknown[]): Record<string, string[]> {
	const errors: Record<string, string[]> = {};
	for (const issue of issues as { path: string[]; message: string }[]) {
		const path = issue.path.join('.');
		if (!errors[path]) errors[path] = [];
		errors[path].push(issue.message);
	}
	return errors;
}

export function getAllPaths(schema: ZodTypeAny, base = '', depth = 0, maxDepth = 8): string[] {
	schema = unwrapSchema(schema);
	if (!schema || typeof schema !== 'object') return [];
	if (depth > maxDepth) return [];

	// Handle ZodUnion
	if (schema instanceof ZodUnion) {
		const options = (schema as ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>)._def.options;
		const all = options.flatMap((opt) => getAllPaths(opt, base, depth + 1, maxDepth));
		return [...new Set(all)];
	}

	if (schema instanceof ZodObject) {
		const shape = getShape(schema);
		const childPaths = Object.entries(shape).flatMap(([key, sub]) =>
			getAllPaths(sub as ZodTypeAny, base ? `${base}.${key}` : key, depth + 1, maxDepth)
		);
		return base ? [base, ...childPaths] : childPaths;
	}

	if (schema instanceof ZodArray) {
		const arrayBase = base ? `${base}.0` : '0';
		const element = getElement(schema as ZodArray<ZodTypeAny>);
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
export function getFieldDescription(schema: ZodTypeAny): string | undefined {
	return (schema as unknown as { _def: { description: string } })._def?.description;
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
				if (schema instanceof ZodDefault) {
					const innerType = (schema as unknown as { def: { innerType: ZodTypeAny } }).def.innerType;
					const defaultValue = (schema as unknown as { def: { defaultValue: unknown } }).def
						.defaultValue;

					if (value !== undefined) {
						return walk(innerType, value);
					}

					// Handle function defaults
					if (typeof defaultValue === 'function') {
						const defaultResult = (
							schema as unknown as { def: { defaultValue: () => unknown } }
						).def.defaultValue();
						return walk(innerType, defaultResult);
					}

					// Handle static defaults
					return walk(innerType, defaultValue);
				}

				if (schema instanceof ZodObject) {
					const result: Record<string, unknown> = {};
					for (const key in (schema as unknown as { shape: Record<string, ZodTypeAny> }).shape) {
						const fieldSchema = (schema as unknown as { shape: Record<string, ZodTypeAny> }).shape[
							key
						];
						const val = (value as Record<string, unknown> | undefined)?.[key];
						result[key] = walk(fieldSchema, val);
					}
					return result;
				}

				if (schema instanceof ZodArray) {
					if (Array.isArray(value)) {
						return value.map((v) =>
							walk((schema as unknown as { def: { type: ZodTypeAny } }).def.type, v)
						);
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
				if (current instanceof ZodObject) {
					current = (current as unknown as { shape: Record<string, ZodTypeAny> }).shape[key];
				} else if (current instanceof ZodArray && /^\d+$/.test(key)) {
					current = (current as unknown as { def: { type: ZodTypeAny } }).def.type;
				} else {
					return {};
				}
			}
			return getZodInputConstraints(current); // 🧠 Zod-specific utility
		}
	};
}
