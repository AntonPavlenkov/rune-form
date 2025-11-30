/* eslint-disable @typescript-eslint/no-explicit-any */
// This file needs to use 'any' types for Zod v3/v4 compatibility
import { z } from 'zod';
import { flattenZodIssues } from './helpers.js';
import { getArrayElement, getDefaultValue, getInnerType, getNumberChecks, getObjectShape, getUnionOptions, isOptionalish, isZodArray, isZodDefault, isZodNumber, isZodObject, isZodUnion, unwrapSchema as unwrapSchemaCompat } from './zodCompat.js';
// --- Caching for performance ---
const shapeCache = new WeakMap();
const elementCache = new WeakMap();
const unwrappedCache = new WeakMap();
const pathsCache = new WeakMap();
function getShape(schema) {
    if (!shapeCache.has(schema)) {
        const shape = getObjectShape(schema);
        shapeCache.set(schema, shape);
    }
    return shapeCache.get(schema);
}
function getElement(schema) {
    if (!elementCache.has(schema)) {
        const element = getArrayElement(schema);
        elementCache.set(schema, element);
    }
    return elementCache.get(schema);
}
function unwrapSchema(schema) {
    if (unwrappedCache.has(schema))
        return unwrappedCache.get(schema);
    const unwrapped = unwrapSchemaCompat(schema);
    unwrappedCache.set(schema, unwrapped);
    return unwrapped;
}
export function getZodInputConstraints(schema) {
    const constraints = {};
    // required flag based on original schema
    constraints.required = !isOptionalish(schema);
    const base = unwrapSchemaCompat(schema);
    if (isZodNumber(base)) {
        constraints.type = 'number';
        for (const check of getNumberChecks(base)) {
            if (check && typeof check === 'object' && 'kind' in check) {
                switch (check.kind) {
                    case 'min':
                        if ('value' in check)
                            constraints.min = check.value;
                        break;
                    case 'max':
                        if ('value' in check)
                            constraints.max = check.value;
                        break;
                    case 'int':
                        constraints.step = 1;
                        break;
                }
            }
        }
    }
    else if (isZodArray(base)) {
        constraints.type = 'array';
    }
    // Optional: Add more cases for boolean, date, enum, etc.
    return constraints;
}
export function getAllPaths(schema, base = '', depth = 0, maxDepth = 8) {
    schema = unwrapSchema(schema);
    if (!schema || typeof schema !== 'object')
        return [];
    if (depth > maxDepth)
        return [];
    // Handle ZodUnion
    if (isZodUnion(schema)) {
        const options = getUnionOptions(schema);
        const all = options.flatMap((opt) => getAllPaths(opt, base, depth + 1, maxDepth));
        return [...new Set(all)];
    }
    if (isZodObject(schema)) {
        const shape = getShape(schema);
        const childPaths = Object.entries(shape).flatMap(([key, sub]) => getAllPaths(sub, base ? `${base}.${key}` : key, depth + 1, maxDepth));
        return base ? [base, ...childPaths] : childPaths;
    }
    if (isZodArray(schema)) {
        const arrayBase = base ? `${base}.0` : '0';
        const element = getElement(schema);
        const inner = getAllPaths(element, arrayBase, depth + 1, maxDepth);
        return base ? [base, ...inner] : inner;
    }
    return base ? [base] : [];
}
// --- Precompute all valid paths for a schema (once) ---
export function getPrecomputedPaths(schema, maxDepth = 8) {
    if (pathsCache.has(schema))
        return pathsCache.get(schema) || [];
    const paths = getAllPaths(schema, '', 0, maxDepth);
    pathsCache.set(schema, paths);
    return paths;
}
// --- Batch validation helper ---
export function batchValidate(schema, data) {
    return schema.safeParse(data);
}
// --- Metadata helper (from .describe()) ---
// getFieldDescription is now imported from helpers.js
export function createZodValidator(schema) {
    return {
        parse(data) {
            return schema.parse(data);
        },
        safeParse(data) {
            const result = schema.safeParse(data);
            if (result.success)
                return { success: true, data: result.data };
            return { success: false, errors: flattenZodIssues(result.error.issues) };
        },
        async safeParseAsync(data) {
            const result = await schema.safeParseAsync(data);
            if (result.success)
                return { success: true, data: result.data };
            return { success: false, errors: flattenZodIssues(result.error.issues) };
        },
        resolveDefaults(data) {
            const walk = (schema, value) => {
                if (isZodDefault(schema)) {
                    const innerType = getInnerType(schema);
                    const defaultValue = getDefaultValue(schema);
                    if (value !== undefined) {
                        return walk(innerType, value);
                    }
                    return walk(innerType, defaultValue);
                }
                if (isZodObject(schema)) {
                    const result = {};
                    const shape = getShape(schema);
                    for (const key in shape) {
                        const fieldSchema = shape[key];
                        const val = value?.[key];
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
            return walk(schema, data ?? {});
        },
        getPaths: () => getAllPaths(schema),
        getInputAttributes(path) {
            let current = schema;
            for (const key of path.split('.')) {
                if (isZodObject(current)) {
                    const shape = getShape(current);
                    current = shape[key];
                }
                else if (isZodArray(current) && /^\d+$/.test(key)) {
                    current = getElement(current);
                }
                else {
                    return {};
                }
            }
            return getZodInputConstraints(current); // 🧠 Zod-specific utility
        }
    };
}
