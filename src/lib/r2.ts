const DEFAULT_TUTOR_PREFIX = "tutor-profile-images/";

export type R2Config = {
  accountId: string;
  bucketName: string;
  apiToken: string;
  publicBaseUrl: string;
  keyPrefix: string;
};

export type R2ObjectEntry = {
  key?: string;
  name?: string;
  size?: number;
  uploaded?: string;
  last_modified?: string;
};

export function getEnvValue(keys: string[]): string | undefined {
  const processEnv =
    typeof process !== "undefined" && process.env ? (process.env as Record<string, unknown>) : {};
  const metaEnv = (import.meta.env ?? {}) as Record<string, unknown>;
  const mergedEnv = { ...metaEnv, ...processEnv };

  for (const key of keys) {
    const value = mergedEnv[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
}

export function normalizePrefix(prefix: string): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

export function getR2Config(prefixOverride?: string): R2Config {
  const accountId = getEnvValue(["R2_ACCOUNT_ID", "VITE_R2_ACCOUNT_ID"]);
  const bucketName = getEnvValue(["R2_BUCKET_NAME", "VITE_R2_BUCKET_NAME"]);
  const apiToken = getEnvValue(["R2_API_TOKEN"]);
  const publicBaseUrl = getEnvValue(["R2_PUBLIC_BASE_URL", "VITE_R2_PUBLIC_BASE_URL"]);
  const missing = [
    ...(!accountId ? ["R2_ACCOUNT_ID"] : []),
    ...(!bucketName ? ["R2_BUCKET_NAME"] : []),
    ...(!apiToken ? ["R2_API_TOKEN"] : []),
    ...(!publicBaseUrl ? ["R2_PUBLIC_BASE_URL"] : []),
  ];
  if (missing.length > 0 || !accountId || !bucketName || !apiToken || !publicBaseUrl) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  const prefixRaw =
    prefixOverride ??
    (getEnvValue(["R2_TUTOR_IMAGE_PREFIX", "VITE_R2_TUTOR_IMAGE_PREFIX"]) || DEFAULT_TUTOR_PREFIX);
  return {
    accountId,
    bucketName,
    apiToken,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
    keyPrefix: normalizePrefix(prefixRaw),
  };
}

export function buildR2ApiBaseUrl(config: R2Config): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${encodeURIComponent(config.bucketName)}`;
}

export function buildR2ApiHeaders(config: R2Config, contentType?: string): HeadersInit {
  return {
    Authorization: `Bearer ${config.apiToken}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

export function buildR2ObjectApiPath(config: R2Config, key: string): string {
  const encoded = key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${buildR2ApiBaseUrl(config)}/objects/${encoded}`;
}

export async function parseCloudflareError(response: Response): Promise<string> {
  const raw = await response.text();
  try {
    const json = JSON.parse(raw) as { errors?: Array<{ message?: string }> };
    const message = json.errors?.[0]?.message;
    return message ? `Cloudflare R2 error: ${message}` : `Cloudflare R2 error: ${raw}`;
  } catch {
    return `Cloudflare R2 error: ${raw}`;
  }
}

export function normalizeListObjects(payload: {
  result?: unknown;
  errors?: Array<{ message?: string }>;
}): R2ObjectEntry[] {
  const result = payload.result;
  if (Array.isArray(result)) return result as R2ObjectEntry[];
  if (!result || typeof result !== "object") return [];

  const resultObj = result as Record<string, unknown>;
  if (Array.isArray(resultObj.objects)) return resultObj.objects as R2ObjectEntry[];
  if (Array.isArray(resultObj.items)) return resultObj.items as R2ObjectEntry[];
  return [];
}

export function getObjectKey(item: R2ObjectEntry): string | null {
  const value = item.key ?? item.name;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function listR2Objects(
  config: R2Config,
  limit: number,
  prefix?: string,
): Promise<R2ObjectEntry[]> {
  const listUrl = new URL(`${buildR2ApiBaseUrl(config)}/objects`);
  listUrl.searchParams.set("limit", String(limit));
  if (prefix) {
    listUrl.searchParams.set("prefix", prefix);
  }

  const response = await fetch(listUrl.toString(), {
    method: "GET",
    headers: buildR2ApiHeaders(config),
  });
  if (!response.ok) throw new Error(await parseCloudflareError(response));

  const payload = (await response.json()) as {
    success?: boolean;
    result?: unknown;
    errors?: Array<{ message?: string }>;
  };
  if (!payload.success) {
    throw new Error(payload.errors?.[0]?.message || "Failed to list R2 images");
  }

  return normalizeListObjects(payload);
}

export function buildPublicUrl(publicBaseUrl: string, key: string): string {
  const normalizedKey = key.replace(/^\/+/, "");
  if (publicBaseUrl.includes("{key}")) {
    return publicBaseUrl.replace("{key}", normalizedKey);
  }
  return `${publicBaseUrl}/${normalizedKey}`;
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function extractBase64Payload(input: string): string {
  const trimmed = input.trim();
  const commaIndex = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIndex > 0) {
    return trimmed.slice(commaIndex + 1);
  }
  return trimmed;
}

export function decodeBase64ToBytes(base64Payload: string): Uint8Array {
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
