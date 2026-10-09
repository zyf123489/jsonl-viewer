export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function resolvePreference<Value extends string>(
  value: unknown,
  supportedValues: readonly Value[],
  fallback: Value,
): Value {
  return supportedValues.includes(value as Value) ? (value as Value) : fallback;
}
