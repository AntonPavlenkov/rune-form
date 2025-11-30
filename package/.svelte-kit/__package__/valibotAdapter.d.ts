import type { BaseIssue, BaseSchema, InferOutput } from 'valibot';
import * as v from 'valibot';
import type { Validator } from './RuneForm.svelte.js';
export declare function getValibotInputConstraints(schema: any): Record<string, unknown>;
export declare function getAllPaths(schema: any, base?: string, depth?: number, maxDepth?: number): string[];
export declare function getPrecomputedPaths(schema: any, maxDepth?: number): string[];
export declare function batchValidate(schema: BaseSchema<unknown, unknown, BaseIssue<unknown>>, data: unknown): v.SafeParseResult<BaseSchema<unknown, unknown, BaseIssue<unknown>>>;
export declare function createValibotValidator<S extends BaseSchema<unknown, unknown, BaseIssue<unknown>>>(schema: S): Validator<InferOutput<S>>;
