/* eslint-disable @typescript-eslint/no-explicit-any */
// This file handles compatibility between Zod v3 and v4
// We need to use 'any' types here because we're dealing with different Zod internal structures

import type { ZodTypeAny } from 'zod';

// Version-agnostic shape getter for ZodObject
export function getObjectShape(schema: any): Record<string, ZodTypeAny> {
	// Both v3 and v4 have _def property
	if (schema._def) {
		// In v3 and v4, shape can be a function or direct property
		if (typeof schema._def.shape === 'function') {
			return schema._def.shape();
		} else if (schema._def.shape) {
			return schema._def.shape;
		}
	}

	// Fallback: try direct shape property (some edge cases)
	if (schema.shape) {
		return typeof schema.shape === 'function' ? schema.shape() : schema.shape;
	}

	return {};
}

// Version-agnostic array element getter
export function getArrayElement(schema: any): ZodTypeAny {
	// Both v3 and v4 store element in _def
	if (schema._def) {
		// v4 uses 'element', v3 uses 'type'
		if (schema._def.element) {
			return schema._def.element;
		} else if (schema._def.type && typeof schema._def.type === 'object') {
			return schema._def.type;
		}
	}

	// Fallback to a schema that accepts any value
	return {
		_def: { type: 'unknown', typeName: 'ZodUnknown' },
		def: { type: 'unknown' },
		parse: (val: unknown) => val,
		safeParse: (val: unknown) => ({ success: true, data: val })
	} as unknown as ZodTypeAny;
}

// Version-agnostic inner type getter (for Optional, Nullable, Default)
export function getInnerType(schema: any): ZodTypeAny {
	if (schema._def) {
		// Both v3 and v4 use innerType
		if (schema._def.innerType) {
			return schema._def.innerType;
		}
		// Some schemas might use 'type' instead (but only if it's an object)
		if (schema._def.type && typeof schema._def.type === 'object') {
			return schema._def.type;
		}
	}

	// For ZodEffects and other wrappers
	if (schema.innerType) {
		return schema.innerType;
	}

	return schema as ZodTypeAny;
}

// Version-agnostic default value getter
export function getDefaultValue(schema: any): unknown {
	if (schema._def && schema._def.defaultValue !== undefined) {
		const defaultValue = schema._def.defaultValue;
		// Handle function defaults or Getter properties
		if (typeof defaultValue === 'function') {
			return defaultValue();
		}
		return defaultValue;
	}
	return undefined;
}

// Version-agnostic check for optional/nullable/default
export function isOptionalish(schema: any): boolean {
	// Check by method if available (works in both versions)
	if (typeof schema.isOptional === 'function' && schema.isOptional()) {
		return true;
	}
	if (typeof schema.isNullable === 'function' && schema.isNullable()) {
		return true;
	}

	// Check by type name (v3 uses typeName, v4 uses type)
	const typeName = schema._def?.typeName;
	const type = schema._def?.type;

	return (
		typeName === 'ZodOptional' ||
		typeName === 'ZodNullable' ||
		typeName === 'ZodDefault' ||
		type === 'optional' ||
		type === 'nullable' ||
		type === 'default'
	);
}

// Version-agnostic unwrap (remove Optional/Nullable/Default wrappers)
export function unwrapSchema(schema: any): ZodTypeAny {
	let current = schema;

	// Keep unwrapping while it's wrapped
	while (isOptionalish(current)) {
		const inner = getInnerType(current);
		if (inner === current) break; // Prevent infinite loop
		current = inner;
	}

	return current as ZodTypeAny;
}

// Version-agnostic checks getter for ZodNumber
export function getNumberChecks(schema: any): any[] {
	// Check both _def and def
	if (schema._def && schema._def.checks) {
		return schema._def.checks;
	}
	if (schema.def && schema.def.checks) {
		return schema.def.checks;
	}
	return [];
}

// Version-agnostic union options getter
export function getUnionOptions(schema: any): ZodTypeAny[] {
	if (schema._def) {
		if (schema._def.options) {
			return schema._def.options;
		}
		// Some versions might use 'types' instead
		if (schema._def.types) {
			return schema._def.types;
		}
	}
	return [];
}

// Version-agnostic type name checker
export function isZodType(schema: any, typeName: string): boolean {
	if (!schema) return false;

	// Check v3 style (with typeName)
	if (schema._def?.typeName === `Zod${typeName}`) {
		return true;
	}

	// Check v4 style (with type)
	const v4TypeMap: Record<string, string> = {
		Object: 'object',
		Array: 'array',
		Number: 'number',
		String: 'string',
		Boolean: 'boolean',
		Date: 'date',
		Union: 'union',
		Optional: 'optional',
		Nullable: 'nullable',
		Default: 'default'
	};

	const v4Type = v4TypeMap[typeName];
	if (v4Type && schema._def?.type === v4Type) {
		return true;
	}

	// Also check def without underscore (v4)
	if (v4Type && schema.def?.type === v4Type) {
		return true;
	}

	return false;
}

// Export convenience type checkers
export const isZodObject = (schema: any): boolean => isZodType(schema, 'Object');
export const isZodArray = (schema: any): boolean => isZodType(schema, 'Array');
export const isZodNumber = (schema: any): boolean => isZodType(schema, 'Number');
export const isZodString = (schema: any): boolean => isZodType(schema, 'String');
export const isZodBoolean = (schema: any): boolean => isZodType(schema, 'Boolean');
export const isZodDate = (schema: any): boolean => isZodType(schema, 'Date');
export const isZodUnion = (schema: any): boolean => isZodType(schema, 'Union');
export const isZodOptional = (schema: any): boolean => isZodType(schema, 'Optional');
export const isZodNullable = (schema: any): boolean => isZodType(schema, 'Nullable');
export const isZodDefault = (schema: any): boolean => isZodType(schema, 'Default');

