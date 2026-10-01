/**
 * Shared page envelope. Each endpoint chooses `T` and its own cursor payload.
 */
export type CursorPage<T> = {
  data: T[];
  page: {
    nextCursor: string | null;
  };
};
