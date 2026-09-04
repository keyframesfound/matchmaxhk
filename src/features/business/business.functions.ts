import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import {
  buildPublicUrl,
  buildR2ApiHeaders,
  buildR2ObjectApiPath,
  decodeBase64ToBytes,
  extractBase64Payload,
  getR2Config,
  parseCloudflareError,
  sanitizeFileName,
} from "@/lib/r2";
import { getRuntimeEnv } from "@/lib/runtime-env";

const ORG_IMAGE_PREFIX = "business-profile";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const FROM_ADDRESS = "MatchMax <noreply@matchmax.hk>";

type DbClient = SupabaseClient<Database>;

export type OrgRole = "owner" | "admin";

export type OrgFaqItem = { question: string; answer: string };

export type OrganizationRecord = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_number: string | null;
  district: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  instagram_url: string | null;
  intro_video_url: string | null;
  linkedin_url: string | null;
  rednote_url: string | null;
  x_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  founded_year: number | null;
  languages: string | null;
  faq: OrgFaqItem[];
  plan: "business" | "enterprise";
  status: "pending" | "active" | "suspended";
  created_by: string;
  created_at: string;
  updated_at: string;
};

async function getOrgRole(client: DbClient, orgId: string): Promise<OrgRole | null> {
  const { data, error } = await client.rpc("get_org_role", { _org_id: orgId });
  if (error) throw new Error(error.message || "Failed to verify organization role");
  return (data as OrgRole | null) ?? null;
}

async function assertOrgAdmin(client: DbClient, orgId: string): Promise<OrgRole> {
  const role = await getOrgRole(client, orgId);
  if (!role) throw new Error("Forbidden: You are not an admin of this organization.");
  return role;
}

async function assertOrgOwner(client: DbClient, orgId: string): Promise<void> {
  const role = await getOrgRole(client, orgId);
  if (role !== "owner") {
    throw new Error("Forbidden: Only the organization owner can do this.");
  }
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "business"
  );
}

function emptyToNull(value: string | undefined): string | null {
  return value !== undefined && value.trim() ? value.trim() : null;
}

function getUserEmail(context: { claims: unknown }): string {
  const email = (context.claims as { email?: string } | undefined)?.email;
  return (email ?? "").toLowerCase();
}

const CreateOrganizationInput = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  tagline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(5000).optional(),
  website_url: z.string().trim().max(300).optional(),
  contact_email: z.string().trim().max(200).optional(),
  contact_phone: z.string().trim().max(40).optional(),
  whatsapp_number: z.string().trim().max(40).optional(),
  district: z.string().trim().max(80).optional(),
});

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateOrganizationInput.parse(data))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as DbClient;

    const { data: existing } = await client
      .from("organizations")
      .select("id")
      .eq("created_by", context.userId)
      .maybeSingle();
    if (existing) {
      throw new Error("You already manage an organization on MatchMax.");
    }

    const slugBase = slugify(data.name);
    let slug = slugBase;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate =
        attempt === 0 ? slugBase : `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: row } = await client
        .from("organizations")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      if (!row) {
        slug = candidate;
        break;
      }
      if (attempt === 5) slug = `${slugBase}-${Date.now().toString(36)}`;
    }

    const { data: org, error } = await client
      .from("organizations")
      .insert({
        name: data.name,
        slug,
        tagline: emptyToNull(data.tagline),
        description: emptyToNull(data.description),
        website_url: emptyToNull(data.website_url),
        contact_email: emptyToNull(data.contact_email),
        contact_phone: emptyToNull(data.contact_phone),
        whatsapp_number: emptyToNull(data.whatsapp_number),
        district: emptyToNull(data.district),
        plan: "business",
        status: "pending",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message || "Failed to create organization");

    const ownerEmail = getUserEmail(context);
    const { error: memberError } = await client.from("organization_members").insert({
      organization_id: org.id,
      email: ownerEmail,
      user_id: context.userId,
      role: "owner",
      status: "active",
      claimed_at: new Date().toISOString(),
    });
    if (memberError) {
      throw new Error(memberError.message || "Failed to create owner membership");
    }

    return { organization: org };
  });

const FaqItemInput = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(1000),
});

const UpdateOrganizationInput = z.object({
  orgId: z.string().uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  tagline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(5000).optional(),
  website_url: z.string().trim().max(300).optional(),
  contact_email: z.string().trim().max(200).optional(),
  contact_phone: z.string().trim().max(40).optional(),
  whatsapp_number: z.string().trim().max(40).optional(),
  district: z.string().trim().max(80).optional(),
  logo_url: z.string().trim().max(1000).optional(),
  cover_image_url: z.string().trim().max(1000).optional(),
  instagram_url: z.string().trim().max(300).optional(),
  intro_video_url: z.string().trim().max(300).optional(),
  linkedin_url: z.string().trim().max(300).optional(),
  rednote_url: z.string().trim().max(300).optional(),
  x_url: z.string().trim().max(300).optional(),
  facebook_url: z.string().trim().max(300).optional(),
  youtube_url: z.string().trim().max(300).optional(),
  founded_year: z.number().int().min(1900).max(2100).nullable().optional(),
  languages: z.string().trim().max(200).optional(),
  faq: z.array(FaqItemInput).max(8).optional(),
});

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateOrganizationInput.parse(data))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as DbClient;
    await assertOrgAdmin(client, data.orgId);

    const patch: Database["public"]["Tables"]["organizations"]["Update"] = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.tagline !== undefined) patch.tagline = emptyToNull(data.tagline);
    if (data.description !== undefined) patch.description = emptyToNull(data.description);
    if (data.website_url !== undefined) patch.website_url = emptyToNull(data.website_url);
    if (data.contact_email !== undefined) patch.contact_email = emptyToNull(data.contact_email);
    if (data.contact_phone !== undefined) patch.contact_phone = emptyToNull(data.contact_phone);
    if (data.whatsapp_number !== undefined) {
      patch.whatsapp_number = emptyToNull(data.whatsapp_number);
    }
    if (data.district !== undefined) patch.district = emptyToNull(data.district);
    if (data.logo_url !== undefined) patch.logo_url = emptyToNull(data.logo_url);
    if (data.cover_image_url !== undefined) {
      patch.cover_image_url = emptyToNull(data.cover_image_url);
    }
    if (data.instagram_url !== undefined) patch.instagram_url = emptyToNull(data.instagram_url);
    if (data.linkedin_url !== undefined) patch.linkedin_url = emptyToNull(data.linkedin_url);
    if (data.rednote_url !== undefined) patch.rednote_url = emptyToNull(data.rednote_url);
    if (data.x_url !== undefined) patch.x_url = emptyToNull(data.x_url);
    if (data.intro_video_url !== undefined) {
      patch.intro_video_url = emptyToNull(data.intro_video_url);
    }
    if (data.facebook_url !== undefined) patch.facebook_url = emptyToNull(data.facebook_url);
    if (data.youtube_url !== undefined) patch.youtube_url = emptyToNull(data.youtube_url);
    if (data.founded_year !== undefined) patch.founded_year = data.founded_year;
    if (data.languages !== undefined) patch.languages = emptyToNull(data.languages);
    if (data.faq !== undefined) {
      patch.faq = data.faq.length > 0 ? data.faq : [];
    }

    if (Object.keys(patch).length === 0) {
      throw new Error("Nothing to update");
    }

    const { data: org, error } = await client
      .from("organizations")
      .update(patch)
      .eq("id", data.orgId)
      .select("*")
      .single();
    if (error) throw new Error(error.message || "Failed to update organization");

    return { organization: org };
  });

const UploadOrgImageInput = z.object({
  orgId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  contentType: z
    .string()
    .trim()
    .regex(/^image\/(png|jpe?g|webp|gif|avif)$/i, "Only image uploads are supported"),
  base64Data: z.string().trim().min(20).max(20_000_000),
});

export const uploadOrganizationImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UploadOrgImageInput.parse(data))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as DbClient;
    await assertOrgAdmin(client, data.orgId);

    const config = getR2Config(`${ORG_IMAGE_PREFIX}/${data.orgId}`);
    const payload = extractBase64Payload(data.base64Data);
    const bytes = decodeBase64ToBytes(payload);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("Image is too large. Maximum upload size is 5MB.");
    }

    const safeName = sanitizeFileName(data.fileName) || "image";
    const extension = safeName.includes(".") ? "" : data.contentType.replace("image/", ".");
    const key = `${config.keyPrefix}${Date.now()}-${crypto.randomUUID()}-${safeName}${extension}`;

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

const DeleteOrgImageInput = z.object({
  orgId: z.string().uuid(),
  key: z.string().trim().min(1).max(500),
});

export const deleteOrganizationImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteOrgImageInput.parse(data))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as DbClient;
    await assertOrgAdmin(client, data.orgId);

    const expectedPrefix = `${ORG_IMAGE_PREFIX}/${data.orgId}/`;
    if (!data.key.startsWith(expectedPrefix)) {
      throw new Error("Forbidden: Image does not belong to this organization.");
    }

    const config = getR2Config();
    const response = await fetch(buildR2ObjectApiPath(config, data.key), {
      method: "DELETE",
      headers: buildR2ApiHeaders(config),
    });
    if (!response.ok) throw new Error(await parseCloudflareError(response));

    return { ok: true };
  });

function buildInviteEmailHtml(orgName: string, inviterLabel: string, planLabel: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <p>Hi,</p>
  <p>${inviterLabel} has invited you to be an admin of <strong>${orgName}</strong> on MatchMax (${planLabel} account).</p>
  <p>To accept, sign in or sign up at <a href="https://matchmax.hk/auth">matchmax.hk/auth</a> using this email address — you'll get admin access automatically.</p>
  <p>— The MatchMax Team</p>
</body></html>`;
}

const InviteMemberInput = z.object({
  orgId: z.string().uuid(),
  email: z.string().trim().email("Enter a valid email address").max(200),
});

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InviteMemberInput.parse(data))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as DbClient;
    await assertOrgAdmin(client, data.orgId);

    const email = data.email.toLowerCase();
    const inviterEmail = getUserEmail(context);

    const { data: member, error } = await client
      .from("organization_members")
      .upsert(
        {
          organization_id: data.orgId,
          email,
          role: "admin",
          status: "pending",
          user_id: null,
          invited_by: inviterEmail || null,
          invited_at: new Date().toISOString(),
          claimed_at: null,
        },
        { onConflict: "organization_id,email" },
      )
      .select("*")
      .single();
    if (error) {
      const message = error.message || "Failed to invite member";
      if (/limit reached/i.test(message)) {
        throw new Error(
          "Team member limit reached for your plan. Remove an unused invite or upgrade to Enterprise.",
        );
      }
      throw new Error(message);
    }

    let emailSent = false;
    try {
      const apiKey = getRuntimeEnv("RESEND_API_KEY");
      if (apiKey) {
        const { data: org } = await client
          .from("organizations")
          .select("name, plan")
          .eq("id", data.orgId)
          .maybeSingle();
        if (org) {
          const planLabel = org.plan === "enterprise" ? "an Enterprise" : "a Business";
          const inviterLabel = inviterEmail || "The account owner";
          const { Resend } = await import("resend");
          const { error: sendError } = await new Resend(apiKey).emails.send({
            from: FROM_ADDRESS,
            to: email,
            subject: `You've been invited to administer ${org.name} on MatchMax`,
            html: buildInviteEmailHtml(org.name, inviterLabel, planLabel),
            text: `${inviterLabel} has invited you to be an admin of ${org.name} on MatchMax (${planLabel} account). Sign in or sign up at https://matchmax.hk/auth using this email address to claim admin access.`,
          });
          emailSent = !sendError;
        }
      }
    } catch {
      emailSent = false;
    }

    return { member, emailSent };
  });

const RemoveMemberInput = z.object({
  orgId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RemoveMemberInput.parse(data))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as DbClient;
    await assertOrgOwner(client, data.orgId);

    const { data: member } = await client
      .from("organization_members")
      .select("id, role")
      .eq("id", data.memberId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (!member) throw new Error("Member not found");
    if (member.role === "owner") {
      throw new Error("The organization owner cannot be removed. Delete the organization instead.");
    }

    const { error } = await client
      .from("organization_members")
      .delete()
      .eq("id", data.memberId)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message || "Failed to remove member");

    return { ok: true };
  });

export const getOrganizationRoleForSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as DbClient;
    const { data: org } = await client
      .from("organizations")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!org) return { role: null };
    const role = await getOrgRole(client, org.id);
    return { role };
  });

function normalizeFaqValue(value: unknown): OrgFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item as Record<string, unknown> | null;
      const question = typeof record?.question === "string" ? record.question : "";
      const answer = typeof record?.answer === "string" ? record.answer : "";
      return { question, answer };
    })
    .filter((item) => item.question.trim() && item.answer.trim());
}

export const fetchOrganizationSeoMeta = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name, tagline, description, logo_url, cover_image_url")
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    return org ?? null;
  });

export const listMyOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as DbClient;

    // Claim any pending invites matching this account's email
    await client.rpc("claim_org_memberships");

    const { data: memberships, error } = await client
      .from("organization_members")
      .select("*, organization:organizations(*)")
      .eq("user_id", context.userId)
      .neq("status", "revoked");
    if (error) throw new Error(error.message || "Failed to load organization");

    type MemberRow = {
      id: string;
      organization_id: string;
      email: string;
      role: OrgRole;
      status: "pending" | "active" | "revoked";
      organization: Record<string, unknown> | null;
    };

    const rows = (memberships ?? []) as unknown as MemberRow[];
    const active = rows.filter((row) => row.status === "active" && row.organization);
    if (active.length === 0) {
      return { membership: null, organization: null, usage: null };
    }

    const membership = active.find((row) => row.role === "owner") ?? active[0];
    const rawOrganization = membership.organization as unknown as OrganizationRecord;
    const organization: OrganizationRecord = {
      ...rawOrganization,
      faq: normalizeFaqValue(rawOrganization?.faq),
    };

    const [courseCount, memberCount] = await Promise.all([
      client
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .then((res: { count: number | null }) => res.count ?? 0),
      client
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .in("status", ["pending", "active"])
        .then((res: { count: number | null }) => res.count ?? 0),
    ]);

    return {
      membership: {
        id: membership.id,
        organization_id: membership.organization_id,
        email: membership.email,
        role: membership.role,
        status: membership.status,
      },
      organization,
      usage: {
        coursesUsed: courseCount,
        courseLimit: organization.plan === "business" ? 10 : null,
        memberCount,
        memberLimit: organization.plan === "business" ? 2 : 21,
      },
    };
  });

const ANALYTICS_EVENT_TYPES = [
  "profile_view",
  "impression",
  "course_view",
  "contact_click",
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

// Hong Kong has no DST, so a fixed +08:00 offset is safe for day bucketing.
const HK_OFFSET_MS = 8 * 60 * 60 * 1000;

function hkDateString(date: Date): string {
  return new Date(date.getTime() + HK_OFFSET_MS).toISOString().slice(0, 10);
}

function hkDayStartUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000+08:00`);
}

export const trackBusinessEvents = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        events: z
          .array(
            z.object({
              organizationId: z.string().uuid(),
              type: z.enum(ANALYTICS_EVENT_TYPES),
              courseId: z.string().uuid().nullish(),
              sessionId: z.string().max(64).optional().default(""),
            }),
          )
          .min(1)
          .max(25),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const today = hkDateString(new Date());
      const dayStart = hkDayStartUtc(today);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const orgIds = Array.from(new Set(data.events.map((event) => event.organizationId)));
      const sessionIds = Array.from(
        new Set(data.events.map((event) => event.sessionId).filter(Boolean)),
      );

      // Backstop dedupe: skip events already recorded for the same session and day.
      let existing = new Set<string>();
      if (sessionIds.length > 0) {
        const { data: rows } = await supabaseAdmin
          .from("business_analytics_events")
          .select("organization_id, event_type, course_id, session_id")
          .in("organization_id", orgIds)
          .in("session_id", sessionIds)
          .gte("created_at", dayStart.toISOString())
          .lt("created_at", dayEnd.toISOString());
        existing = new Set(
          (rows ?? []).map(
            (row) =>
              `${row.organization_id}:${row.event_type}:${row.course_id ?? "-"}:${row.session_id}`,
          ),
        );
      }

      const inserts = data.events
        .filter((event) => {
          const key = `${event.organizationId}:${event.type}:${event.courseId ?? "-"}:${event.sessionId}`;
          return !existing.has(key);
        })
        .map((event) => ({
          organization_id: event.organizationId,
          event_type: event.type,
          course_id: event.courseId ?? null,
          session_id: event.sessionId,
        }));

      if (inserts.length > 0) {
        const { error } = await supabaseAdmin.from("business_analytics_events").insert(inserts);
        if (error) throw new Error(error.message);
      }
      return { ok: true };
    } catch {
      // Analytics must never break the visitor experience.
      return { ok: false };
    }
  });

export type BusinessAnalytics = {
  totals: Record<AnalyticsEventType, { current: number; previous: number }>;
  daily: Array<{
    date: string;
    impression: number;
    profile_view: number;
    course_view: number;
    contact_click: number;
  }>;
  courseViews: Array<{ courseId: string; title: string; views: number }>;
};

export const getBusinessAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organizationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<BusinessAnalytics> => {
    const client = context.supabase as unknown as DbClient;
    const role = await getOrgRole(client, data.organizationId);
    if (!role) throw new Error("You don't have access to this organization");

    const now = Date.now();
    const currentStart = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const { data: rows, error } = await supabaseAdmin
      .from("business_analytics_events")
      .select("event_type, course_id, created_at")
      .eq("organization_id", data.organizationId)
      .gte("created_at", previousStart.toISOString())
      .order("created_at", { ascending: true })
      .limit(100_000);
    if (error) throw new Error(error.message);

    const totals: BusinessAnalytics["totals"] = {
      profile_view: { current: 0, previous: 0 },
      impression: { current: 0, previous: 0 },
      course_view: { current: 0, previous: 0 },
      contact_click: { current: 0, previous: 0 },
    };
    const dailyMap = new Map<string, BusinessAnalytics["daily"][number]>();
    for (let i = 29; i >= 0; i -= 1) {
      const date = hkDateString(new Date(now - i * 24 * 60 * 60 * 1000));
      dailyMap.set(date, {
        date,
        impression: 0,
        profile_view: 0,
        course_view: 0,
        contact_click: 0,
      });
    }
    const courseViewCounts = new Map<string, number>();

    for (const row of rows ?? []) {
      const type = row.event_type as AnalyticsEventType;
      const createdAt = new Date(row.created_at);
      if (type in totals) {
        if (createdAt >= currentStart) {
          totals[type].current += 1;
        } else {
          totals[type].previous += 1;
        }
      }
      if (createdAt >= currentStart) {
        const bucket = dailyMap.get(hkDateString(createdAt));
        if (bucket) {
          bucket[type] += 1;
        }
        if (type === "course_view" && row.course_id) {
          courseViewCounts.set(row.course_id, (courseViewCounts.get(row.course_id) ?? 0) + 1);
        }
      }
    }

    let courseViews: BusinessAnalytics["courseViews"] = [];
    const courseIds = Array.from(courseViewCounts.keys());
    if (courseIds.length > 0) {
      const { data: courseRows } = await supabaseAdmin
        .from("courses")
        .select("id, title")
        .in("id", courseIds);
      courseViews = courseIds
        .map((courseId) => ({
          courseId,
          title: courseRows?.find((course) => course.id === courseId)?.title ?? "Course",
          views: courseViewCounts.get(courseId) ?? 0,
        }))
        .sort((first, second) => second.views - first.views);
    }

    return { totals, daily: Array.from(dailyMap.values()), courseViews };
  });
