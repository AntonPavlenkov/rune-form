import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { z, ZodObject, ZodTypeAny } from 'zod';
import { createCustomValidator } from './customAdapter.js';
import {
	clearStaleFieldCacheEntries,
	clearStalePathCacheEntries,
	evictOldestFromMap,
	handleArrayMethodTouchedState,
	MUTATING_ARRAY_METHODS,
	parsePath,
	syncTouchedStateForArrayInsertion,
	syncTouchedStateForArrayRemoval,
	syncTouchedStateForArraySwap
} from './helpers.js';
import type { ArrayPaths, CustomValidator, Paths, PathValue } from './types.js';
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
	private _validationTimeoutId?: number;
	private _proxyCache = new WeakMap<object, object>();
	private _methodCache = new WeakMap<object, SvelteMap<string, (...args: unknown[]) => unknown>>();
	private _pendingArrayValidation = new SvelteSet<string>();

	private static readonly _MUTATING_ARRAY_METHODS = new SvelteSet(MUTATING_ARRAY_METHODS);
	private static readonly _MAX_CACHE_SIZE = { path: 1000, field: 500 };

	constructor(
		private validator: Validator<T>,
		private initialData: Partial<T> = {}
	) {
		this._data = this.safePopulate(this.initialData);
		const paths = this.validator.getPaths?.() ?? [];
		paths.forEach((path) => this.compilePath(path));
		this._validPaths = new SvelteSet(paths);

		$effect(() => {
			$effect.tracking();
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this._data && this.touched;
			clearTimeout(this._validationTimeoutId);
			this._validationTimeoutId = setTimeout(() => this.validateSchema(), 100) as unknown as number;
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
				const propValue = target[prop as keyof typeof target];
				const currentPath = pathPrefix + String(prop);

				// Handle array element or nested object
				if (typeof prop === 'string' && (!isArray || /^\d+$/.test(prop))) {
					if (propValue && typeof propValue === 'object') {
						return this.createReactive(propValue, currentPath);
					}
				}

				// Handle array mutating methods
				if (
					isArray &&
					typeof prop === 'string' &&
					typeof propValue === 'function' &&
					RuneForm._MUTATING_ARRAY_METHODS.has(prop)
				) {
					return this.wrapArrayMethod(
						target as unknown[],
						prop,
						propValue as (...args: unknown[]) => unknown,
						parentPath
					);
				}

				return propValue;
			},
			set: (target, prop, newValue) => {
				if (typeof prop === 'symbol' || (isArray && prop === 'length')) return true;

				const oldValue = (target as Record<string, unknown>)[prop as string];
				const currentPath = pathPrefix + String(prop);
				(target as Record<string, unknown>)[prop as string] = newValue;

				if (!this._isInternalUpdate && oldValue !== newValue) {
					this.markTouched(currentPath as Paths<T>);
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
			methodCache = new SvelteMap();
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

					clearStaleFieldCacheEntries(this._fieldCache, parentPath);
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

	getField<K extends Paths<T>>(path: K) {
		const cached = this._fieldCache.get(path);
		if (cached) return cached as ReturnType<typeof this.createField<K>>;

		const normalizedPath = path
			.split('.')
			.map((seg) => (/^\d+$/.test(seg) ? '0' : seg))
			.join('.');
		const compiled = this.compilePath(path as string);

		// For non-existent paths, create field without constraints
		const field = !this._validPaths.has(normalizedPath)
			? this.createField(path, compiled, false)
			: this.createField(path, compiled, true);

		if (this._fieldCache.size >= RuneForm._MAX_CACHE_SIZE.field) {
			evictOldestFromMap(this._fieldCache);
		}
		this._fieldCache.set(path, field);
		return field;
	}

	private createField<K extends Paths<T>>(
		path: K,
		compiled: { get: (obj: T) => unknown; set: (obj: T, value: unknown) => void },
		getConstraints = true
	) {
		const pathStr = path as string;
		const constraints = getConstraints ? (this.validator.getInputAttributes?.(pathStr) ?? {}) : {};
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;

		return {
			get value() {
				return compiled.get(self._data) as PathValue<T, K>;
			},
			set value(val: PathValue<T, K>) {
				compiled.set(self._data, val);
				if (!self._isInternalUpdate) {
					self.markTouched(path);
					self.validateSchema();
				}
			},
			get error() {
				return self.errors[pathStr]?.[0] ?? self.customErrors[pathStr]?.[0];
			},
			set error(val: string) {
				self.customErrors[pathStr] = [val];
			},
			get errors() {
				return [...(self.errors[pathStr] ?? []), ...(self.customErrors[pathStr] ?? [])];
			},
			set errors(vals: string[]) {
				self.customErrors[pathStr] = vals;
			},
			get touched() {
				return self.touched[pathStr] ?? false;
			},
			set touched(val: boolean) {
				self.touched[pathStr] = val;
			},
			constraints,
			get isValidating() {
				return self.isValidating;
			}
		};
	}

	private compilePath(path: string) {
		let compiled = this._pathCache.get(path);
		if (compiled) return compiled;

		if (this._pathCache.size >= RuneForm._MAX_CACHE_SIZE.path) {
			evictOldestFromMap(this._pathCache);
		}

		const keys = parsePath(path);
		const isArrayIndex = keys.map((seg) => typeof seg === 'number');

		compiled = {
			keys,
			isArrayIndex,
			get: (obj: T) => {
				let current: unknown = obj;
				for (const key of keys) {
					if (current == null || typeof current !== 'object') return undefined;
					current = (current as Record<string | number, unknown>)[key];
				}
				return current;
			},
			set: (obj: T, value: unknown) => {
				// Don't create paths for non-existent fields
				const normalizedPath = path
					.split('.')
					.map((seg) => (/^\d+$/.test(seg) ? '0' : seg))
					.join('.');
				if (!this._validPaths.has(normalizedPath)) return;

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
			this.errors = result.success ? {} : result.errors;
			this.isValid = result.success;
		} catch {
			this.isValid = false;
		} finally {
			this.isValidating = false;
		}
	}

	markTouched(path: Paths<T>) {
		this.touched[path as string] = true;
	}
	markFieldAsPristine(path: Paths<T>) {
		this.touched[path as string] = false;
	}
	markAllTouched() {
		Object.keys(this.errors).forEach((path) => (this.touched[path] = true));
	}
	markAllAsPristine() {
		this.touched = {};
	}

	private executeArrayOp<K extends ArrayPaths<T>>(path: K, op: (arr: unknown[]) => void) {
		// Ensure the path is compiled
		const compiled = this.compilePath(path as string);
		const arr = compiled.get(this._data);
		if (Array.isArray(arr)) {
			op(arr);
			this.markTouched(path);
			clearStaleFieldCacheEntries(this._fieldCache, path as string);
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
		this.customErrors[path as string] = [message];
	}

	setCustomErrors(path: Paths<T> | (string & {}), messages: string[]) {
		this.customErrors[path as string] = messages;
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
		this._fieldCache.clear();
		this._pendingArrayValidation.clear();
		this._pathCache.clear();
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
