import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { z, ZodObject, ZodTypeAny } from 'zod';
import { createCustomValidator } from './customAdapter.js';
import {
	clearStaleFieldCacheEntries,
	clearStalePathCacheEntries,
	debounceValidation,
	ensureArrayElementsReactive,
	evictOldestFromMap,
	getTouchedKeysForArray,
	handleArrayMethodTouchedState,
	MUTATING_ARRAY_METHODS,
	parsePath,
	shiftArrayIndicesInTouchedState,
	syncTouchedStateForArrayInsertion,
	syncTouchedStateForArrayRemoval,
	syncTouchedStateForArraySwap
} from './helpers.js';
import type { ArrayPaths, CustomValidator, Paths, PathValue } from './types.js';
import { createZodValidator } from './zodAdapter.js';

// TypeScript declaration for Symbol.dispose (available in TypeScript 5.2+)
declare global {
	interface SymbolConstructor {
		readonly dispose: unique symbol;
	}
}

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
	private _validationTimeoutId: number | undefined = undefined;

	// Cache for Proxies to prevent memory leaks
	private _proxyCache = new WeakMap<object, object>();
	// Cache for wrapped array methods to avoid recreating them
	private _methodCache = new WeakMap<object, SvelteMap<string, (...args: unknown[]) => unknown>>();
	// Set of array methods that modify the array (for O(1) lookup)
	private static readonly _MUTATING_ARRAY_METHODS = new SvelteSet(MUTATING_ARRAY_METHODS);
	// Track pending validation for array operations
	private _pendingArrayValidation = new SvelteSet<string>();

	// Cache size limits to prevent memory leaks
	private static readonly _MAX_PATH_CACHE_SIZE = 1000;
	private static readonly _MAX_FIELD_CACHE_SIZE = 500;

	// (removed) legacy precompiled regex patterns for array path operations -> replaced by on-demand patterns

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
		$effect(() => {
			// Track specific properties for changes
			$effect.tracking();
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this._data && this.touched;

			// Clear existing timeout
			if (this._validationTimeoutId !== undefined) {
				clearTimeout(this._validationTimeoutId);
			}

			// Debounce validation to avoid excessive calls during rapid updates
			this._validationTimeoutId = setTimeout(() => {
				this.validateSchema();
			}, 100) as unknown as number;
		});

		// Create a reactive data object that automatically marks fields as touched
		this.data = this.createReactiveData(this._data);
	}

	// (helpers moved to .helpers.ts)

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
					this._handleFieldChange(currentPath as unknown as Paths<T>);
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
								// Capture previous length for methods where it matters (e.g. pop)
								const previousLength = target.length;
								const result = method.apply(target, args);

								// Mark the array as touched and trigger debounced validation
								if (!this._isInternalUpdate) {
									this.markTouched(parentPath as unknown as Paths<T>);
									this._debouncedArrayValidation(parentPath);

									// Handle array method specific touched state syncing
									this._handleArrayMethodTouchedState(
										prop,
										args,
										target,
										parentPath,
										previousLength
									);

									// Clear stale field cache entries related to this array path
									this._clearStaleFieldCacheEntries(parentPath);
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

				const oldValue = target[prop as keyof typeof target];
				const currentPath = pathPrefix + String(prop);
				// @ts-expect-error - Array properties are writable in practice
				target[prop as keyof typeof target] = value;

				// Only mark as touched if this is not an internal update and the value actually changed
				if (!this._isInternalUpdate && oldValue !== value) {
					this._handleFieldChange(currentPath as unknown as Paths<T>);
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

	static fromCustom<T extends Record<string, unknown>>(
		validator: CustomValidator<T>,
		initialData?: Partial<T>
	) {
		return new RuneForm(createCustomValidator(validator), initialData);
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

		// Limit field cache size to prevent memory leaks
		if (this._fieldCache.size >= RuneForm._MAX_FIELD_CACHE_SIZE) {
			evictOldestFromMap(this._fieldCache);
		}

		this._fieldCache.set(path, field);
		return field;
	}

	private compilePath(path: string) {
		// Check if we already have compiled access for this path
		const existing = this._pathCache.get(path);
		if (existing) {
			return existing;
		}

		// Limit cache size to prevent memory leaks
		if (this._pathCache.size >= RuneForm._MAX_PATH_CACHE_SIZE) {
			evictOldestFromMap(this._pathCache);
		}

		// Parse and cache the path - optimize by doing it once
		const parsed = parsePath(path);
		const keys = parsed;
		const isArrayIndex = parsed.map((segment) => typeof segment === 'number');

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

		// Safety cleanup: remove stale entries after a timeout
		debounceValidation(
			() => {
				if (this._pendingArrayValidation.has(path)) {
					this._pendingArrayValidation.delete(path);
				}
			},
			5000,
			{ current: undefined }
		);
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
			// Perform the array operation directly on the array
			operation(arr);

			// Mark the array path as touched
			this.markTouched(path);

			// Clear stale field cache entries related to this array path
			this._clearStaleFieldCacheEntries(path as string);
		}
	}

	reset() {
		this._isInternalUpdate = true;
		this._data = this.safePopulate(this.initialData);
		this._isInternalUpdate = false;
		// Clear pending validation timeout
		if (this._validationTimeoutId !== undefined) {
			clearTimeout(this._validationTimeoutId);
			this._validationTimeoutId = undefined;
		}
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
			// First swap the array elements
			[arr[i], arr[j]] = [arr[j], arr[i]];

			// Re-enable touched state sync with the helper functions
			this._syncTouchedStateForArraySwap(path as string, i, j);
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
			// Perform the array operation first
			if (deleteCount !== undefined) {
				arr.splice(start, deleteCount, ...items);
			} else {
				arr.splice(start);
			}

			// Re-enable touched state sync with the helper functions
			const actualDeleteCount = deleteCount ?? arr.length - start;
			const insertCount = items.length;
			if (actualDeleteCount > 0) {
				this._syncTouchedStateForArrayRemoval(path as string, start, actualDeleteCount);
			}
			if (insertCount > 0) {
				this._syncTouchedStateForArrayInsertion(path as string, start, insertCount);
			}
		});
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

	// Helper methods for syncing touched state during array operations
	private _syncTouchedStateForArraySwap(arrayPath: string, i: number, j: number) {
		syncTouchedStateForArraySwap(this.touched, arrayPath, i, j);
	}

	private _syncTouchedStateForArrayRemoval(
		arrayPath: string,
		startIndex: number,
		deleteCount: number
	) {
		syncTouchedStateForArrayRemoval(this.touched, arrayPath, startIndex, deleteCount);
	}

	private _syncTouchedStateForArrayInsertion(
		arrayPath: string,
		startIndex: number,
		insertCount: number
	) {
		syncTouchedStateForArrayInsertion(this.touched, arrayPath, startIndex, insertCount);
	}

	// Helper method to ensure array elements remain reactive after splice
	private _ensureArrayElementsReactive(arrayPath: string, array: unknown[]) {
		ensureArrayElementsReactive(
			array,
			arrayPath,
			this.createReactiveData,
			this.createReactiveArray
		);
	}

	// Helper method to get all touched keys for a specific array
	private _getTouchedKeysForArray(arrayPath: string): string[] {
		return getTouchedKeysForArray(this.touched, arrayPath);
	}

	// Helper method to shift array indices in touched state
	private _shiftArrayIndices(
		touchedKeys: string[],
		arrayPath: string,
		startIndex: number,
		shiftAmount: number
	) {
		shiftArrayIndicesInTouchedState(this.touched, touchedKeys, arrayPath, startIndex, shiftAmount);
	}

	// Helper method to handle array method specific touched state syncing
	private _handleArrayMethodTouchedState(
		methodName: string,
		args: unknown[],
		target: unknown[],
		parentPath: string,
		previousLength?: number
	) {
		const result = handleArrayMethodTouchedState(methodName, args, target, previousLength);

		switch (methodName) {
			case 'splice': {
				if (result.deleteCount > 0) {
					this._syncTouchedStateForArrayRemoval(parentPath, result.start, result.deleteCount);
				}
				if (result.insertCount > 0) {
					this._syncTouchedStateForArrayInsertion(parentPath, result.start, result.insertCount);
				}

				// Ensure remaining array elements are reactive after splice
				this._ensureArrayElementsReactive(parentPath, target);
				break;
			}
			case 'pop': {
				// Remove touched state for the removed last item
				if (result.lastIndexBeforePop !== undefined && result.lastIndexBeforePop >= 0) {
					this._syncTouchedStateForArrayRemoval(parentPath, result.lastIndexBeforePop, 1);
				}
				break;
			}
			case 'shift': {
				// Remove touched state for the first item and shift others down
				this._syncTouchedStateForArrayRemoval(parentPath, result.start, result.deleteCount);
				break;
			}
			case 'unshift': {
				// Shift existing items up to make room for new items
				this._syncTouchedStateForArrayInsertion(parentPath, result.start, result.insertCount);
				break;
			}
			case 'push':
				// No need to sync touched state for push - new items aren't touched
				break;
		}
	}

	// Helper method to handle field changes consistently
	private _handleFieldChange(path: Paths<T>) {
		this.markTouched(path);
		// Trigger validation immediately for all changes to ensure reactivity
		this.validateSchema();
	}

	// Helper method to clear stale cache entries for array operations
	private _clearStaleFieldCacheEntries(arrayPath: string) {
		clearStaleFieldCacheEntries(this._fieldCache, arrayPath);
		clearStalePathCacheEntries(this._pathCache, arrayPath);
	}

	/**
	 * Cleanup method for Svelte's automatic resource disposal.
	 * This method is called when the form instance goes out of scope.
	 */
	[Symbol.dispose]() {
		this.dispose();
	}

	/**
	 * Manual cleanup method to free resources and prevent memory leaks.
	 * Call this when you're done with the form instance.
	 */
	dispose() {
		// Clear all caches to free memory
		this._pathCache.clear();
		this._fieldCache.clear();
		this._pendingArrayValidation.clear();

		// Clear WeakMaps (they will be garbage collected automatically)
		this._proxyCache = new WeakMap<object, object>();
		this._methodCache = new WeakMap<object, SvelteMap<string, (...args: unknown[]) => unknown>>();

		// Clear pending validation timeout
		if (this._validationTimeoutId !== undefined) {
			clearTimeout(this._validationTimeoutId);
			this._validationTimeoutId = undefined;
		}

		// Reset reactive state to prevent memory leaks
		this._data = {} as T;
		this.errors = {};
		this.customErrors = {};
		this.touched = {};
		this.isValid = false;
		this.isValidating = false;
		this._errorCount = 0;
		this._isInternalUpdate = false;

		// Clear the valid paths set
		this._validPaths.clear();
	}
}
