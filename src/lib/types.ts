import type { RuneForm } from './RuneForm.svelte.js';

export type Primitive = string | number | boolean | null | undefined;

type Join<K extends string | number, P extends string | number> = `${K}.${P}`;

type Prev = [never, 0, 1, 2, 3, 4, 5];

type PathArray<T> =
	T extends Array<infer U>
		? U extends Primitive
			? `${number}`
			: `${number}` | Join<number, Paths<U>>
		: never;

export type Paths<T, D extends number = 5> = [D] extends [never]
	? never
	: T extends Primitive
		? ''
		: {
				[K in Extract<keyof T, string>]: T[K] extends Array<unknown>
					? K | Join<K, PathArray<T[K]>>
					: T[K] extends object
						? K | Join<K, Paths<T[K], Prev[D]>>
						: K;
			}[Extract<keyof T, string>];

export type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
	? K extends keyof T
		? T[K] extends Array<infer U>
			? Rest extends `${string}.${infer R}`
				? PathValue<U, R>
				: U
			: T[K] extends object
				? PathValue<T[K], Rest>
				: never
		: never
	: P extends keyof T
		? T[P]
		: P extends `${number}`
			? T extends Array<infer U>
				? U
				: never
			: never;

export type ArrayPaths<T> = {
	[K in Paths<T>]: PathValue<T, K> extends Array<unknown> ? K : never;
}[Paths<T>];

export type RuneFormType<T extends Record<string, unknown>> = RuneForm<T>;
export type RuneFormField<T extends Record<string, unknown>> = Paths<T>;
export type RuneFormFieldValue<
	T extends Record<string, unknown>,
	K extends RuneFormField<T>
> = PathValue<T, K>;

// Custom validation function types
export type ValidationFunction<T> = (
	value: T,
	allData?: Record<string, unknown>
) => string[] | Promise<string[]>;
export type CustomValidator<T> = {
	[K in keyof T]?: ValidationFunction<T[K]>;
};
