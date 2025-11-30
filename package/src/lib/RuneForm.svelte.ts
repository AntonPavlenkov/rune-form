import { Field, type CompiledPath } from './Field.svelte.js';
import {
	clearStalePathCacheEntries,
	evictOldestFromMap,
	handleArrayMethodTouchedState,
	MUTATING_ARRAY_METHODS,
	parsePath,
	syncTouchedStateForArrayInsertion,
	syncTouchedStateForArrayRemoval,
	syncTouchedStateForArraySwap
} from './helpers.js';
import type { ArrayPaths, Paths, PathValue } from './types.js';

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

// Simple digit check - faster than regex for hot paths
const isDigit = (s: string): boolean => {
	const code = s.charCodeAt(0);
	return code >= 48 && code <= 57 && !/\D/.test(s);
};

// Re-export Field for convenience
export { Field };

export class RuneForm<T extends Record<string, unknown>> {
	private _data = $state<T>({} as T);
	errors = $state<Record<string, string[]>>({});
	customErrors = $state<Partial<Record<string, string[]>>>({});
	touched = $state<Record<string, boolean>>({});
	isValid = $state(false);
	isValidating = $state(false);

	// Use regular Map for non-reactive path cache
	private _pathCache = new Map<string, CompiledPath<T>>();
	// Cache Field instances - they contain $derived so should be reused
	private _fieldCache = new Map<string, Field<T, Paths<T>>>();
	private _validPaths: Set<string>;
	private _hasSchemaDefinedPaths = false; // True if validator provides comprehensive paths
	private _isInternalUpdate = false;
	private _validationTimeoutId?: ReturnType<typeof setTimeout>;
	private _proxyCache = new WeakMap<object, object>();
	private _methodCache = new WeakMap<object, Map<string, (...args: unknown[]) => unknown>>();
	private _pendingArrayValidation = new Set<string>();

	// Static constants - no reactivity needed
	private static readonly _MUTATING_ARRAY_METHODS = new Set(MUTATING_ARRAY_METHODS);
	private static readonly _MAX_CACHE_SIZE = 1000;

	constructor(
		private validator: Validator<T>,
		private initialData: Partial<T> = {}
	) {
		this._data = this.safePopulate(this.initialData);
		const paths = this.validator.getPaths?.() ?? [];
		paths.forEach((path) => this.compilePath(path));
		this._validPaths = new Set(paths);
		// Validators with schema (Zod/Valibot) provide nested paths (contain dots)
		// Custom validators only provide top-level keys
		this._hasSchemaDefinedPaths = paths.some((p) => p.includes('.'));

		$effect(() => {
			// Track reactive dependencies
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this._data && this.touched;
			clearTimeout(this._validationTimeoutId);
			this._validationTimeoutId = setTimeout(() => this.validateSchema(), 100);
		});

		this.data = this.createReactive(this._data);
	}

	// Unified reactive proxy creation for both objects and arrays
	private createReactive = <V>(value: V, parentPath = ''): V => {
		if (!value || typeof value !== 'object') {
			return value;
		}
		if (this._proxyCache.has(value as object)) {
			return this._proxyCache.get(value as object) as V;
		}

		const pathPrefix = parentPath ? `${parentPath}.` : '';
		const isArray = Array.isArray(value);

		const proxy = new Proxy(value as object, {
			get: (target, prop) => {
				if (typeof prop === 'symbol') {
					return target[prop as keyof typeof target];
				}

				const propValue = target[prop as keyof typeof target];
				const propStr = prop as string;

				// Handle array element or nested object
				if (!isArray || isDigit(propStr)) {
					if (propValue && typeof propValue === 'object') {
						return this.createReactive(propValue, pathPrefix + propStr);
					}
				}

				// Handle array mutating methods
				if (
					isArray &&
					typeof propValue === 'function' &&
					RuneForm._MUTATING_ARRAY_METHODS.has(propStr)
				) {
					return this.wrapArrayMethod(
						target as unknown[],
						propStr,
						propValue as (...args: unknown[]) => unknown,
						parentPath
					);
				}

				return propValue;
			},
			set: (target, prop, newValue) => {
				if (typeof prop === 'symbol' || (isArray && prop === 'length')) return true;

				const propStr = prop as string;
				const oldValue = (target as Record<string, unknown>)[propStr];
				(target as Record<string, unknown>)[propStr] = newValue;

				if (!this._isInternalUpdate && oldValue !== newValue) {
					this.markTouched((pathPrefix + propStr) as Paths<T>);
					this.validateSchema();
				}
				return true;
			}
		});

		this._proxyCache.set(value as object, proxy);
		return proxy as V;
	};

	private wrapArrayMethod(
		arr: unknown[],
		methodName: string,
		method: (...args: unknown[]) => unknown,
		parentPath: string
	) {
		let methodCache = this._methodCache.get(arr);
		if (!methodCache) {
			methodCache = new Map();
			this._methodCache.set(arr, methodCache);
		}

		let wrapped = methodCache.get(methodName);
		if (!wrapped) {
			wrapped = (...args: unknown[]) => {
				const prevLength = arr.length;
				const result = method.apply(arr, args);

				if (!this._isInternalUpdate) {
					this.markTouched(parentPath as Paths<T>);
					this.queueValidation(parentPath);

					const touchedResult = handleArrayMethodTouchedState(methodName, args, arr, prevLength);
					if (touchedResult.deleteCount > 0) {
						syncTouchedStateForArrayRemoval(
							this.touched,
							parentPath,
							touchedResult.start,
							touchedResult.deleteCount
						);
					}
					if (touchedResult.insertCount > 0) {
						syncTouchedStateForArrayInsertion(
							this.touched,
							parentPath,
							touchedResult.start,
							touchedResult.insertCount
						);
					}
					if (
						touchedResult.lastIndexBeforePop !== undefined &&
						touchedResult.lastIndexBeforePop >= 0
					) {
						syncTouchedStateForArrayRemoval(
							this.touched,
							parentPath,
							touchedResult.lastIndexBeforePop,
							1
						);
					}

					// Ensure array elements remain reactive after mutation
					for (let i = 0; i < arr.length; i++) {
						const element = arr[i];
						if (element && typeof element === 'object') {
							arr[i] = this.createReactive(element, `${parentPath}.${i}`);
						}
					}
				}
				return result;
			};
			methodCache.set(methodName, wrapped);
		}
		return wrapped;
	}

	private queueValidation(path: string) {
		if (this._pendingArrayValidation.has(path)) return;
		this._pendingArrayValidation.add(path);
		queueMicrotask(() => {
			this._pendingArrayValidation.delete(path);
			if (!this._isInternalUpdate) this.validateSchema();
		});
	}

	get data(): T {
		return this._data;
	}
	set data(value: T) {
		this._isInternalUpdate = true;
		this._data = value;
		this._isInternalUpdate = false;
	}

	getField<K extends Paths<T>>(path: K): Field<T, K> {
		const pathStr = path as string;

		// Return cached field if exists
		const cached = this._fieldCache.get(pathStr);
		if (cached) return cached as Field<T, K>;

		const compiled = this.compilePath(pathStr);

		// Only check path validity for schema-based validators
		// Custom validators allow all paths
		const hasConstraints =
			!this._hasSchemaDefinedPaths || this._validPaths.has(compiled.normalizedPath);
		const constraints = hasConstraints ? (this.validator.getInputAttributes?.(pathStr) ?? {}) : {};

		const field = new Field<T, K>(this, path, compiled, constraints);

		// Cache the field instance
		if (this._fieldCache.size >= RuneForm._MAX_CACHE_SIZE) {
			evictOldestFromMap(this._fieldCache);
		}
		this._fieldCache.set(pathStr, field as Field<T, Paths<T>>);

		return field;
	}

	// Direct accessors for reactive reads in templates (alternative to getField)
	getError<K extends Paths<T>>(path: K): string | undefined {
		const pathStr = path as string;
		return this.errors[pathStr]?.[0] ?? this.customErrors[pathStr]?.[0];
	}

	getErrors<K extends Paths<T>>(path: K): string[] {
		const pathStr = path as string;
		return [...(this.errors[pathStr] ?? []), ...(this.customErrors[pathStr] ?? [])];
	}

	isTouched<K extends Paths<T>>(path: K): boolean {
		return this.touched[path as string] ?? false;
	}

	getValue<K extends Paths<T>>(path: K): PathValue<T, K> {
		const compiled = this.compilePath(path as string);
		return compiled.get(this._data) as PathValue<T, K>;
	}

	setValue<K extends Paths<T>>(path: K, value: PathValue<T, K>) {
		const compiled = this.compilePath(path as string);
		compiled.set(this._data, value);
		this.markTouched(path);
		this.validateSchema();
	}

	private compilePath(path: string): CompiledPath<T> {
		const cached = this._pathCache.get(path);
		if (cached) return cached;

		if (this._pathCache.size >= RuneForm._MAX_CACHE_SIZE) {
			evictOldestFromMap(this._pathCache);
		}

		const keys = parsePath(path);
		const isArrayIndex = keys.map((seg) => typeof seg === 'number');
		// Pre-compute normalized path for faster lookups
		const normalizedPath = keys.map((seg) => (typeof seg === 'number' ? '0' : seg)).join('.');

		const compiled: CompiledPath<T> = {
			keys,
			isArrayIndex,
			normalizedPath,
			get: (obj: T) => {
				let current: unknown = obj;
				for (const key of keys) {
					if (current == null || typeof current !== 'object') return undefined;
					current = (current as Record<string | number, unknown>)[key];
				}
				return current;
			},
			set: (obj: T, value: unknown) => {
				// Only enforce path validation for schema-based validators (Zod/Valibot)
				// Custom validators don't provide nested paths, so allow all paths
				if (this._hasSchemaDefinedPaths && !this._validPaths.has(normalizedPath)) return;

				let current: unknown = obj;
				for (let i = 0; i < keys.length - 1; i++) {
					const key = keys[i];
					if (
						typeof current !== 'object' ||
						current === null ||
						!(key in current) ||
						typeof (current as Record<string | number, unknown>)[key] !== 'object'
					) {
						(current as Record<string | number, unknown>)[key] = isArrayIndex[i + 1] ? [] : {};
					}
					current = (current as Record<string | number, unknown>)[key];
				}
				if (typeof current === 'object' && current !== null) {
					(current as Record<string | number, unknown>)[keys[keys.length - 1]] = value;
				}
			}
		};

		this._pathCache.set(path, compiled);
		return compiled;
	}

	private safePopulate(data: Partial<T>): T {
		if (this.validator.resolveDefaults) return this.validator.resolveDefaults(data);
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
			// Always create new object reference for reactivity
			this.errors = result.success ? {} : { ...result.errors };
			this.isValid = result.success;
		} catch {
			this.isValid = false;
		} finally {
			this.isValidating = false;
		}
	}

	markTouched(path: Paths<T>) {
		this.touched = { ...this.touched, [path as string]: true };
	}
	markFieldAsPristine(path: Paths<T>) {
		this.touched = { ...this.touched, [path as string]: false };
	}
	markAllTouched() {
		const newTouched = { ...this.touched };
		for (const path in this.errors) {
			newTouched[path] = true;
		}
		this.touched = newTouched;
	}
	markAllAsPristine() {
		this.touched = {};
	}

	private executeArrayOp<K extends ArrayPaths<T>>(path: K, op: (arr: unknown[]) => void) {
		const compiled = this.compilePath(path as string);
		const arr = compiled.get(this._data);
		if (Array.isArray(arr)) {
			op(arr);
			this.markTouched(path);
			clearStalePathCacheEntries(this._pathCache, path as string);
		}
	}

	push<K extends ArrayPaths<T>>(path: K, value: PathValue<T, `${K}.${number}`>) {
		this.executeArrayOp(path, (arr) => arr.push(value));
	}

	swap<K extends ArrayPaths<T>>(path: K, i: number, j: number) {
		this.executeArrayOp(path, (arr) => {
			[arr[i], arr[j]] = [arr[j], arr[i]];
			syncTouchedStateForArraySwap(this.touched, path as string, i, j);
		});
	}

	splice<K extends ArrayPaths<T>>(
		path: K,
		start: number,
		deleteCount?: number,
		...items: PathValue<T, `${K}.${number}`>[]
	) {
		this.executeArrayOp(path, (arr) => {
			if (deleteCount !== undefined) {
				arr.splice(start, deleteCount, ...items);
			} else {
				arr.splice(start);
			}
		});
	}

	setCustomError(path: Paths<T> | (string & {}), message: string) {
		// Create new object to ensure reactivity for new property additions
		this.customErrors = { ...this.customErrors, [path as string]: [message] };
	}

	setCustomErrors(path: Paths<T> | (string & {}), messages: string[]) {
		// Create new object to ensure reactivity for new property additions
		this.customErrors = { ...this.customErrors, [path as string]: messages };
	}

	clearCustomError(path: Paths<T> | (string & {})) {
		const { [path as string]: _, ...rest } = this.customErrors;
		this.customErrors = rest;
	}

	clearAllCustomErrors() {
		this.customErrors = {};
	}

	private clearAll() {
		clearTimeout(this._validationTimeoutId);
		this._validationTimeoutId = undefined;
		this.errors = {};
		this.customErrors = {};
		this.touched = {};
		this.isValid = false;
		this.isValidating = false;
		this._proxyCache = new WeakMap();
		this._methodCache = new WeakMap();
		this._pendingArrayValidation.clear();
		this._pathCache.clear();
		this._fieldCache.clear();
	}

	reset() {
		this._isInternalUpdate = true;
		this._data = this.safePopulate(this.initialData);
		this._isInternalUpdate = false;
		this.clearAll();
		this.data = this.createReactive(this._data);
	}

	dispose() {
		this.clearAll();
		this._data = {} as T;
		this._isInternalUpdate = false;
		this._validPaths.clear();
	}

	[Symbol.dispose]() {
		this.dispose();
	}
}
