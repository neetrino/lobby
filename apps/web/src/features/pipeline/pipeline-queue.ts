/** Runs board mutations one after another so an older response cannot replace a newer one. */
export function createBoardQueue(): { run<T>(action: () => Promise<T>): Promise<T> } {
  let pending = Promise.resolve();
  return {
    run<T>(action: () => Promise<T>): Promise<T> {
      const run = pending.then(action, action);
      pending = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}
