import { SvelteMap, SvelteSet } from 'svelte/reactivity';
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
	private _data = $state<T>({} as T);
	errors = $state<Record<string, string[]>>({});
	customErrors = $state<Partial<Record<string, string[]>>>({});
	touched = $state<Record<string, boolean>>({});

	isValid = $state(false);
	isValidating = $state(false);
	private _errorCount = $state(0);

	// Unified cache for compiled paths and access functions
	private _pathCache = new SvelteMap<
		string,
		{
			keys: (string | number)[];
			isArrayIndex: boolean[];
			get: (obj: T) => unknown;
			set: (obj: T, value: unknown) => void;
		}
	>();
	private _fieldCache = new SvelteMap<string, unknown>();
	private _validPaths: SvelteSet<string>;
	private _isInternalUpdate = false;

	// Cache for Proxies to prevent memory leaks
	private _proxyCache = new WeakMap<object, object>();
	// Cache for wrapped array methods to avoid recreating them
	private _methodCache = new WeakMap<object, SvelteMap<string, (...args: unknown[]) => unknown>>();
	// Set of array methods that modify the array (for O(1) lookup)
	private static readonly _MUTATING_ARRAY_METHODS = new SvelteSet([
		'splice',
		'push',
		'pop',
		'shift',
		'unshift',
		'reverse',
		'sort',
		'fill'
	]);
	// Track pending validation for array operations
	private _pendingArrayValidation = new SvelteSet<string>();

	constructor(
		private validator: Validator<T>,
		private initialData: Partial<T> = {}
	) {
		this._data = this.safePopulate(this.initialData);

		const paths = this.validator.getPaths?.() ?? [];

		for (const path of paths) {
			this.compilePath(path);
		}

		// Precompute valid paths with array index normalization
		this._validPaths = new SvelteSet(paths);

		// Optimized validation effect with better tracking
		let validationTimeout: number;
		$effect(() => {
			// Track specific properties for changes
			$effect.tracking();
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this._data && this.touched;

			// Clear existing timeout
			if (validationTimeout) {
				clearTimeout(validationTimeout);
			}

			// Debounce validation to avoid excessive calls during rapid updates
			validationTimeout = setTimeout(() => {
				this.validateSchema();
			}, 100) as unknown as number;
		});

		// Create a reactive data object that automatically marks fields as touched
		this.data = this.createReactiveData(this._data);
	}

	// Create a reactive data object that automatically tracks changes
	private createReactiveData = (data: T, parentPath: string = ''): T => {
		// Check if we already have a Proxy for this object
		if (this._proxyCache.has(data)) {
			return this._proxyCache.get(data) as T;
		}

		// Cache path prefix for better performance
		const pathPrefix = parentPath ? `${parentPath}.` : '';

		const proxy = new Proxy(data, {
			get: (target, prop) => {
				const value = target[prop as keyof T];
				const currentPath = pathPrefix + String(prop);

				// If the value is an object (but not an array), make it reactive too
				if (value && typeof value === 'object' && !Array.isArray(value)) {
					return this.createReactiveData(value as T, currentPath);
				}

				// For arrays, we need to track array element changes
				if (Array.isArray(value)) {
					return this.createReactiveArray(value, currentPath);
				}

				return value;
			},
			set: (target, prop, value) => {
				const oldValue = target[prop as keyof T];
				const currentPath = pathPrefix + String(prop);

				target[prop as keyof T] = value;

				// Only mark as touched if this is not an internal update and the value actually changed
				if (!this._isInternalUpdate && oldValue !== value) {
					this.markTouched(currentPath as unknown as Paths<T>);
					// Trigger validation immediately for all changes to ensure reactivity
					this.validateSchema();
				}

				return true;
			}
		});

		// Cache the Proxy
		this._proxyCache.set(data, proxy);
		return proxy;
	};

	// Create a reactive array that tracks changes to array elements
	private createReactiveArray = (array: unknown[], parentPath: string): unknown[] => {
		// Check if we already have a Proxy for this array
		if (this._proxyCache.has(array)) {
			return this._proxyCache.get(array) as unknown[];
		}

		// Cache path prefix for better performance
		const pathPrefix = `${parentPath}.`;

		const proxy = new Proxy(array, {
			get: (target, prop) => {
				const value = target[prop as keyof typeof target];

				// If accessing an array element that's an object, make it reactive
				if (typeof prop === 'string' && /^\d+$/.test(prop)) {
					const elementPath = pathPrefix + prop;

					if (value && typeof value === 'object' && !Array.isArray(value)) {
						return this.createReactiveData(value as T, elementPath);
					}
				}

				// Intercept array methods to ensure reactivity
				if (typeof prop === 'string' && typeof value === 'function') {
					// Methods that modify the array
					if (RuneForm._MUTATING_ARRAY_METHODS.has(prop)) {
						// Check if we already have a cached wrapper for this method
						let methodCache = this._methodCache.get(array);
						if (!methodCache) {
							methodCache = new SvelteMap<string, (...args: unknown[]) => unknown>();
							this._methodCache.set(array, methodCache);
						}

						let wrappedMethod = methodCache.get(prop);
						if (!wrappedMethod) {
							const method = value as (...args: unknown[]) => unknown;
							wrappedMethod = (...args: unknown[]) => {
								const result = method.apply(target, args);

								// Mark the array as touched and trigger debounced validation
								if (!this._isInternalUpdate) {
									this.markTouched(parentPath as unknown as Paths<T>);
									this._debouncedArrayValidation(parentPath);
								}

								return result;
							};
							methodCache.set(prop, wrappedMethod);
						}

						return wrappedMethod;
					}
				}

				return value;
			},
			set: (target, prop, value) => {
				// Skip read-only properties and symbols
				if (typeof prop === 'symbol' || prop === 'length') {
					return true;
				}

				// Check if property is writable
				const descriptor = Object.getOwnPropertyDescriptor(target, prop);
				if (descriptor && !descriptor.writable && !descriptor.set) {
					return true;
				}

				const oldValue = target[prop as keyof typeof target];
				const currentPath = pathPrefix + String(prop);
				// @ts-expect-error - we know this is writable
				target[prop as keyof typeof target] = value;

				// Only mark as touched if this is not an internal update and the value actually changed
				if (!this._isInternalUpdate && oldValue !== value) {
					this.markTouched(currentPath as unknown as Paths<T>);
					// Trigger validation immediately for all changes to ensure reactivity
					this.validateSchema();
				}

				return true;
			}
		});

		// Cache the Proxy
		this._proxyCache.set(array, proxy);
		return proxy;
	};

	// Public data getter that returns the reactive data
	get data(): T {
		return this._data;
	}

	// Public data setter that handles internal updates
	set data(value: T) {
		this._isInternalUpdate = true;
		this._data = value;
		this._isInternalUpdate = false;
	}

	static fromSchema<S extends ZodObject<Record<string, ZodTypeAny>>>(
		schema: S,
		initialData?: Partial<z.infer<S>>
	) {
		return new RuneForm<z.infer<S>>(createZodValidator(schema), initialData);
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
		// Use compiled access for better performance
		const compiled = this.compilePath(path as string);

		const fieldCached = this._fieldCache.get(path);
		if (fieldCached)
			return fieldCached as {
				value: PathValue<T, K>;
				error: string | undefined;
				errors: string[];
				touched: boolean;
				constraints: Record<string, unknown>;
				isValidating: boolean;
			};

		// Cache normalized path for validation
		const normalizedPath = path
			.split('.')
			.map((seg) => (/^\d+$/.test(seg) ? '0' : seg))
			.join('.');
		if (!this._validPaths.has(normalizedPath)) {
			return {
				value: undefined as PathValue<T, K>,
				error: undefined,
				errors: [],
				touched: false,
				constraints: {},
				isValidating: false
			};
		}

		const field = this._createFieldObject(path, compiled);
		this._fieldCache.set(path, field);
		return field;
	}

	private compilePath(path: string) {
		// Check if we already have compiled access for this path
		const existing = this._pathCache.get(path);
		if (existing) {
			return existing;
		}

		// Parse and cache the path - optimize by doing it once
		const segments = path.split('.');
		const keys = new Array(segments.length);
		const isArrayIndex = new Array(segments.length);

		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			const isIndex = /^\d+$/.test(segment);
			keys[i] = isIndex ? Number(segment) : segment;
			isArrayIndex[i] = isIndex;
		}

		const get = (obj: T): unknown => {
			let current: unknown = obj;
			for (let i = 0; i < keys.length; i++) {
				if (current == null || typeof current !== 'object') return undefined;
				current = (current as Record<string, unknown>)[keys[i] as string | number];
			}
			return current;
		};

		const set = (obj: T, value: unknown): void => {
			let current: unknown = obj;
			for (let i = 0; i < keys.length - 1; i++) {
				const key = keys[i];
				const isNextIndex = isArrayIndex[i + 1];

				if (
					typeof current !== 'object' ||
					current === null ||
					!(key in (current as Record<string, unknown>)) ||
					typeof (current as Record<string, unknown>)[key as string | number] !== 'object'
				) {
					(current as Record<string, unknown>)[key as string | number] = isNextIndex ? [] : {};
				}
				current = (current as Record<string, unknown>)[key as string | number];
			}
			const lastKey = keys[keys.length - 1];
			if (typeof current === 'object' && current !== null) {
				(current as Record<string, unknown>)[lastKey as string | number] = value;
			}
		};

		const compiled = { keys, isArrayIndex, get, set };
		this._pathCache.set(path, compiled);
		return compiled;
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
				? await this.validator.safeParseAsync(this._data)
				: this.validator.safeParse(this._data);

			this.errors = result.success ? {} : result.errors;
			this.isValid = result.success;
			this._errorCount = result.success ? 0 : Object.keys(result.errors).length;
		} catch {
			this.isValid = false;
			this._errorCount = 1;
		} finally {
			this.isValidating = false;
		}
	}

	// Debounced validation for array operations to avoid excessive calls
	private _debouncedArrayValidation(path: string) {
		if (this._pendingArrayValidation.has(path)) return;

		this._pendingArrayValidation.add(path);

		// Use microtask to batch validation calls
		queueMicrotask(() => {
			this._pendingArrayValidation.delete(path);
			if (!this._isInternalUpdate) {
				this.validateSchema();
			}
		});
	}

	markTouched(path: Paths<T>) {
		this.touched[path as string] = true;
	}

	markFieldAsPristine(path: Paths<T>) {
		this.touched[path as string] = false;
	}

	markAllTouched() {
		for (const path of Object.keys(this.errors)) {
			this.touched[path] = true;
		}
	}

	markAllAsPristine() {
		this.touched = {};
	}

	// Helper method to reduce array operation duplication
	private _executeArrayOperation<K extends ArrayPaths<T>>(
		path: K,
		operation: (arr: unknown[]) => void
	) {
		const cached = this._pathCache.get(path as string);
		if (!cached) return;
		const arr = cached.get(this._data);
		if (Array.isArray(arr)) {
			// Create a copy of the array to avoid direct mutation
			const newArray = [...(arr as unknown[])];
			operation(newArray);
			// Use the Proxy's setter to ensure reactivity
			cached.set(this._data, newArray);
			this.markTouched(path);
			// Only clear cache if field cache has entries to avoid unnecessary work
			if (this._fieldCache.size > 0) {
				this._fieldCache.clear();
			}
		}
	}

	reset() {
		this._isInternalUpdate = true;
		this._data = this.safePopulate(this.initialData);
		this._isInternalUpdate = false;
		this.errors = {};
		this.customErrors = {};
		this.touched = {};
		this.isValid = false;
		// Clear caches to ensure fresh state
		this._proxyCache = new WeakMap<object, object>();
		this._methodCache = new WeakMap<object, SvelteMap<string, (...args: unknown[]) => unknown>>();
		this._fieldCache.clear();
		this._pendingArrayValidation.clear();
		// Recreate reactive data to ensure fresh Proxies
		this.data = this.createReactiveData(this._data);
	}

	setCustomError(path: Paths<T> | (string & {}), message: string) {
		this.customErrors[path as string] = [message];
	}

	setCustomErrors(path: Paths<T> | (string & {}), messages: string[]) {
		this.customErrors[path as string] = messages;
	}

	push<K extends ArrayPaths<T>>(path: K, value: PathValue<T, `${K}.${number}`>) {
		this._executeArrayOperation(path, (arr) => arr.push(value));
	}

	swap<K extends ArrayPaths<T>>(path: K, i: number, j: number) {
		this._executeArrayOperation(path, (arr) => {
			// Swap the array elements
			[arr[i], arr[j]] = [arr[j], arr[i]];
		});
	}

	// Method to safely use splice on arrays while maintaining reactivity
	splice<K extends ArrayPaths<T>>(
		path: K,
		start: number,
		deleteCount?: number,
		...items: PathValue<T, `${K}.${number}`>[]
	) {
		this._executeArrayOperation(path, (arr) => {
			if (deleteCount !== undefined) {
				arr.splice(start, deleteCount, ...items);
			} else {
				arr.splice(start);
			}
		});
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

				await this.validateSchema();
				console.log('SUBMIT DATA', this._data);
				if (this._errorCount === 0) {
					await options.onSubmit?.(this._data);
				} else {
					options.onError?.(this.errors);
				}
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

	// Factory for creating field objects to reduce memory allocation
	private _createFieldObject<K extends Paths<T>>(
		path: K,
		compiled: { get: (obj: T) => unknown; set: (obj: T, value: unknown) => void }
	) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;

		// Cache constraints to avoid repeated calls
		const constraints = this.validator.getInputAttributes?.(path as string) ?? {};

		return {
			get value(): PathValue<T, K> {
				return compiled.get(self._data) as PathValue<T, K>;
			},
			set value(val: PathValue<T, K>) {
				compiled.set(self._data, val);
				if (!self._isInternalUpdate) {
					self.markTouched(path);
					// Trigger validation immediately for all changes to ensure reactivity
					self.validateSchema();
				}
			},
			get error(): string | undefined {
				return (
					self.errors[path as string]?.[0] ?? self.customErrors[path as string]?.[0] ?? undefined
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
				return self.touched[path as string] ?? false;
			},
			set touched(val: boolean) {
				self.touched[path as string] = val;
			},
			get constraints(): Record<string, unknown> {
				return constraints;
			},
			get isValidating(): boolean {
				return self.isValidating;
			}
		};
	}
}

type ArrayPaths<T> = {
	[K in Paths<T>]: PathValue<T, K> extends Array<unknown> ? K : never;
}[Paths<T>];
