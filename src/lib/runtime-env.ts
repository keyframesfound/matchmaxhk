type RuntimeBindings = Record<string, unknown>;

let runtimeBindings: RuntimeBindings | undefined;

export function setRuntimeBindings(bindings: unknown): void {
  if (bindings && typeof bindings === "object") {
    runtimeBindings = bindings as RuntimeBindings;
  }
}

export function getRuntimeEnv(name: string): string | undefined {
  const bindingValue = runtimeBindings?.[name];
  if (typeof bindingValue === "string" && bindingValue.trim()) {
    return bindingValue;
  }

  const processValue = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return typeof processValue === "string" && processValue.trim() ? processValue : undefined;
}

/** A non-string Worker binding (e.g. the Workers AI binding `AI`). */
export function getRuntimeBinding<T = unknown>(name: string): T | undefined {
  // Under Nitro's cloudflare-module preset the app's fetch does not get the
  // Worker env; Nitro stores it on globalThis.__env__ for every request.
  const nitroEnv = (globalThis as { __env__?: Record<string, unknown> }).__env__;
  const value = runtimeBindings?.[name] ?? nitroEnv?.[name];
  return value && typeof value === "object" ? (value as T) : undefined;
}
