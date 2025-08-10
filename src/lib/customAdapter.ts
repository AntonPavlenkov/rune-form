import type { Validator } from './RuneForm.svelte.js';
import type { CustomValidator } from './types.js';

/**
 * Creates a custom validator from validation functions
 */
export function createCustomValidator<T extends Record<string, unknown>>(
	validator: CustomValidator<T>
): Validator<T> {
	return {
		parse(data: unknown): T {
			return data as T;
		},

		safeParse(
			data: unknown
		): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
			const errors: Record<string, string[]> = {};
			let hasErrors = false;

			// Run all validation functions
			for (const [key, validateFn] of Object.entries(validator)) {
				if (validateFn && typeof validateFn === 'function') {
					const value = (data as Record<string, unknown>)[key];
					try {
						const result = validateFn(value, data as Record<string, unknown>);

						// Handle both sync and async results
						if (result instanceof Promise) {
							// For sync safeParse, we'll treat async validators as valid
							// The async version will handle these properly
							continue;
						}

						if (Array.isArray(result) && result.length > 0) {
							errors[key] = result;
							hasErrors = true;
						}
					} catch {
						errors[key] = ['Validation error occurred'];
						hasErrors = true;
					}
				}
			}

			if (hasErrors) {
				return { success: false, errors };
			}

			return { success: true, data: data as T };
		},

		async safeParseAsync(
			data: unknown
		): Promise<{ success: true; data: T } | { success: false; errors: Record<string, string[]> }> {
			const errors: Record<string, string[]> = {};
			let hasErrors = false;

			// Run all validation functions (including async ones)
			for (const [key, validateFn] of Object.entries(validator)) {
				if (validateFn && typeof validateFn === 'function') {
					const value = (data as Record<string, unknown>)[key];
					try {
						const result = validateFn(value, data as Record<string, unknown>);

						let validationErrors: string[];
						if (result instanceof Promise) {
							validationErrors = await result;
						} else {
							validationErrors = result;
						}

						if (Array.isArray(validationErrors) && validationErrors.length > 0) {
							errors[key] = validationErrors;
							hasErrors = true;
						}
					} catch {
						errors[key] = ['Validation error occurred'];
						hasErrors = true;
					}
				}
			}

			if (hasErrors) {
				return { success: false, errors };
			}

			return { success: true, data: data as T };
		},

		resolveDefaults(data: Partial<T>): T {
			return data as T;
		},

		getPaths(): string[] {
			return Object.keys(validator);
		},

		getInputAttributes(): Record<string, unknown> {
			// Return empty object for custom validators
			// You could enhance this to return specific attributes if needed
			return {};
		}
	};
}
