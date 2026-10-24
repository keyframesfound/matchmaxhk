import { supabase } from "@/integrations/supabase/client";
import type { TutorApplication } from "@/lib/tutor-application.schema";

export type ApplicationData = Omit<TutorApplication, "turnstileToken">;

export type StoredApplicationFile = {
  key: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  source: "achievement" | "transcript" | "profile_photo" | "student_card";
  label: string;
};

export type TutorApplicationStatus = "pending" | "accepted" | "rejected";

export type TutorApplicationRecord = {
  id: string;
  status: TutorApplicationStatus;
  data: ApplicationData;
  attachment_files: StoredApplicationFile[];
  rejected_at: string | null;
  purge_after: string | null;
  // Issue #310: set at submit time when the card was published from this row.
  linked_tutor_id: string | null;
  linked_tutor_code: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeFiles(raw: unknown): StoredApplicationFile[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const entry = value as Record<string, unknown>;
    const key = typeof entry.key === "string" ? entry.key : "";
    const url = typeof entry.url === "string" ? entry.url : "";
    const filename = typeof entry.filename === "string" ? entry.filename : "";
    if (!key || !url || !filename) return [];
    return [
      {
        key,
        url,
        filename,
        contentType: typeof entry.contentType === "string" ? entry.contentType : "",
        size: typeof entry.size === "number" ? entry.size : 0,
        source:
          entry.source === "transcript"
            ? "transcript"
            : entry.source === "profile_photo"
              ? "profile_photo"
              : entry.source === "student_card"
                ? "student_card"
                : "achievement",
        label: typeof entry.label === "string" ? entry.label : "",
      },
    ];
  });
}

function normalizeApplication(row: Record<string, unknown>): TutorApplicationRecord {
  return {
    id: String(row.id ?? ""),
    status: (["pending", "accepted", "rejected"] as const).includes(row.status as never)
      ? (row.status as TutorApplicationStatus)
      : "pending",
    data: (row.data ?? {}) as ApplicationData,
    attachment_files: normalizeFiles(row.attachment_files),
    rejected_at: typeof row.rejected_at === "string" ? row.rejected_at : null,
    purge_after: typeof row.purge_after === "string" ? row.purge_after : null,
    linked_tutor_id: typeof row.linked_tutor_id === "string" ? row.linked_tutor_id : null,
    linked_tutor_code: null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

// Issue #310: join-requests is a read-only archive; each row shows the code of
// the tutor card that was published from it (resolved in one extra query —
// linked_tutor_id has no PostgREST-embeddable FK).
export async function fetchTutorApplications(): Promise<TutorApplicationRecord[]> {
  const { data, error } = await supabase
    .from("tutor_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  const records = ((data ?? []) as Record<string, unknown>[]).map(normalizeApplication);
  const linkedIds = [
    ...new Set(
      records.flatMap((record) => (record.linked_tutor_id ? [record.linked_tutor_id] : [])),
    ),
  ];
  if (linkedIds.length === 0) return records;

  const { data: tutors, error: tutorError } = await supabase
    .from("tutors")
    .select("id, tutor_code")
    .in("id", linkedIds);
  if (tutorError) throw tutorError;
  const codeById = new Map(
    ((tutors ?? []) as { id: string; tutor_code: string }[]).map((tutor) => [
      tutor.id,
      tutor.tutor_code,
    ]),
  );
  return records.map((record) =>
    record.linked_tutor_id
      ? { ...record, linked_tutor_code: codeById.get(record.linked_tutor_id) ?? null }
      : record,
  );
}

export async function fetchPendingApplicationCount(): Promise<number> {
  const { count, error } = await supabase
    .from("tutor_applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) throw error;
  return count ?? 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDaysUntilPurge(purgeAfter: string | null): number | null {
  if (!purgeAfter) return null;
  const diff = new Date(purgeAfter).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-HK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
