/**
 * Save types that game logic needs (migrations live in logic/, which can only
 * import @arcade/core). The IndexedDB implementation is in @arcade/save.
 */

/** Upgrades save data from version N to N+1. Keyed by the version it upgrades FROM. */
export type Migration = (data: unknown) => unknown;
export type Migrations = Readonly<Record<number, Migration>>;

/** Anything with Zod's safeParse shape, so logic can define schemas without importing @arcade/save. */
export interface SaveSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { message: string } };
}
