/** Reuse a read only within a single explicitly supplied render/request scope. */
export function createRequestMemo<T>() {
  const values = new WeakMap<object, Promise<T>>();
  return (scope: object, load: () => Promise<T>): Promise<T> => {
    const existing = values.get(scope);
    if (existing) return existing;
    const pending = Promise.resolve().then(load).catch((error: unknown) => {
      values.delete(scope);
      throw error;
    });
    values.set(scope, pending);
    return pending;
  };
}
