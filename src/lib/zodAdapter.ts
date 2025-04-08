import {
	z,
	ZodArray,
	ZodDefault,
	ZodEffects,
	ZodNullable,
	ZodNumber,
	ZodObject,
	ZodOptional,
	ZodString,
	type ZodIssue,
	type ZodTypeAny
} from 'zod';
import type { Validator } from './RuneForm.svelte.js';

export function getZodInputConstraints(schema: ZodTypeAny): Record<string, any> {
	const constraints: Record<string, any> = {};

	// -- Helper: unwrap inner schema
	const unwrap = (s: ZodTypeAny): ZodTypeAny => {
		while (
			s instanceof ZodEffects ||
			s instanceof ZodOptional ||
			s instanceof ZodDefault ||
			s instanceof ZodNullable
		) {
			s = s instanceof ZodEffects ? s._def.schema : s._def.innerType;
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

			for (const check of base._def.checks) {
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
						constraints.pattern = check.regex.source;
						break;
				}
			}
			break;
		}

		case base instanceof ZodNumber: {
			constraints.type = 'number';

			for (const check of base._def.checks) {
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
	if (depth > 5) return [];

	if (schema instanceof ZodDefault) {
		return getAllPaths(schema._def.innerType, base, depth);
	}

	if (schema instanceof ZodObject) {
		return Object.entries(schema.shape).flatMap(([key, sub]) =>
			getAllPaths(sub as ZodTypeAny, base ? `${base}.${key}` : key, depth + 1)
		);
	}

	if (schema instanceof ZodArray) {
		const inner = getAllPaths(schema._def.type, `${base}.0`, depth + 1);
		return [base, ...inner];
	}

	return [base];
}

export function createZodValidator<S extends z.ZodTypeAny>(schema: S): Validator<z.infer<S>> {
	return {
		parse(data: unknown): S {
			return schema.parse(data);
		},
		safeParse(
			data: unknown
		): { success: true; data: S } | { success: false; errors: Record<string, string[]> } {
			const result = schema.safeParse(data);
			if (result.success) return { success: true, data: result.data };
			return { success: false, errors: flattenZodIssues(result.error.issues) };
		},

		async safeParseAsync(
			data: unknown
		): Promise<{ success: true; data: S } | { success: false; errors: Record<string, string[]> }> {
			const result = await schema.safeParseAsync(data);
			if (result.success) return { success: true, data: result.data };
			return { success: false, errors: flattenZodIssues(result.error.issues) };
		},
		resolveDefaults(data: Partial<S>): S {
			const walk = (schema: z.ZodTypeAny, value: any): any => {
				if (schema instanceof z.ZodDefault) {
					return value !== undefined
						? walk(schema._def.innerType, value)
						: schema._def.defaultValue();
				}

				if (schema instanceof z.ZodObject) {
					const result: Record<string, any> = {};
					for (const key in schema.shape) {
						const fieldSchema = schema.shape[key];
						const val = value?.[key];
						result[key] = walk(fieldSchema, val);
					}
					return result;
				}

				if (schema instanceof z.ZodArray) {
					if (Array.isArray(value)) {
						return value.map((v) => walk(schema._def.type, v));
					}
					return [];
				}

				// primitive or unhandled type
				return value !== undefined ? value : undefined;
			};

			return walk(schema, data ?? {}) as S;
		},
		getPaths: () => getAllPaths(schema),
		getInputAttributes(path: string) {
			let current: any = schema;
			for (const key of path.split('.')) {
				if (current instanceof z.ZodObject) {
					current = current.shape[key];
				} else if (current instanceof z.ZodArray && /^\d+$/.test(key)) {
					current = current._def.type;
				} else {
					return {};
				}
			}
			return getZodInputConstraints(current); // 🧠 Zod-specific utility
		}
	};
}
