/** Per-repo cancellation registry. */
const controllers = new Map<number, AbortController>();

export const cancellation = {
  register(repoId: number): AbortSignal {
    const ctrl = new AbortController();
    controllers.set(repoId, ctrl);
    return ctrl.signal;
  },

  cancel(repoId: number): boolean {
    const ctrl = controllers.get(repoId);
    if (!ctrl) return false;
    ctrl.abort();
    controllers.delete(repoId);
    return true;
  },

  cleanup(repoId: number): void {
    controllers.delete(repoId);
  },

  isRunning(repoId: number): boolean {
    return controllers.has(repoId);
  },
};
