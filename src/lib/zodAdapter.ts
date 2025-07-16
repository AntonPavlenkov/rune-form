import type { ZodIssue, ZodTypeAny } from 'zod';
import {
	z,
	ZodArray,
	ZodDefault,
	ZodNullable,
	ZodNumber,
	ZodObject,
	ZodOptional,
	ZodString
} from 'zod';
import type { Validator } from './RuneForm.svelte.js';

export function getZodInputConstraints(schema: ZodTypeAny): Record<string, unknown> {
	const constraints: Record<string, unknown> = {};

	// -- Helper: unwrap inner schema
	const unwrap = (s: ZodTypeAny): ZodTypeAny => {
		while (s instanceof ZodOptional || s instanceof ZodDefault || s instanceof ZodNullable) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			s = (s as any).def.innerType;
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
		case base instanceof ZodString: {
			constraints.type = 'text';

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			for (const check of (base as any).def.checks ?? []) {
				if (typeof check === 'object' && 'kind' in check) {
					switch (check.kind) {
						case 'min':
							constraints.minlength = check.value;
							break;
						case 'max':
							constraints.maxlength = check.value;
							break;
						case 'email':
							constraints.type = 'email';
							break;
						case 'url':
							constraints.type = 'url';
							break;
						case 'regex':
							if ('regex' in check && check.regex instanceof RegExp) {
								constraints.pattern = check.regex.source;
							}
							break;
					}
				}
			}
			break;
		}

		case base instanceof ZodNumber: {
			constraints.type = 'number';

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			for (const check of (base as any).def.checks ?? []) {
				if (typeof check === 'object' && 'kind' in check) {
					switch (check.kind) {
						case 'min':
							constraints.min = check.value;
							break;
						case 'max':
							constraints.max = check.value;
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

function flattenZodIssues(issues: ZodIssue[]): Record<string, string[]> {
	const errors: Record<string, string[]> = {};
	for (const issue of issues) {
		const path = issue.path.join('.');
		if (!errors[path]) errors[path] = [];
		errors[path].push(issue.message);
	}
	return errors;
}

export function getAllPaths(schema: ZodTypeAny, base = '', depth = 0): string[] {
	if (!schema || typeof schema !== 'object') return [];
	if (depth > 5) return [];

	if (schema instanceof ZodDefault) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return getAllPaths((schema as any).def.innerType, base, depth);
	}

	if (schema instanceof ZodObject) {
		return Object.entries(schema.shape).flatMap(([key, sub]) =>
			getAllPaths(sub as ZodTypeAny, base ? `${base}.${key}` : key, depth + 1)
		);
	}

	if (schema instanceof ZodArray) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const inner = getAllPaths((schema as any).def.type, `${base}.0`, depth + 1);
		return [base, ...inner];
	}

	return [base];
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
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					return value !== undefined
						? // eslint-disable-next-line @typescript-eslint/no-explicit-any
							walk((schema as any).def.innerType, value)
						: // eslint-disable-next-line @typescript-eslint/no-explicit-any
							typeof (schema as any).def.defaultValue === 'function'
							? // eslint-disable-next-line @typescript-eslint/no-explicit-any
								(schema as any).def.defaultValue()
							: // eslint-disable-next-line @typescript-eslint/no-explicit-any
								(schema as any).def.defaultValue;
				}

				if (schema instanceof ZodObject) {
					const result: Record<string, unknown> = {};
					for (const key in schema.shape) {
						const fieldSchema = schema.shape[key];
						const val = (value as Record<string, unknown> | undefined)?.[key];
						result[key] = walk(fieldSchema, val);
					}
					return result;
				}

				if (schema instanceof ZodArray) {
					if (Array.isArray(value)) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						return value.map((v) => walk((schema as any).def.type, v));
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
					current = current.shape[key];
				} else if (current instanceof ZodArray && /^\d+$/.test(key)) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					current = (current as any).def.type;
				} else {
					return {};
				}
			}
			return getZodInputConstraints(current); // 🧠 Zod-specific utility
		}
	};
}
