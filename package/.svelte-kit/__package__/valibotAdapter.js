/* eslint-disable @typescript-eslint/no-explicit-any */
// This file needs to use 'any' types for Valibot compatibility
import * as v from 'valibot';
// Helper to flatten Valibot issues into the format expected by RuneForm
function flattenValibotIssues(issues) {
    const flattened = {};
    for (const issue of issues) {
        if (issue.path && issue.path.length > 0) {
            const path = issue.path.map((p) => String(p.key)).join('.');
            if (!flattened[path]) {
                flattened[path] = [];
            }
            flattened[path].push(issue.message || 'Validation error');
        }
        else {
            // Root level error
            if (!flattened['']) {
                flattened[''] = [];
            }
            flattened[''].push(issue.message || 'Validation error');
        }
    }
    return flattened;
}
// Helper to get the schema type
function getSchemaType(schema) {
    if (!schema || typeof schema !== 'object')
        return null;
    // Check for type property
    if (schema.type) {
        return schema.type;
    }
    // Check for _def property (similar to Zod)
    if (schema._def?.type) {
        return schema._def.type;
    }
    return null;
}
// Helper to check if schema is optional
function isOptionalish(schema) {
    if (!schema || typeof schema !== 'object')
        return false;
    const type = getSchemaType(schema);
    return type === 'optional' || type === 'nullable' || type === 'nullish';
}
// Helper to unwrap optional/nullable/nullish wrappers
function unwrapSchema(schema) {
    let current = schema;
    let depth = 0;
    const maxDepth = 10;
    while (depth < maxDepth) {
        const type = getSchemaType(current);
        if (type === 'optional' || type === 'nullable' || type === 'nullish') {
            if (current._def?.wrapped) {
                current = current._def.wrapped;
            }
            else if (current._def?.type) {
                // Try to find the inner schema
                break;
            }
            else {
                break;
            }
            depth++;
        }
        else {
            break;
        }
    }
    return current;
}
// Helper to get object entries
function getObjectEntries(schema) {
    if (!schema || typeof schema !== 'object')
        return {};
    // Check for entries property
    if (schema._def?.entries) {
        return schema._def.entries;
    }
    // Check for object property
    if (schema.entries) {
        return schema.entries;
    }
    return {};
}
// Helper to get array item schema
function getArrayItem(schema) {
    if (!schema || typeof schema !== 'object')
        return null;
    // Check for item property
    if (schema._def?.item) {
        return schema._def.item;
    }
    if (schema.item) {
        return schema.item;
    }
    return null;
}
// Helper to get union options
function getUnionOptions(schema) {
    if (!schema || typeof schema !== 'object')
        return [];
    if (schema._def?.options) {
        return schema._def.options;
    }
    if (schema.options) {
        return schema.options;
    }
    return [];
}
// Helper to get default value
function getDefaultValue(schema) {
    if (!schema || typeof schema !== 'object')
        return undefined;
    if (schema._def?.default) {
        const defaultValue = schema._def.default;
        return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
    return undefined;
}
// Helper to check if schema has default
function hasDefault(schema) {
    if (!schema || typeof schema !== 'object')
        return false;
    return schema._def?.default !== undefined;
}
// Cache for performance
const shapeCache = new WeakMap();
const elementCache = new WeakMap();
const unwrappedCache = new WeakMap();
const pathsCache = new WeakMap();
function getShape(schema) {
    if (!shapeCache.has(schema)) {
        const shape = getObjectEntries(schema);
        shapeCache.set(schema, shape);
    }
    return shapeCache.get(schema) || {};
}
function getElement(schema) {
    if (!elementCache.has(schema)) {
        const element = getArrayItem(schema);
        elementCache.set(schema, element);
    }
    return elementCache.get(schema);
}
function unwrapSchemaCached(schema) {
    if (unwrappedCache.has(schema))
        return unwrappedCache.get(schema);
    const unwrapped = unwrapSchema(schema);
    unwrappedCache.set(schema, unwrapped);
    return unwrapped;
}
export function getValibotInputConstraints(schema) {
    const constraints = {};
    // Required flag based on original schema
    constraints.required = !isOptionalish(schema);
    const base = unwrapSchemaCached(schema);
    const type = getSchemaType(base);
    if (type === 'number') {
        constraints.type = 'number';
        // Check for min/max/step in _def
        if (base._def) {
            if (base._def.minimum !== undefined) {
                constraints.min = base._def.minimum;
            }
            if (base._def.maximum !== undefined) {
                constraints.max = base._def.maximum;
            }
            if (base._def.integer === true) {
                constraints.step = 1;
            }
        }
    }
    else if (type === 'array') {
        constraints.type = 'array';
    }
    else if (type === 'string') {
        constraints.type = 'text';
        if (base._def) {
            if (base._def.minLength !== undefined) {
                constraints.minLength = base._def.minLength;
            }
            if (base._def.maxLength !== undefined) {
                constraints.maxLength = base._def.maxLength;
            }
        }
    }
    return constraints;
}
export function getAllPaths(schema, base = '', depth = 0, maxDepth = 8) {
    schema = unwrapSchemaCached(schema);
    if (!schema || typeof schema !== 'object')
        return [];
    if (depth > maxDepth)
        return [];
    const type = getSchemaType(schema);
    // Handle union
    if (type === 'union') {
        const options = getUnionOptions(schema);
        const all = options.flatMap((opt) => getAllPaths(opt, base, depth + 1, maxDepth));
        return [...new Set(all)];
    }
    // Handle object
    if (type === 'object') {
        const shape = getShape(schema);
        const childPaths = Object.entries(shape).flatMap(([key, sub]) => getAllPaths(sub, base ? `${base}.${key}` : key, depth + 1, maxDepth));
        return base ? [base, ...childPaths] : childPaths;
    }
    // Handle array
    if (type === 'array') {
        const arrayBase = base ? `${base}.0` : '0';
        const element = getElement(schema);
        if (element) {
            const inner = getAllPaths(element, arrayBase, depth + 1, maxDepth);
            return base ? [base, ...inner] : inner;
        }
        return base ? [base] : [];
    }
    return base ? [base] : [];
}
// Precompute all valid paths for a schema (once)
export function getPrecomputedPaths(schema, maxDepth = 8) {
    if (pathsCache.has(schema))
        return pathsCache.get(schema) || [];
    const paths = getAllPaths(schema, '', 0, maxDepth);
    pathsCache.set(schema, paths);
    return paths;
}
// Batch validation helper
export function batchValidate(schema, data) {
    return v.safeParse(schema, data);
}
export function createValibotValidator(schema) {
    return {
        parse(data) {
            return v.parse(schema, data);
        },
        safeParse(data) {
            const result = v.safeParse(schema, data);
            if (result.success) {
                return { success: true, data: result.output };
            }
            return { success: false, errors: flattenValibotIssues(result.issues) };
        },
        async safeParseAsync(data) {
            const result = await v.safeParseAsync(schema, data);
            if (result.success) {
                return { success: true, data: result.output };
            }
            return { success: false, errors: flattenValibotIssues(result.issues) };
        },
        resolveDefaults(data) {
            const walk = (schema, value) => {
                if (hasDefault(schema)) {
                    const innerType = unwrapSchemaCached(schema);
                    const defaultValue = getDefaultValue(schema);
                    if (value !== undefined) {
                        return walk(innerType, value);
                    }
                    return walk(innerType, defaultValue);
                }
                const unwrapped = unwrapSchemaCached(schema);
                const type = getSchemaType(unwrapped);
                if (type === 'object') {
                    const result = {};
                    const shape = getShape(unwrapped);
                    for (const key in shape) {
                        const fieldSchema = shape[key];
                        const val = value?.[key];
                        result[key] = walk(fieldSchema, val);
                    }
                    return result;
                }
                if (type === 'array') {
                    if (Array.isArray(value)) {
                        const element = getElement(unwrapped);
                        if (element) {
                            return value.map((v) => walk(element, v));
                        }
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
                current = unwrapSchemaCached(current);
                const type = getSchemaType(current);
                if (type === 'object') {
                    const shape = getShape(current);
                    current = shape[key];
                }
                else if (type === 'array' && /^\d+$/.test(key)) {
                    current = getElement(current);
                }
                else {
                    return {};
                }
            }
            return getValibotInputConstraints(current);
        }
    };
}
