import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { createCustomValidator } from './customAdapter.js';
import { clearStaleFieldCacheEntries, clearStalePathCacheEntries, evictOldestFromMap, handleArrayMethodTouchedState, MUTATING_ARRAY_METHODS, parsePath, syncTouchedStateForArrayInsertion, syncTouchedStateForArrayRemoval, syncTouchedStateForArraySwap } from './helpers.js';
import { createZodValidator } from './zodAdapter.js';
export class RuneForm {
    validator;
    initialData;
    _data = $state({});
    errors = $state({});
    customErrors = $state({});
    touched = $state({});
    isValid = $state(false);
    isValidating = $state(false);
    _pathCache = new SvelteMap();
    _fieldCache = new SvelteMap();
    _validPaths;
    _isInternalUpdate = false;
    _validationTimeoutId;
    _proxyCache = new WeakMap();
    _methodCache = new WeakMap();
    _pendingArrayValidation = new SvelteSet();
    static _MUTATING_ARRAY_METHODS = new SvelteSet(MUTATING_ARRAY_METHODS);
    static _MAX_CACHE_SIZE = { path: 1000, field: 500 };
    constructor(validator, initialData = {}) {
        this.validator = validator;
        this.initialData = initialData;
        this._data = this.safePopulate(this.initialData);
        const paths = this.validator.getPaths?.() ?? [];
        paths.forEach((path) => this.compilePath(path));
        this._validPaths = new SvelteSet(paths);
        $effect(() => {
            $effect.tracking();
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            this._data && this.touched;
            clearTimeout(this._validationTimeoutId);
            this._validationTimeoutId = setTimeout(() => this.validateSchema(), 100);
        });
        this.data = this.createReactive(this._data);
    }
    // Unified reactive proxy creation for both objects and arrays
    createReactive = (value, parentPath = '') => {
        if (!value || typeof value !== 'object') {
            return value;
        }
        if (this._proxyCache.has(value)) {
            return this._proxyCache.get(value);
        }
        const pathPrefix = parentPath ? `${parentPath}.` : '';
        const isArray = Array.isArray(value);
        const proxy = new Proxy(value, {
            get: (target, prop) => {
                const propValue = target[prop];
                const currentPath = pathPrefix + String(prop);
                // Handle array element or nested object
                if (typeof prop === 'string' && (!isArray || /^\d+$/.test(prop))) {
                    if (propValue && typeof propValue === 'object') {
                        return this.createReactive(propValue, currentPath);
                    }
                }
                // Handle array mutating methods
                if (isArray &&
                    typeof prop === 'string' &&
                    typeof propValue === 'function' &&
                    RuneForm._MUTATING_ARRAY_METHODS.has(prop)) {
                    return this.wrapArrayMethod(target, prop, propValue, parentPath);
                }
                return propValue;
            },
            set: (target, prop, newValue) => {
                if (typeof prop === 'symbol' || (isArray && prop === 'length'))
                    return true;
                const oldValue = target[prop];
                const currentPath = pathPrefix + String(prop);
                target[prop] = newValue;
                if (!this._isInternalUpdate && oldValue !== newValue) {
                    this.markTouched(currentPath);
                    this.validateSchema();
                }
                return true;
            }
        });
        this._proxyCache.set(value, proxy);
        return proxy;
    };
    wrapArrayMethod(arr, methodName, method, parentPath) {
        let methodCache = this._methodCache.get(arr);
        if (!methodCache) {
            methodCache = new SvelteMap();
            this._methodCache.set(arr, methodCache);
        }
        let wrapped = methodCache.get(methodName);
        if (!wrapped) {
            wrapped = (...args) => {
                const prevLength = arr.length;
                const result = method.apply(arr, args);
                if (!this._isInternalUpdate) {
                    this.markTouched(parentPath);
                    this.queueValidation(parentPath);
                    const touchedResult = handleArrayMethodTouchedState(methodName, args, arr, prevLength);
                    if (touchedResult.deleteCount > 0) {
                        syncTouchedStateForArrayRemoval(this.touched, parentPath, touchedResult.start, touchedResult.deleteCount);
                    }
                    if (touchedResult.insertCount > 0) {
                        syncTouchedStateForArrayInsertion(this.touched, parentPath, touchedResult.start, touchedResult.insertCount);
                    }
                    if (touchedResult.lastIndexBeforePop !== undefined &&
                        touchedResult.lastIndexBeforePop >= 0) {
                        syncTouchedStateForArrayRemoval(this.touched, parentPath, touchedResult.lastIndexBeforePop, 1);
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
    queueValidation(path) {
        if (this._pendingArrayValidation.has(path))
            return;
        this._pendingArrayValidation.add(path);
        queueMicrotask(() => {
            this._pendingArrayValidation.delete(path);
            if (!this._isInternalUpdate)
                this.validateSchema();
        });
    }
    get data() {
        return this._data;
    }
    set data(value) {
        this._isInternalUpdate = true;
        this._data = value;
        this._isInternalUpdate = false;
    }
    static fromSchema(schema, initialData) {
        return new RuneForm(createZodValidator(schema), initialData);
    }
    static fromCustom(validator, initialData) {
        return new RuneForm(createCustomValidator(validator), initialData);
    }
    getField(path) {
        const cached = this._fieldCache.get(path);
        if (cached)
            return cached;
        const normalizedPath = path
            .split('.')
            .map((seg) => (/^\d+$/.test(seg) ? '0' : seg))
            .join('.');
        const compiled = this.compilePath(path);
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
    createField(path, compiled, getConstraints = true) {
        const pathStr = path;
        const constraints = getConstraints ? (this.validator.getInputAttributes?.(pathStr) ?? {}) : {};
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        return {
            get value() {
                return compiled.get(self._data);
            },
            set value(val) {
                compiled.set(self._data, val);
                if (!self._isInternalUpdate) {
                    self.markTouched(path);
                    self.validateSchema();
                }
            },
            get error() {
                return self.errors[pathStr]?.[0] ?? self.customErrors[pathStr]?.[0];
            },
            set error(val) {
                self.customErrors[pathStr] = [val];
            },
            get errors() {
                return [...(self.errors[pathStr] ?? []), ...(self.customErrors[pathStr] ?? [])];
            },
            set errors(vals) {
                self.customErrors[pathStr] = vals;
            },
            get touched() {
                return self.touched[pathStr] ?? false;
            },
            set touched(val) {
                self.touched[pathStr] = val;
            },
            constraints,
            get isValidating() {
                return self.isValidating;
            }
        };
    }
    compilePath(path) {
        let compiled = this._pathCache.get(path);
        if (compiled)
            return compiled;
        if (this._pathCache.size >= RuneForm._MAX_CACHE_SIZE.path) {
            evictOldestFromMap(this._pathCache);
        }
        const keys = parsePath(path);
        const isArrayIndex = keys.map((seg) => typeof seg === 'number');
        compiled = {
            keys,
            isArrayIndex,
            get: (obj) => {
                let current = obj;
                for (const key of keys) {
                    if (current == null || typeof current !== 'object')
                        return undefined;
                    current = current[key];
                }
                return current;
            },
            set: (obj, value) => {
                // Don't create paths for non-existent fields
                const normalizedPath = path
                    .split('.')
                    .map((seg) => (/^\d+$/.test(seg) ? '0' : seg))
                    .join('.');
                if (!this._validPaths.has(normalizedPath))
                    return;
                let current = obj;
                for (let i = 0; i < keys.length - 1; i++) {
                    const key = keys[i];
                    if (typeof current !== 'object' ||
                        current === null ||
                        !(key in current) ||
                        typeof current[key] !== 'object') {
                        current[key] = isArrayIndex[i + 1] ? [] : {};
                    }
                    current = current[key];
                }
                if (typeof current === 'object' && current !== null) {
                    current[keys[keys.length - 1]] = value;
                }
            }
        };
        this._pathCache.set(path, compiled);
        return compiled;
    }
    safePopulate(data) {
        if (this.validator.resolveDefaults)
            return this.validator.resolveDefaults(data);
        try {
            return this.validator.parse(data);
        }
        catch {
            return data;
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
        }
        catch {
            this.isValid = false;
        }
        finally {
            this.isValidating = false;
        }
    }
    markTouched(path) {
        this.touched[path] = true;
    }
    markFieldAsPristine(path) {
        this.touched[path] = false;
    }
    markAllTouched() {
        Object.keys(this.errors).forEach((path) => (this.touched[path] = true));
    }
    markAllAsPristine() {
        this.touched = {};
    }
    executeArrayOp(path, op) {
        // Ensure the path is compiled
        const compiled = this.compilePath(path);
        const arr = compiled.get(this._data);
        if (Array.isArray(arr)) {
            op(arr);
            this.markTouched(path);
            clearStaleFieldCacheEntries(this._fieldCache, path);
            clearStalePathCacheEntries(this._pathCache, path);
        }
    }
    push(path, value) {
        this.executeArrayOp(path, (arr) => arr.push(value));
    }
    swap(path, i, j) {
        this.executeArrayOp(path, (arr) => {
            [arr[i], arr[j]] = [arr[j], arr[i]];
            syncTouchedStateForArraySwap(this.touched, path, i, j);
        });
    }
    splice(path, start, deleteCount, ...items) {
        this.executeArrayOp(path, (arr) => {
            if (deleteCount !== undefined) {
                arr.splice(start, deleteCount, ...items);
            }
            else {
                arr.splice(start);
            }
        });
    }
    setCustomError(path, message) {
        this.customErrors[path] = [message];
    }
    setCustomErrors(path, messages) {
        this.customErrors[path] = messages;
    }
    clearAll() {
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
        this._data = {};
        this._isInternalUpdate = false;
        this._validPaths.clear();
    }
    [Symbol.dispose]() {
        this.dispose();
    }
}
