export declare function escapeRegex(source: string): string;
export interface EvictableMap<K> {
    keys(): IterableIterator<K>;
    delete(key: K): boolean;
}
export declare function evictOldestFromMap<K>(map: EvictableMap<K>): void;
export declare function parsePath(path: string): (string | number)[];
export declare function syncTouchedStateForArraySwap(touched: Record<string, boolean>, arrayPath: string, i: number, j: number): void;
export declare function syncTouchedStateForArrayRemoval(touched: Record<string, boolean>, arrayPath: string, startIndex: number, deleteCount: number): void;
export declare function syncTouchedStateForArrayInsertion(touched: Record<string, boolean>, arrayPath: string, startIndex: number, insertCount: number): void;
export declare function clearStaleFieldCacheEntries<K>(fieldCache: Map<string, K>, arrayPath: string): void;
export declare function clearStalePathCacheEntries<K>(pathCache: Map<string, K>, arrayPath: string): void;
export declare const MUTATING_ARRAY_METHODS: Set<string>;
export declare function handleArrayMethodTouchedState(methodName: string, args: unknown[], target: unknown[], previousLength?: number): {
    start: number;
    deleteCount: number;
    insertCount: number;
    lastIndexBeforePop?: number;
};
export declare function flattenZodIssues(issues: unknown[]): Record<string, string[]>;
