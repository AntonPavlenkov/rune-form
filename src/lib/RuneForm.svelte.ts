import type { Paths, PathValue } from './types.js';

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
	getInputAttributes?: (path: string) => Record<string, any>;
}

export class RuneForm<T> {
	id = Math.random();
	data = $state<T>({} as T);
	errors = $state<Record<string, string[]>>({});
	customErrors = $state<Partial<Record<Paths<T> | string, string[]>>>({});
	touched = $state({} as Record<Paths<T>, boolean>);

	isValid = $state(false);
	isSubmitting = $state(false);
	isValidating = $state(false);

	private _compiledAccess = new Map<
		string,
		{ get: (obj: any) => any; set: (obj: any, value: any) => void }
	>();
	private _fieldCache = new Map<string, any>();

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

		$effect(() => {
			this.validateSchema();
		});
	}

	getField<K extends Paths<T>>(
		path: K
	): {
		value: PathValue<T, K>;
		error: string;
		errors: string[];
		touched: boolean;
		constraints: Record<string, any>;
	} {
		if (this._fieldCache.has(path)) return this._fieldCache.get(path)!;
		const self = this;

		const field = {
			get value() {
				return self.getPath(self.data, path);
			},
			set value(val) {
				self.setPath(self.data, path, val);
				self.markTouched(path);
			},
			get error() {
				return (self.errors[path] ?? [])[0] ?? (self.customErrors[path] ?? [])[0] ?? '';
			},
			set error(val) {
				self.customErrors[path] = [val];
			},
			get errors() {
				return [...(self.errors[path] ?? []), ...(self.customErrors[path] ?? [])];
			},
			set errors(vals) {
				self.customErrors[path] = vals;
			},
			get touched() {
				return self.touched[path] ?? false;
			},
			set touched(val) {
				self.touched[path] = val;
			},
			get constraints() {
				return self.validator.getInputAttributes?.(path) ?? {};
			}
		};
		this._fieldCache.set(path, field);
		return field;
	}

	private getPath<K extends string>(obj: T, path: K): PathValue<T, K> {
		return (this._compiledAccess.get(path) ?? this.compilePath(path)).get(obj);
	}

	private setPath<K extends string>(obj: T, path: K, value: PathValue<T, K>) {
		(this._compiledAccess.get(path) ?? this.compilePath(path)).set(obj, value);
	}

	private compilePath(path: string) {
		const keys = path.split('.');

		const get = (obj: any) =>
			keys.reduce((curr, key) => (curr && typeof curr === 'object' ? curr[key] : undefined), obj);

		const set = (obj: any, value: any) => {
			let current = obj;
			for (let i = 0; i < keys.length - 1; i++) {
				const k = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i];
				if (!(k in current) || typeof current[k] !== 'object') {
					const isNextIndex = /^\d+$/.test(keys[i + 1] ?? '');
					current[k] = isNextIndex ? [] : {};
				}
				current = current[k];
			}

			const lastKey = /^\d+$/.test(keys.at(-1)!) ? Number(keys.at(-1)!) : keys.at(-1)!;
			current[lastKey] = value;
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
		} catch (e) {
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
		this.customErrors[path] = [message];
	}

	setCustomErrors(path: Paths<T> | (string & {}), messages: string[]) {
		this.customErrors[path] = messages;
	}

	push<K extends ArrayPaths<T>>(path: K, value: PathValue<T, `${K}.${number}`>) {
		const arr = this.getPath(this.data, path);
		if (Array.isArray(arr)) {
			arr.push(value);
			this.markTouched(path);
		}
	}

	insert<K extends ArrayPaths<T>>(path: K, index: number, value: PathValue<T, `${K}.${number}`>) {
		const arr = this.getPath(this.data, path);
		if (Array.isArray(arr)) {
			arr.splice(index, 0, value);
			this.markTouched(path);
		}
	}

	remove<K extends ArrayPaths<T>>(path: K, index: number) {
		const arr = this.getPath(this.data, path);
		if (Array.isArray(arr)) {
			arr.splice(index, 1);
			this.markTouched(path);
		}
	}

	swap<K extends ArrayPaths<T>>(path: K, i: number, j: number) {
		const arr = this.getPath(this.data, path);
		if (Array.isArray(arr)) {
			[arr[i], arr[j]] = [arr[j], arr[i]];
			this.markTouched(path);
		}
	}

	replace<K extends ArrayPaths<T>>(path: K, value: PathValue<T, K>) {
		this.setPath(this.data, path, value);
		this.markTouched(path);
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
}

type ArrayPaths<T> = {
	[K in Paths<T>]: PathValue<T, K> extends Array<any> ? K : never;
}[Paths<T>];
