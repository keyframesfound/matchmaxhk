import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildPublicUrl,
  buildR2ApiHeaders,
  buildR2ObjectApiPath,
  decodeBase64ToBytes,
  extractBase64Payload,
  getR2Config,
  getObjectKey,
  listR2Objects,
  parseCloudflareError,
  sanitizeFileName,
} from "@/lib/r2";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type R2TutorImage = {
  key: string;
  url: string;
  size: number | null;
  lastModified: string | null;
};

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

const SetDefaultTutorProfileImageInput = z.object({
  key: z.string().trim().min(1).max(500),
  gender: z.enum(["male", "female"]),
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
      body: new Blob([bytes as unknown as BlobPart]),
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

export const setDefaultTutorProfileImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetDefaultTutorProfileImageInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const config = getR2Config();
    const url = buildPublicUrl(config.publicBaseUrl, data.key);
    const settingKey =
      data.gender === "male"
        ? "default_tutor_profile_photo_male"
        : "default_tutor_profile_photo_female";
    // Keep the caller-scoped client for authorization above, then use the
    // server-only client for this privileged settings write. This avoids
    // relying on the publishable-key client to satisfy app_settings RLS.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert([{ key: settingKey, value: url }], { onConflict: "key" });

    if (error) throw new Error(error.message || "Failed to update default profile image");

    return { ok: true, key: settingKey, url };
  });
