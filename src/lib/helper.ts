import { ZodArray, ZodDefault, ZodObject, type ZodTypeAny } from 'zod';

export function getAllPaths(schema: ZodTypeAny, base = '', depth = 0): string[] {
	if (!schema || typeof schema !== 'object') return [];
	if (depth > 5) return [];

	if (schema instanceof ZodDefault) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return getAllPaths((schema as any).def.innerType, base, depth);
	}

	if (schema instanceof ZodObject) {
		// .shape is public API
		return Object.entries(schema.shape).flatMap(([key, sub]) =>
			getAllPaths(sub as ZodTypeAny, base ? `${base}.${key}` : key, depth + 1)
		);
	}

	if (schema instanceof ZodArray) {
		const arrayPath = base;
		// .element is public API in Zod v4
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const inner = getAllPaths((schema as any).def.type, `${base}.0`, depth + 1);
		return [arrayPath, ...inner];
	}

	return [base];
}
