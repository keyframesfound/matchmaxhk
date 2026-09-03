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
