import type { Paths, PathValue } from './types.js';

/**
 * Interface for form methods/properties that Field needs access to
 * This avoids circular dependency between Field and RuneForm
 */
export interface FieldFormContext<T extends Record<string, unknown>> {
	readonly errors: Record<string, string[]>;
	readonly customErrors: Partial<Record<string, string[]>>;
	readonly touched: Record<string, boolean>;
	readonly isValidating: boolean;
	readonly data: T;
	setValue<K extends Paths<T>>(path: K, value: PathValue<T, K>): void;
	setCustomError(path: Paths<T>, message: string): void;
	setCustomErrors(path: Paths<T>, messages: string[]): void;
	markTouched(path: Paths<T>): void;
	markFieldAsPristine(path: Paths<T>): void;
	clearCustomError(path: Paths<T>): void;
}

/**
 * Compiled path accessor for getting/setting values
 */
export interface CompiledPath<T> {
	keys: (string | number)[];
	isArrayIndex: boolean[];
	normalizedPath: string;
	get: (obj: T) => unknown;
	set: (obj: T, value: unknown) => void;
}

/**
 * Reactive field class - all properties automatically update when form state changes
 */
export class Field<T extends Record<string, unknown>, K extends Paths<T>> {
	readonly #form: FieldFormContext<T>;
	readonly #path: string;
	readonly #compiled: CompiledPath<T>;
	readonly constraints: Record<string, unknown>;

	// Reactive derived properties - initialized in constructor
	#error: { readonly current: string | undefined };
	#errors: { readonly current: string[] };
	#touched: { readonly current: boolean };
	#isValidating: { readonly current: boolean };

	constructor(
		form: FieldFormContext<T>,
		path: K,
		compiled: CompiledPath<T>,
		constraints: Record<string, unknown>
	) {
		this.#form = form;
		this.#path = path as string;
		this.#compiled = compiled;
		this.constraints = constraints;

		// Initialize derived values using closures
		const pathStr = this.#path;
		this.#error = $derived.by(() => ({
			get current() {
				return form.errors[pathStr]?.[0] ?? form.customErrors[pathStr]?.[0];
			}
		}));
		this.#errors = $derived.by(() => ({
			get current() {
				return [...(form.errors[pathStr] ?? []), ...(form.customErrors[pathStr] ?? [])];
			}
		}));
		this.#touched = $derived.by(() => ({
			get current() {
				return form.touched[pathStr] ?? false;
			}
		}));
		this.#isValidating = $derived.by(() => ({
			get current() {
				return form.isValidating;
			}
		}));
	}

	get value(): PathValue<T, K> {
		return this.#compiled.get(this.#form.data) as PathValue<T, K>;
	}

	set value(val: PathValue<T, K>) {
		this.#form.setValue(this.#path as K, val);
	}

	get error(): string | undefined {
		return this.#error.current;
	}

	set error(val: string) {
		this.#form.setCustomError(this.#path as Paths<T>, val);
	}

	get errors(): string[] {
		return this.#errors.current;
	}

	set errors(vals: string[]) {
		this.#form.setCustomErrors(this.#path as Paths<T>, vals);
	}

	get touched(): boolean {
		return this.#touched.current;
	}

	set touched(val: boolean) {
		if (val) {
			this.#form.markTouched(this.#path as Paths<T>);
		} else {
			this.#form.markFieldAsPristine(this.#path as Paths<T>);
		}
	}

	get isValidating(): boolean {
		return this.#isValidating.current;
	}

	// Methods for manual control
	markTouched() {
		this.#form.markTouched(this.#path as Paths<T>);
	}

	markPristine() {
		this.#form.markFieldAsPristine(this.#path as Paths<T>);
	}

	setError(message: string) {
		this.#form.setCustomError(this.#path as Paths<T>, message);
	}

	setErrors(messages: string[]) {
		this.#form.setCustomErrors(this.#path as Paths<T>, messages);
	}

	clearError() {
		this.#form.clearCustomError(this.#path as Paths<T>);
	}
}

