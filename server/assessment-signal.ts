import { AsyncLocalStorage } from 'node:async_hooks';

const scope = new AsyncLocalStorage<AbortSignal>();
export const withAssessmentSignal = <T>(signal: AbortSignal, work: () => Promise<T>) => scope.run(signal, work);
export const assessmentFetch: typeof fetch = (input, init) => {
  const signal = scope.getStore();
  return fetch(input, { ...init, ...(signal ? { signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal } : {}) });
};
