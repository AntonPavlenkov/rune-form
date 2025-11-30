import type { z, ZodObject, ZodTypeAny } from 'zod';
import type { ArrayPaths, CustomValidator, Paths, PathValue } from './types.js';
export interface Validator<T> {
    parse(data: unknown): T;
    safeParse(data: unknown): {
        success: true;
        data: T;
    } | {
        success: false;
        errors: Record<string, string[]>;
    };
    safeParseAsync?(data: unknown): Promise<{
        success: true;
        data: T;
    } | {
        success: false;
        errors: Record<string, string[]>;
    }>;
    resolveDefaults?(data: Partial<T>): T;
    getPaths?: () => string[];
    getInputAttributes?: (path: string) => Record<string, unknown>;
}
export declare class RuneForm<T extends Record<string, unknown>> {
    private validator;
    private initialData;
    private _data;
    errors: Record<string, string[]>;
    customErrors: Partial<Record<string, string[]>>;
    touched: Record<string, boolean>;
    isValid: boolean;
    isValidating: boolean;
    private _pathCache;
    private _fieldCache;
    private _validPaths;
    private _isInternalUpdate;
    private _validationTimeoutId?;
    private _proxyCache;
    private _methodCache;
    private _pendingArrayValidation;
    private static readonly _MUTATING_ARRAY_METHODS;
    private static readonly _MAX_CACHE_SIZE;
    constructor(validator: Validator<T>, initialData?: Partial<T>);
    private createReactive;
    private wrapArrayMethod;
    private queueValidation;
    get data(): T;
    set data(value: T);
    static fromSchema<S extends ZodObject<Record<string, ZodTypeAny>>>(schema: S, initialData?: Partial<z.infer<S>>): RuneForm<z.core.output<S>>;
    static fromCustom<T extends Record<string, unknown>>(validator: CustomValidator<T>, initialData?: Partial<T>): RuneForm<T>;
    getField<K extends Paths<T>>(path: K): {
        value: PathValue<T, K>;
        error: string;
        errors: string[];
        touched: boolean;
        constraints: Record<string, unknown>;
        readonly isValidating: boolean;
    };
    private createField;
    private compilePath;
    private safePopulate;
    validateSchema(): Promise<void>;
    markTouched(path: Paths<T>): void;
    markFieldAsPristine(path: Paths<T>): void;
    markAllTouched(): void;
    markAllAsPristine(): void;
    private executeArrayOp;
    push<K extends ArrayPaths<T>>(path: K, value: PathValue<T, `${K}.${number}`>): void;
    swap<K extends ArrayPaths<T>>(path: K, i: number, j: number): void;
    splice<K extends ArrayPaths<T>>(path: K, start: number, deleteCount?: number, ...items: PathValue<T, `${K}.${number}`>[]): void;
    setCustomError(path: Paths<T> | (string & {}), message: string): void;
    setCustomErrors(path: Paths<T> | (string & {}), messages: string[]): void;
    private clearAll;
    reset(): void;
    dispose(): void;
    [Symbol.dispose](): void;
}
