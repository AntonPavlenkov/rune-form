import type { Validator } from './RuneForm.svelte.js';
import type { CustomValidator } from './types.js';
/**
 * Creates a custom validator from validation functions
 */
export declare function createCustomValidator<T extends Record<string, unknown>>(validator: CustomValidator<T>): Validator<T>;
