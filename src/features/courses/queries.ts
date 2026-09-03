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
    logo_url: string | null;
    district: string | null;
    whatsapp_number: string | null;
    contact_email: string | null;
    contact_phone: string | null;
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

export async function fetchPublishedCourses(
  filters: CourseFilters = {},
  limit = 60,
): Promise<CourseWithOrganization[]> {
  let query = supabase
    .from("courses")
    .select(
      "*, organization:organizations!inner(id, slug, name, logo_url, district, whatsapp_number, contact_email, contact_phone)",
    )
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

export async function fetchCourseById(id: string): Promise<CourseWithOrganization | null> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "*, organization:organizations!inner(id, slug, name, logo_url, district, whatsapp_number, contact_email, contact_phone)",
    )
    .eq("id", id)
    .eq("is_published", true)
    .eq("organizations.status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as CourseWithOrganization | null) ?? null;
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
