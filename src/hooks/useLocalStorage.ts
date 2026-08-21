import { useState, useEffect } from "react";

/**
 * A safe, SSR-friendly custom React hook for synchronizing state with window.localStorage.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Read value from localStorage once mounted on the client
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const item = window.localStorage.getItem(key);
        if (item !== null) {
          setStoredValue(JSON.parse(item));
        }
      }
    } catch (error) {
      console.warn(`[useLocalStorage] Error reading key "${key}":`, error);
    }
  }, [key]);

  // Function to update state and localStorage simultaneously
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`[useLocalStorage] Error setting key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
