import { supabase } from "@/integrations/supabase/client";

export type CourseMode = "online" | "in_person" | "either";

export type Course = {
  id: string;
  organization_id: string;
  title: string;
  summary: string | null;
  description: string | null;
  subject: string | null;
  level: string | null;
  mode: CourseMode;
  price: number | null;
  currency: string;
  schedule_text: string | null;
  session_days: string[];
  start_date: string | null;
  end_date: string | null;
  district: string | null;
  image_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type CourseWithOrganization = Course & {
  organization: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string | null;
    website_url: string | null;
    created_at: string;
    logo_url: string | null;
    district: string | null;
    whatsapp_number: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    youtube_url: string | null;
    linkedin_url: string | null;
    x_url: string | null;
    rednote_url: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
  } | null;
};

export type CourseFilters = {
  q?: string;
  subject?: string;
  level?: string;
  mode?: string;
  district?: string;
};

export const COURSE_LEVEL_OPTIONS = [
  "IB",
  "DSE",
  "IGCSE",
  "AP",
  "A-Level",
  "Primary",
  "Secondary",
  "International",
] as const;

export const COURSE_MODE_OPTIONS: Array<{ value: CourseMode | ""; label: string }> = [
  { value: "", label: "Any lesson mode" },
  { value: "online", label: "Online" },
  { value: "in_person", label: "In-person" },
  { value: "either", label: "Open to discussion" },
];

function sanitizeFilterTerm(term: string): string {
  return term.replace(/[,()"\\]/g, " ").trim();
}

export type OrgFaqPublicItem = { question: string; answer: string };

export type OrganizationPublic = {
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
  faq: OrgFaqPublicItem[];
  plan: "business" | "enterprise";
  status: "pending" | "active" | "suspended";
  created_at: string;
};

function courseWithOrgSelect(): string {
  return "*, organization:organizations!inner(id, slug, name, tagline, description, website_url, created_at, logo_url, district, whatsapp_number, contact_email, contact_phone, youtube_url, linkedin_url, x_url, rednote_url, instagram_url, facebook_url)";
}

export async function fetchPublishedCourses(
  filters: CourseFilters = {},
  limit = 60,
): Promise<CourseWithOrganization[]> {
  let query = supabase
    .from("courses")
    .select(courseWithOrgSelect())
    .eq("is_published", true)
    .eq("organizations.status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.q) {
    const term = sanitizeFilterTerm(filters.q.trim());
    if (term) {
      query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%,subject.ilike.%${term}%`);
    }
  }
  if (filters.subject) query = query.ilike("subject", `%${filters.subject.trim()}%`);
  if (filters.level) query = query.eq("level", filters.level);
  if (filters.mode === "online" || filters.mode === "in_person") {
    query = query.eq("mode", filters.mode);
  }
  if (filters.district) query = query.ilike("district", `%${filters.district.trim()}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CourseWithOrganization[];
}

export async function fetchPublishedCourseSubjects(): Promise<string[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("subject, organization:organizations!inner(id)")
    .eq("is_published", true)
    .eq("organizations.status", "active")
    .not("subject", "is", null)
    .limit(500);

  if (error) throw new Error(error.message);

  return Array.from(
    new Set(
      (data ?? [])
        .map((course) => course.subject?.trim())
        .filter((subject): subject is string => Boolean(subject)),
    ),
  ).sort((first, second) => first.localeCompare(second, "en-HK"));
}

export async function fetchCourseById(id: string): Promise<CourseWithOrganization | null> {
  const { data, error } = await supabase
    .from("courses")
    .select(courseWithOrgSelect())
    .eq("id", id)
    .eq("is_published", true)
    .eq("organizations.status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as CourseWithOrganization | null) ?? null;
}

export async function fetchOrganizationBySlug(slug: string): Promise<OrganizationPublic | null> {
  // RLS controls visibility: anon/authenticated visitors only match active orgs;
  // owners and org admins also match their own pending/suspended org (preview mode).
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, slug, name, tagline, description, website_url, contact_email, contact_phone, whatsapp_number, district, logo_url, cover_image_url, instagram_url, intro_video_url, linkedin_url, rednote_url, x_url, facebook_url, youtube_url, founded_year, languages, faq, plan, status, created_at",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as OrganizationPublic | null) ?? null;
}

export async function fetchCoursesByOrganizationId(
  orgId: string,
  limit = 50,
): Promise<CourseWithOrganization[]> {
  // RLS controls visibility: public sees published courses of active orgs;
  // org admins also see their own org's published courses while pending.
  const { data, error } = await supabase
    .from("courses")
    .select(courseWithOrgSelect())
    .eq("organization_id", orgId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CourseWithOrganization[];
}

export async function fetchOrganizationCourseCount(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("is_published", true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export function courseModeLabel(mode: CourseMode): string {
  if (mode === "online") return "Online";
  if (mode === "in_person") return "In-person";
  return "Open to discussion";
}

export function formatCoursePrice(price: number | null, currency: string): string | null {
  if (price === null || Number.isNaN(price)) return null;
  const formatted = new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: currency || "HKD",
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
  return formatted;
}
