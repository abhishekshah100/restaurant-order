/** Whether a value is a plain object (not null): before reading its fields from JSON or storage. */
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
