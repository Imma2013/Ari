import { useCallback, useRef } from 'react';

type DebouncedFunction<T extends (...args: any[]) => void> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

/**
 * A custom hook for debouncing function calls
 * @param callback - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns A debounced version of the callback function with a cancel method
 */
export const useDebounce = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): DebouncedFunction<T> => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // Clear the previous timeout
      cancel();

      // Set a new timeout
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay, cancel]
  ) as DebouncedFunction<T>;

  // Attach cancel method to the debounced function
  debouncedCallback.cancel = cancel;

  return debouncedCallback;
};
