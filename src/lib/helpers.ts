// Generic helper utilities shared across the library

export function escapeRegex(source: string): string {
	return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Minimal interface to support both Map and SvelteMap
export interface EvictableMap<K> {
	keys(): IterableIterator<K>;
	delete(key: K): boolean;
}

export function evictOldestFromMap<K>(map: EvictableMap<K>): void {
	const firstKey = map.keys().next().value as K | undefined;
	if (firstKey !== undefined) {
		map.delete(firstKey);
	}
}

// Array utility functions
export function isArrayIndex(str: string): boolean {
	return /^\d+$/.test(str);
}

export function parsePath(path: string): (string | number)[] {
	return path
		.split('.')
		.map((segment) => (isArrayIndex(segment) ? parseInt(segment, 10) : segment));
}

export function shiftArrayIndices(
	touchedKeys: string[],
	arrayPath: string,
	startIndex: number,
	shiftAmount: number
): string[] {
	return touchedKeys
		.map((key) => {
			if (!key.startsWith(arrayPath + '.')) return key;

			const parts = key.split('.');
			const indexPart = parts[1];

			if (!isArrayIndex(indexPart)) return key;

			const index = parseInt(indexPart, 10);
			// For removal operations, we need to shift all indices > startIndex
			// For insertion operations, we shift all indices >= startIndex
			if (shiftAmount < 0 && index > startIndex) {
				const newIndex = index + shiftAmount;
				if (newIndex >= 0) {
					parts[1] = newIndex.toString();
					return parts.join('.');
				}
			} else if (shiftAmount > 0 && index >= startIndex) {
				const newIndex = index + shiftAmount;
				parts[1] = newIndex.toString();
				return parts.join('.');
			}
			return key;
		})
		.filter((key) => key !== arrayPath + '.'); // Remove the array path itself
}

export function getTouchedKeysForArray(
	touched: Record<string, boolean>,
	arrayPath: string
): string[] {
	return Object.keys(touched).filter((key) => key.startsWith(arrayPath + '.') && key !== arrayPath);
}

// Array touched state management utilities
export function syncTouchedStateForArraySwap(
	touched: Record<string, boolean>,
	arrayPath: string,
	i: number,
	j: number
): void {
	// Get all touched keys for the array
	const touchedKeys = Object.keys(touched).filter(
		(key) => key.startsWith(`${arrayPath}.${i}.`) || key.startsWith(`${arrayPath}.${j}.`)
	);

	// Create a temporary map to store the touched states
	const tempTouched = new Map<string, boolean>();

	// Store current touched states
	for (const key of touchedKeys) {
		tempTouched.set(key, touched[key]);
	}

	// First, delete all existing keys to avoid conflicts
	for (const key of touchedKeys) {
		delete touched[key];
	}

	// Then create the new swapped keys
	for (const key of touchedKeys) {
		if (key.startsWith(`${arrayPath}.${i}.`)) {
			const newKey = key.replace(`${arrayPath}.${i}.`, `${arrayPath}.${j}.`);
			touched[newKey] = tempTouched.get(key) ?? false;
		} else if (key.startsWith(`${arrayPath}.${j}.`)) {
			const newKey = key.replace(`${arrayPath}.${j}.`, `${arrayPath}.${i}.`);
			touched[newKey] = tempTouched.get(key) ?? false;
		}
	}
}

export function syncTouchedStateForArrayRemoval(
	touched: Record<string, boolean>,
	arrayPath: string,
	startIndex: number,
	deleteCount: number
): void {
	// Get all touched keys for the array (including primitive element keys like arrayPath.0)
	const touchedKeys = getTouchedKeysForArray(touched, arrayPath);

	const escapedArrayPath = escapeRegex(arrayPath);

	// Remove touched state for deleted items
	for (let i = 0; i < deleteCount; i++) {
		const indexToRemove = startIndex + i;
		const removePattern = new RegExp(`^${escapedArrayPath}\\.${indexToRemove}(?:\\.|$)`);
		const keysToRemove = touchedKeys.filter((key) => removePattern.test(key));

		for (const key of keysToRemove) {
			delete touched[key];
		}
	}

	// Shift remaining indices down
	shiftArrayIndicesInTouchedState(touched, touchedKeys, arrayPath, startIndex, -deleteCount);
}

export function syncTouchedStateForArrayInsertion(
	touched: Record<string, boolean>,
	arrayPath: string,
	startIndex: number,
	insertCount: number
): void {
	// Get all touched keys for the array
	const touchedKeys = getTouchedKeysForArray(touched, arrayPath);

	// Shift existing indices up to make room for new items
	shiftArrayIndicesInTouchedState(touched, touchedKeys, arrayPath, startIndex, insertCount);
}

// Helper function to shift array indices in touched state
export function shiftArrayIndicesInTouchedState(
	touched: Record<string, boolean>,
	touchedKeys: string[],
	arrayPath: string,
	startIndex: number,
	shiftAmount: number
): void {
	const escapedArrayPath = escapeRegex(arrayPath);
	// Match indices either followed by a dot or end of string
	const indexPattern = new RegExp(`^${escapedArrayPath}\\.(\\d+)(?:\\.|$)`);
	const fullPattern = new RegExp(`^${escapedArrayPath}\\.(\\d+)(?:\\.(.*))?$`);

	// Filter keys that need to be shifted
	const keysToShift = touchedKeys.filter((key) => {
		const match = key.match(indexPattern);
		if (!match) return false;
		const index = parseInt(match[1], 10);
		return index >= startIndex;
	});

	// Sort by index in descending order to avoid conflicts (for insertion)
	if (shiftAmount > 0) {
		keysToShift.sort((a, b) => {
			const matchA = a.match(indexPattern);
			const matchB = b.match(indexPattern);
			if (!matchA || !matchB) return 0;
			return parseInt(matchB[1], 10) - parseInt(matchA[1], 10);
		});
	} else {
		// Sort by index in ascending order for removal
		keysToShift.sort((a, b) => {
			const matchA = a.match(indexPattern);
			const matchB = b.match(indexPattern);
			if (!matchA || !matchB) return 0;
			return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
		});
	}

	// Process each key that needs to be shifted
	for (const key of keysToShift) {
		const match = key.match(fullPattern);
		if (!match) continue;

		const currentIndex = parseInt(match[1], 10);
		const newIndex = currentIndex + shiftAmount;
		const restOfPath = match[2] || '';

		// Skip if the new index would be negative
		if (newIndex < 0) continue;

		// Construct the new key
		const newKey = restOfPath
			? `${arrayPath}.${newIndex}.${restOfPath}`
			: `${arrayPath}.${newIndex}`;

		// Move the touched state to the new key
		if (touched[key] !== undefined) {
			touched[newKey] = touched[key];
			delete touched[key];
		}
	}
}

// Cache cleanup utilities
export function clearStaleFieldCacheEntries<K>(
	fieldCache: Map<string, K>,
	arrayPath: string
): void {
	const keysToRemove: string[] = [];

	// Find all field cache entries that start with the array path
	for (const key of fieldCache.keys()) {
		if (key.startsWith(arrayPath)) {
			keysToRemove.push(key);
		}
	}

	// Remove the stale entries
	for (const key of keysToRemove) {
		fieldCache.delete(key);
	}
}

// Path compilation utilities
export interface CompiledPath {
	keys: (string | number)[];
	isArrayIndex: boolean[];
	get: (obj: Record<string, unknown>) => unknown;
	set: (obj: Record<string, unknown>, value: unknown) => void;
}

export function compilePath(path: string): CompiledPath {
	const parsed = parsePath(path);
	const keys = parsed;
	const isArrayIndex = parsed.map((segment) => typeof segment === 'number');

	const get = (obj: Record<string, unknown>): unknown => {
		let current: unknown = obj;
		for (let i = 0; i < keys.length; i++) {
			if (current == null || typeof current !== 'object') return undefined;
			current = (current as Record<string, unknown>)[keys[i] as string | number];
		}
		return current;
	};

	const set = (obj: Record<string, unknown>, value: unknown): void => {
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

	return { keys, isArrayIndex, get, set };
}

// Array method handling utilities
export interface ArrayMethodHandler {
	handleSplice: (
		args: [number, number?, ...unknown[]],
		target: unknown[]
	) => {
		start: number;
		deleteCount: number;
		insertCount: number;
	};
	handlePop: (currentLength: number, previousLength?: number) => number | undefined;
	handleShift: () => void;
	handleUnshift: (args: unknown[]) => number;
}

export const arrayMethodHandler: ArrayMethodHandler = {
	handleSplice(args, target) {
		const [start, deleteCount = 0, ...insertItems] = args;
		const actualDeleteCount = deleteCount ?? target.length - start;
		const insertCount = insertItems.length;
		return { start, deleteCount: actualDeleteCount, insertCount };
	},
	handlePop(currentLength, previousLength) {
		const lastIndexBeforePop = (previousLength ?? currentLength + 1) - 1;
		return lastIndexBeforePop >= 0 ? lastIndexBeforePop : undefined;
	},
	handleShift() {
		// No additional logic needed for shift
	},
	handleUnshift(args) {
		return args.length;
	}
};

// Zod utility functions
export function flattenZodIssues(issues: unknown[]): Record<string, string[]> {
	const flattened: Record<string, string[]> = {};

	for (const issue of issues) {
		if (issue && typeof issue === 'object' && 'path' in issue && 'message' in issue) {
			const path = (issue as { path: unknown[] }).path;
			const message = (issue as { message: string }).message;

			if (Array.isArray(path)) {
				const key = path.map((p) => String(p)).join('.');
				if (!flattened[key]) flattened[key] = [];
				flattened[key].push(message);
			}
		}
	}

	return flattened;
}

export function getFieldDescription(schema: unknown): string | undefined {
	if (schema && typeof schema === 'object' && 'description' in schema) {
		return (schema as { description: string }).description;
	}
	return undefined;
}

// Array method utilities
export const MUTATING_ARRAY_METHODS = new Set([
	'splice',
	'push',
	'pop',
	'shift',
	'unshift',
	'reverse',
	'sort',
	'fill'
]);

export function isMutatingArrayMethod(methodName: string): boolean {
	return MUTATING_ARRAY_METHODS.has(methodName);
}

// Path validation utilities
export function isValidPath(path: string): boolean {
	return path.length > 0 && !path.startsWith('.') && !path.endsWith('.');
}

export function normalizeArrayPath(path: string): string {
	// Convert array[0] syntax to array.0 syntax
	return path.replace(/\[(\d+)\]/g, '.$1');
}

// Array method touched state handling utilities
export function handleArrayMethodTouchedState(
	methodName: string,
	args: unknown[],
	target: unknown[],
	previousLength?: number
): {
	start: number;
	deleteCount: number;
	insertCount: number;
	lastIndexBeforePop?: number;
} {
	switch (methodName) {
		case 'splice': {
			const [start, deleteCount = 0, ...insertItems] = args as [number, number?, ...unknown[]];
			const actualDeleteCount = deleteCount ?? target.length - start;
			const insertCount = insertItems.length;
			return { start, deleteCount: actualDeleteCount, insertCount };
		}
		case 'pop': {
			const lastIndexBeforePop = (previousLength ?? target.length + 1) - 1;
			return { start: 0, deleteCount: 0, insertCount: 0, lastIndexBeforePop };
		}
		case 'shift': {
			return { start: 0, deleteCount: 1, insertCount: 0 };
		}
		case 'unshift': {
			const insertCount = args.length;
			return { start: 0, deleteCount: 0, insertCount };
		}
		default:
			return { start: 0, deleteCount: 0, insertCount: 0 };
	}
}

// Array element reactivity utilities
export function ensureArrayElementsReactive<T extends Record<string, unknown>>(
	array: unknown[],
	arrayPath: string,
	createReactiveData: (data: T, parentPath: string) => T,
	createReactiveArray: (array: unknown[], parentPath: string) => unknown[]
): void {
	// Check each array element and ensure it's reactive
	for (let i = 0; i < array.length; i++) {
		const element = array[i];
		if (element && typeof element === 'object' && !Array.isArray(element)) {
			const elementPath = `${arrayPath}.${i}`;
			// Always create a reactive proxy for the element to ensure reactivity
			const reactiveElement = createReactiveData(element as T, elementPath);
			// Replace the element in the array
			array[i] = reactiveElement;
		} else if (Array.isArray(element)) {
			const elementPath = `${arrayPath}.${i}`;
			// Always create a reactive array for the nested array to ensure reactivity
			const reactiveArray = createReactiveArray(element, elementPath);
			// Replace the element in the array
			array[i] = reactiveArray;
		}
	}
}

// Cache management utilities
export function clearStalePathCacheEntries<K>(pathCache: Map<string, K>, arrayPath: string): void {
	const keysToRemove: string[] = [];

	// Find all path cache entries that start with the array path
	// We need to clear:
	// 1. Individual array element paths (e.g., address.parkingLots.0, address.parkingLots.1)
	// 2. Field paths within array elements (e.g., address.parkingLots.0.name)
	// BUT preserve the array path itself (e.g., address.parkingLots)
	for (const key of pathCache.keys()) {
		if (key.startsWith(arrayPath + '.') && key !== arrayPath) {
			keysToRemove.push(key);
		}
	}

	// Remove the stale entries
	for (const key of keysToRemove) {
		pathCache.delete(key);
	}
}

// Validation utilities
export function debounceValidation(
	callback: () => void,
	delay: number,
	timeoutIdRef: { current: number | undefined }
): void {
	if (timeoutIdRef.current !== undefined) {
		clearTimeout(timeoutIdRef.current);
	}
	timeoutIdRef.current = setTimeout(() => {
		callback();
		timeoutIdRef.current = undefined;
	}, delay);
}
