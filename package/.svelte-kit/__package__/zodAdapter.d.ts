import { z, type ZodTypeAny } from 'zod';
import type { Validator } from './RuneForm.svelte.js';
export declare function getZodInputConstraints(schema: ZodTypeAny): Record<string, unknown>;
export declare function getAllPaths(schema: ZodTypeAny, base?: string, depth?: number, maxDepth?: number): string[];
export declare function getPrecomputedPaths(schema: ZodTypeAny, maxDepth?: number): string[];
export declare function batchValidate(schema: ZodTypeAny, data: unknown): z.ZodSafeParseResult<unknown>;
export declare function createZodValidator<S extends ZodTypeAny>(schema: S): Validator<z.infer<S>>;
