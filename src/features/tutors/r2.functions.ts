import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_PREFIX = "tutor-profile-images/";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type R2Config = {
  accountId: string;
  bucketName: string;
  apiToken: string;
  publicBaseUrl: string;
  keyPrefix: string;
};

export type R2TutorImage = {
  key: string;
  url: string;
  size: number | null;
  lastModified: string | null;
};

function getEnvValue(keys: string[]): string | undefined {
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

function getR2Config(): R2Config {
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
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  const prefixRaw =
    getEnvValue(["R2_TUTOR_IMAGE_PREFIX", "VITE_R2_TUTOR_IMAGE_PREFIX"]) || DEFAULT_PREFIX;
  const normalizedPrefix = prefixRaw.endsWith("/") ? prefixRaw : `${prefixRaw}/`;
  return {
    accountId,
    bucketName,
    apiToken,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
    keyPrefix: normalizedPrefix,
  };
}

function buildR2ApiBaseUrl(config: R2Config): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${encodeURIComponent(config.bucketName)}`;
}

function buildR2ApiHeaders(config: R2Config, contentType?: string): HeadersInit {
  return {
    Authorization: `Bearer ${config.apiToken}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

function buildR2ObjectApiPath(config: R2Config, key: string): string {
  const encoded = key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${buildR2ApiBaseUrl(config)}/objects/${encoded}`;
}

async function parseCloudflareError(response: Response): Promise<string> {
  const raw = await response.text();
  try {
    const json = JSON.parse(raw) as { errors?: Array<{ message?: string }> };
    const message = json.errors?.[0]?.message;
    return message ? `Cloudflare R2 error: ${message}` : `Cloudflare R2 error: ${raw}`;
  } catch {
    return `Cloudflare R2 error: ${raw}`;
  }
}

type R2ObjectEntry = {
  key?: string;
  name?: string;
  size?: number;
  uploaded?: string;
  last_modified?: string;
};

function normalizeListObjects(payload: {
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

function getObjectKey(item: R2ObjectEntry): string | null {
  const value = item.key ?? item.name;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function listR2Objects(
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

function buildPublicUrl(publicBaseUrl: string, key: string): string {
  const normalizedKey = key.replace(/^\/+/, "");
  if (publicBaseUrl.includes("{key}")) {
    return publicBaseUrl.replace("{key}", normalizedKey);
  }
  return `${publicBaseUrl}/${normalizedKey}`;
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extractBase64Payload(input: string): string {
  const trimmed = input.trim();
  const commaIndex = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIndex > 0) {
    return trimmed.slice(commaIndex + 1);
  }
  return trimmed;
}

function decodeBase64ToBytes(base64Payload: string): Uint8Array {
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const ListInput = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

const UploadInput = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z
    .string()
    .trim()
    .regex(/^image\/(png|jpe?g|webp|gif|avif)$/i, "Only image uploads are supported"),
  base64Data: z.string().trim().min(20).max(20_000_000),
});

const DeleteInput = z.object({
  key: z.string().trim().min(1).max(500),
});

async function assertAdmin(supabase: unknown, userId: string) {
  const roles: Array<"admin" | "super_admin"> = ["admin", "super_admin"];
  const client = supabase as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error?: { message?: string } }>;
  };
  for (const role of roles) {
    const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: role });
    if (error) throw new Error(error.message || "Failed to verify admin role");
    if (data === true) return;
  }
  throw new Error("Forbidden");
}

export const listTutorProfileImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const config = getR2Config();
    const limit = data.limit ?? 60;
    let objects = await listR2Objects(config, limit, config.keyPrefix);
    if (objects.length === 0) {
      objects = await listR2Objects(config, limit);
    }

    const entries = objects
      .map((item) => {
        const key = getObjectKey(item);
        return {
          key,
          url: key ? buildPublicUrl(config.publicBaseUrl, key) : null,
          size: typeof item.size === "number" ? item.size : null,
          lastModified:
            typeof item.uploaded === "string"
              ? item.uploaded
              : typeof item.last_modified === "string"
                ? item.last_modified
                : null,
        };
      })
      .filter(
        (
          item,
        ): item is {
          key: string;
          url: string;
          size: number | null;
          lastModified: string | null;
        } => {
          return !!item.key && !!item.url && !item.key.endsWith("/");
        },
      )
      .map((item) => ({
        key: item.key,
        url: item.url,
        size: typeof item.size === "number" ? item.size : null,
        lastModified: item.lastModified,
      }))
      .sort((a, b) => {
        const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return bTime - aTime;
      });
    return entries;
  });

export const uploadTutorProfileImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UploadInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const config = getR2Config();

    const payload = extractBase64Payload(data.base64Data);
    const bytes = decodeBase64ToBytes(payload);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("Image is too large. Maximum upload size is 5MB.");
    }

    const safeName = sanitizeFileName(data.fileName) || "tutor-image";
    const extension = safeName.includes(".") ? "" : data.contentType.replace("image/", ".");
    const randomId = crypto.randomUUID();
    const key = `${config.keyPrefix}${Date.now()}-${randomId}-${safeName}${extension}`;

    const response = await fetch(buildR2ObjectApiPath(config, key), {
      method: "PUT",
      headers: buildR2ApiHeaders(config, data.contentType),
      body: bytes,
    });
    if (!response.ok) throw new Error(await parseCloudflareError(response));

    return {
      key,
      url: buildPublicUrl(config.publicBaseUrl, key),
    };
  });

export const deleteTutorProfileImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const config = getR2Config();

    const response = await fetch(buildR2ObjectApiPath(config, data.key), {
      method: "DELETE",
      headers: buildR2ApiHeaders(config),
    });
    if (!response.ok) throw new Error(await parseCloudflareError(response));

    return { ok: true };
  });
