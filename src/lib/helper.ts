import { ZodArray, ZodDefault, ZodObject, type ZodTypeAny } from 'zod';

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
		const arrayPath = base;
		const inner = getAllPaths(schema._def.type, `${base}.0`, depth + 1);
		return [arrayPath, ...inner];
	}

	return [base];
}
