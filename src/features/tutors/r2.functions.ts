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

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getR2Config(): R2Config {
  const prefixRaw = process.env.R2_TUTOR_IMAGE_PREFIX?.trim() || DEFAULT_PREFIX;
  const normalizedPrefix = prefixRaw.endsWith("/") ? prefixRaw : `${prefixRaw}/`;
  return {
    accountId: requireEnv("R2_ACCOUNT_ID"),
    bucketName: requireEnv("R2_BUCKET_NAME"),
    apiToken: requireEnv("R2_API_TOKEN"),
    publicBaseUrl: requireEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, ""),
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
    const listUrl = new URL(`${buildR2ApiBaseUrl(config)}/objects`);
    listUrl.searchParams.set("prefix", config.keyPrefix);
    listUrl.searchParams.set("limit", String(data.limit ?? 60));

    const response = await fetch(listUrl.toString(), {
      method: "GET",
      headers: buildR2ApiHeaders(config),
    });
    if (!response.ok) throw new Error(await parseCloudflareError(response));

    const payload = (await response.json()) as {
      success?: boolean;
      result?: { objects?: Array<{ key?: string; size?: number; uploaded?: string }> };
      errors?: Array<{ message?: string }>;
    };
    if (!payload.success) {
      throw new Error(payload.errors?.[0]?.message || "Failed to list R2 images");
    }

    const entries = (payload.result?.objects ?? [])
      .filter((item) => !!item.key && !item.key.endsWith("/"))
      .map((item) => ({
        key: item.key as string,
        url: buildPublicUrl(config.publicBaseUrl, item.key as string),
        size: typeof item.size === "number" ? item.size : null,
        lastModified: typeof item.uploaded === "string" ? item.uploaded : null,
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

    if (!data.key.startsWith(config.keyPrefix)) {
      throw new Error("Invalid image key");
    }

    const response = await fetch(buildR2ObjectApiPath(config, data.key), {
      method: "DELETE",
      headers: buildR2ApiHeaders(config),
    });
    if (!response.ok) throw new Error(await parseCloudflareError(response));

    return { ok: true };
  });
