import { useCallback, useRef } from "react";

/**
 * Returns a debounced version of the given callback.
 * Calls are delayed by `delay` ms; only the last call within that window fires.
 */
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number,
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCallback = useRef(callback);
  latestCallback.current = callback;

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        latestCallback.current(...args);
      }, delay);
    }) as T,
    [delay],
  );
}
