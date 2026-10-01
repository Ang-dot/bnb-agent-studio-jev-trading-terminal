import { AsyncLocalStorage } from 'node:async_hooks';

// Only locally generated cancellation reasons may pass through provider-error redaction.
export class AssessmentBlockedError extends Error {}

const scope = new AsyncLocalStorage<AbortSignal>();
export const withAssessmentSignal = <T>(signal: AbortSignal, work: () => Promise<T>) => scope.run(signal, work);
export const assessmentFetch: typeof fetch = (input, init) => {
  const signal = scope.getStore();
  return fetch(input, { ...init, ...(signal ? { signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal } : {}) });
};
