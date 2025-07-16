import type { z, ZodObject, ZodTypeAny } from 'zod';
import type { Paths, PathValue } from './types.js';
import { createZodValidator } from './zodAdapter.js';

export interface Validator<T> {
	parse(data: unknown): T;
	safeParse(
		data: unknown
	): { success: true; data: T } | { success: false; errors: Record<string, string[]> };
	safeParseAsync?(
		data: unknown
	): Promise<{ success: true; data: T } | { success: false; errors: Record<string, string[]> }>;
	resolveDefaults?(data: Partial<T>): T;
	getPaths?: () => string[];
	getInputAttributes?: (path: string) => Record<string, unknown>;
}

export class RuneForm<T extends Record<string, unknown>> {
	id = Math.random();
	data = $state<T>({} as T);
	errors = $state<Record<string, string[]>>({});
	customErrors = $state<Partial<Record<string, string[]>>>({});
	touched = $state<Record<Paths<T>, boolean>>({} as Record<Paths<T>, boolean>);

	isValid = $state(false);
	isSubmitting = $state(false);
	isValidating = $state(false);

	private _compiledAccess = new Map<
		string,
		{ get: (obj: T) => unknown; set: (obj: T, value: unknown) => void }
	>();
	private _fieldCache = new Map<string, unknown>();
	private _validPaths: Set<string>;

	constructor(
		private validator: Validator<T>,
		private initialData: Partial<T> = {},
		private options: {
			onSubmit?: (data: T) => void | Promise<void>;
			onError?: (errors: Record<string, string[]>) => void;
		} = {}
	) {
		this.data = this.safePopulate(this.initialData);

		const paths = this.validator.getPaths?.() ?? [];
		for (const path of paths) {
			this._compiledAccess.set(path, this.compilePath(path));
		}

		// Precompute valid paths with array index normalization
		this._validPaths = new Set(paths);

		$effect(() => {
			this.validateSchema();
		});
	}

	static fromSchema<S extends ZodObject<Record<string, ZodTypeAny>>>(
		schema: S,
		initialData?: Partial<z.infer<S>>,
		options?: {
			onSubmit?: (data: z.infer<S>) => void | Promise<void>;
			onError?: (errors: Record<string, string[]>) => void;
		}
	) {
		return new RuneForm<z.infer<S>>(createZodValidator(schema), initialData, options);
	}

	private _normalizePath(path: string): string {
		// Replace all numeric segments with 0 (for array indices)
		return path
			.split('.')
			.map((seg) => (/^\d+$/.test(seg) ? '0' : seg))
			.join('.');
	}

	private isArrayPath(path: string): boolean {
		const value = this.getPath(this.data, path);
		return Array.isArray(value);
	}

	array<K extends ArrayPaths<T>>(path: K) {
		// Use import.meta.env.MODE for Vite/SvelteKit, fallback to always throw in dev
		const isDev =
			typeof import.meta !== 'undefined' &&
			import.meta.env &&
			import.meta.env.MODE !== 'production';
		if (!this.isArrayPath(path as string)) {
			if (isDev) {
				throw new Error(`Path '${path}' is not an array field.`);
			}
		}
		return {
			push: (value: PathValue<T, `${K}.${number}`>) => this.push(path, value),
			insert: (index: number, value: PathValue<T, `${K}.${number}`>) =>
				this.insert(path, index, value),
			remove: (index: number) => this.remove(path, index),
			swap: (i: number, j: number) => this.swap(path, i, j),
			replace: (value: PathValue<T, K>) => this.replace(path, value)
		};
	}

	getField<K extends Paths<T>>(
		path: K
	): {
		value: PathValue<T, K>;
		error: string | undefined;
		errors: string[];
		touched: boolean;
		constraints: Record<string, unknown>;
		isValidating: boolean;
	} {
		const cached = this._fieldCache.get(path);
		if (cached)
			return cached as {
				value: PathValue<T, K>;
				error: string | undefined;
				errors: string[];
				touched: boolean;
				constraints: Record<string, unknown>;
				isValidating: boolean;
			};

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		const field = {
			get value(): PathValue<T, K> {
				return self.getPath(self.data, path) as PathValue<T, K>;
			},
			set value(val: PathValue<T, K>) {
				self.setPath(self.data, path, val);
				self.markTouched(path);
			},
			get error(): string | undefined {
				return (
					((self.errors[path as string] ?? [])[0] ??
						(self.customErrors[path as string] ?? [])[0]) ||
					undefined
				);
			},
			set error(val: string) {
				self.customErrors[path as string] = [val];
			},
			get errors(): string[] {
				return [
					...(self.errors[path as string] ?? []),
					...(self.customErrors[path as string] ?? [])
				];
			},
			set errors(vals: string[]) {
				self.customErrors[path as string] = vals;
			},
			get touched(): boolean {
				return self.touched[path] ?? false;
			},
			set touched(val: boolean) {
				self.touched[path] = val;
			},
			get constraints(): Record<string, unknown> {
				return self.validator.getInputAttributes?.(path as string) ?? {};
			},
			get isValidating(): boolean {
				return self.isValidating;
			}
		};

		// Document in code: For array helpers, use form.array(path) instead of field.array
		if (
			this._validPaths.has(this._normalizePath(path as string)) &&
			this.isArrayPath(path as string)
		) {
			// Object.assign(field, { array: this.array(path as ArrayPaths<T>) } as ArrayHelpers); // Removed dynamic array property
		}

		this._fieldCache.set(path, field);
		return field;
	}

	private getPath<K extends string>(obj: T, path: K): unknown {
		const keys = path.split('.');
		let current: unknown = obj;
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			if (current == null) {
				// Auto-populate missing parent as object or array
				const isArrayIndex = /^\d+$/.test(key);
				current = isArrayIndex ? [] : {};
				// Set on parent if possible
				if (i > 0) {
					const parent = this.getPath(obj, keys.slice(0, i).join('.'));
					if (Array.isArray(parent)) {
						(parent as unknown[])[Number(keys[i - 1])] = current;
					} else if (parent && typeof parent === 'object') {
						(parent as Record<string, unknown>)[keys[i - 1]] = current;
					}
				}
			}
			if (Array.isArray(current) && /^\d+$/.test(key)) {
				current = (current as unknown[])[Number(key)];
			} else if (current && typeof current === 'object') {
				current = (current as Record<string, unknown>)[key];
			} else {
				current = undefined;
			}
		}
		return current;
	}

	private setPath<K extends string>(obj: T, path: K, value: unknown): void {
		const keys = path.split('.');
		let current: unknown = obj;
		for (let i = 0; i < keys.length - 1; i++) {
			const key = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i];
			if (
				!(typeof key === 'number'
					? Array.isArray(current) && key in current
					: typeof current === 'object' &&
						current &&
						key in (current as Record<string, unknown>)) ||
				(typeof key === 'number'
					? typeof (current as unknown[])[key] !== 'object'
					: typeof (current as Record<string, unknown>)[key] !== 'object') ||
				(typeof key === 'number'
					? (current as unknown[])[key] === null
					: (current as Record<string, unknown>)[key] === null)
			) {
				const isNextIndex = /^\d+$/.test(keys[i + 1] ?? '');
				if (typeof key === 'number' && Array.isArray(current)) {
					(current as unknown[])[key] = isNextIndex ? [] : {};
				} else if (typeof current === 'object' && current) {
					(current as Record<string, unknown>)[key as string] = isNextIndex ? [] : {};
				}
			}
			if (typeof key === 'number' && Array.isArray(current)) {
				current = (current as unknown[])[key];
			} else if (typeof current === 'object' && current) {
				current = (current as Record<string, unknown>)[key as string];
			} else {
				current = undefined;
			}
		}
		const lastKey = /^\d+$/.test(keys.at(-1)!) ? Number(keys.at(-1)!) : keys.at(-1)!;
		if (typeof lastKey === 'number' && Array.isArray(current)) {
			(current as unknown[])[lastKey] = value;
		} else if (typeof current === 'object' && current) {
			(current as Record<string, unknown>)[lastKey as string] = value;
		}
	}

	private compilePath(path: string) {
		const keys = path.split('.');

		const get = (obj: T): unknown =>
			keys.reduce(
				(curr: unknown, key) =>
					curr && typeof curr === 'object' ? (curr as Record<string, unknown>)[key] : undefined,
				obj
			);

		const set = (obj: T, value: unknown): void => {
			let current: unknown = obj;
			for (let i = 0; i < keys.length - 1; i++) {
				const k = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i];
				if (
					!(k in (current as Record<string, unknown>)) ||
					typeof (current as Record<string, unknown>)[k] !== 'object'
				) {
					const isNextIndex = /^\d+$/.test(keys[i + 1] ?? '');
					(current as Record<string, unknown>)[k] = isNextIndex ? [] : {};
				}
				current = (current as Record<string, unknown>)[k];
			}

			const lastKey = /^\d+$/.test(keys.at(-1)!) ? Number(keys.at(-1)!) : keys.at(-1)!;
			(current as Record<string, unknown>)[lastKey] = value;
		};

		return { get, set };
	}

	private safePopulate(data: Partial<T>): T {
		if (this.validator.resolveDefaults) {
			return this.validator.resolveDefaults(data);
		}
		try {
			return this.validator.parse(data);
		} catch {
			return data as T;
		}
	}

	async validateSchema() {
		this.isValidating = true;
		try {
			const result = this.validator.safeParseAsync
				? await this.validator.safeParseAsync(this.data)
				: this.validator.safeParse(this.data);

			this.errors = result.success ? {} : result.errors;
			this.isValid = result.success;
		} catch {
			this.isValid = false;
		} finally {
			this.isValidating = false;
		}
	}

	markTouched(path: Paths<T>) {
		this.touched[path] = true;
	}

	markFieldAsPristine(path: Paths<T>) {
		this.touched[path] = false;
	}

	markAllTouched() {
		Object.keys(this.errors).forEach((path) => {
			this.touched[path as Paths<T>] = true;
		});
	}

	markAllAsPristine() {
		this.touched = {} as Record<Paths<T>, boolean>;
	}

	reset() {
		this.data = this.safePopulate(this.initialData);
		this.errors = {};
		this.customErrors = {};
		this.touched = {} as Record<Paths<T>, boolean>;
		this.isValid = false;
	}

	setCustomError(path: Paths<T> | (string & {}), message: string) {
		this.customErrors[path as string] = [message];
	}

	setCustomErrors(path: Paths<T> | (string & {}), messages: string[]) {
		this.customErrors[path as string] = messages;
	}

	push<K extends ArrayPaths<T>>(path: K, value: PathValue<T, `${K}.${number}`>) {
		const arr = this.getPath(this.data, path);
		if (Array.isArray(arr)) {
			(arr as unknown[]).push(value);
			this.markTouched(path);
			this.clearFieldCache();
		}
	}

	insert<K extends ArrayPaths<T>>(path: K, index: number, value: PathValue<T, `${K}.${number}`>) {
		const arr = this.getPath(this.data, path);
		if (Array.isArray(arr)) {
			(arr as unknown[]).splice(index, 0, value);
			this.markTouched(path);
			this.clearFieldCache();
		}
	}

	remove<K extends ArrayPaths<T>>(path: K, index: number) {
		const arr = this.getPath(this.data, path);
		if (Array.isArray(arr)) {
			(arr as unknown[]).splice(index, 1);
			this.markTouched(path);
			this.clearFieldCache();
		}
	}

	swap<K extends ArrayPaths<T>>(path: K, i: number, j: number) {
		const arr = this.getPath(this.data, path);
		if (Array.isArray(arr)) {
			[arr[i], arr[j]] = [arr[j], arr[i]];
			this.markTouched(path);
			this.clearFieldCache();
		}
	}

	replace<K extends ArrayPaths<T>>(path: K, value: PathValue<T, K>) {
		this.setPath(this.data, path, value);
		this.markTouched(path);
		this.clearFieldCache();
	}

	private _enhance =
		(
			options: {
				onSubmit?: (data: T) => void | Promise<void>;
				onError?: (errors: Record<string, string[]>) => void;
			} = {}
		) =>
		(el: HTMLFormElement) => {
			const handleSubmit = async (e: SubmitEvent) => {
				e.preventDefault();

				this.isSubmitting = true;

				await this.validateSchema();
				console.log('SUBMIT DATA', this.data);
				if (Object.keys(this.errors).length === 0) {
					await options.onSubmit?.(this.data);
				} else {
					options.onError?.(this.errors);
				}

				this.isSubmitting = false;
			};

			el.addEventListener('submit', handleSubmit);

			return {
				destroy() {
					el.removeEventListener('submit', handleSubmit);
				}
			};
		};

	get enhance() {
		return this._enhance();
	}

	clearFieldCache() {
		this._fieldCache.clear();
	}
}

type ArrayPaths<T> = {
	[K in Paths<T>]: PathValue<T, K> extends Array<unknown> ? K : never;
}[Paths<T>];
