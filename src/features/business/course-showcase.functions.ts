import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { assertCentreAdmin } from "@/features/channels/channel.functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeCaseFreeText } from "@/lib/contact-filter";

import { hasHireLanguage } from "./centre-channel";
import {
  buildCourseEnquiryRow,
  COURSE_ENQUIRY_MESSAGE_MAX_CHARS,
  type CourseEnquiryTutor,
} from "./course-showcase";

/**
 * #815 §2.5 / §2.3: a public course card and an affiliate "Request lesson"
 * both write a centre lead into the same inbox (the Centre Workspace
 * Requests panel reads `tutoring_cases.organisation_id`). This is an
 * enquiry, never a paid enrolment: no Stripe, no tuition, no seat.
 *
 * The row is left unpublishable (`board_published_at` null) so the desk and
 * the centre see it before any tutor is approached. Cap. 57 posture is
 * unchanged: MatchMax introduces an independent educator, it never becomes
 * an employment or staffing request.
 */

const EnquiryInput = z.object({
  orgSlug: z.string().trim().min(1).max(120),
  /** Optional: a tutor request (Our Tutors tab) has no course. */
  courseId: z.string().uuid().optional().nullable(),
  requestedTutorCode: z.string().trim().min(1).max(60).optional().nullable(),
  name: z.string().trim().min(1, "Add your name").max(80),
  phone: z.string().trim().min(6, "Add a phone number").max(30),
  email: z.string().trim().email().max(120).optional().nullable().or(z.literal("")),
  whoFor: z.enum(["myself", "my_child"]),
  message: z.string().trim().max(COURSE_ENQUIRY_MESSAGE_MAX_CHARS).optional().nullable(),
  /** Honeypot. A real browser leaves it empty. */
  botField: z.string().max(200).optional().nullable(),
});

export const submitCourseEnquiry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => EnquiryInput.parse(data))
  .handler(async ({ data }) => {
    // Bot: pretend success so the form does not leak the trap.
    if (data.botField) return { ok: true as const, caseCode: "" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, name, slug, status")
      .eq("slug", data.orgSlug)
      .maybeSingle();
    if (orgError) throw new Error(orgError.message);
    if (!org || org.status !== "active") {
      throw new Error("This centre is not taking enquiries right now.");
    }

    const { data: course, error: courseError } = data.courseId
      ? await supabaseAdmin
          .from("courses")
          .select(
            "id, organization_id, title, subject, curriculum, target_grade, district, mode, is_published",
          )
          .eq("id", data.courseId)
          .maybeSingle()
      : { data: null, error: null };
    if (courseError) throw new Error(courseError.message);
    if (data.courseId) {
      if (!course || course.organization_id !== org.id || course.is_published !== true) {
        throw new Error("This course is no longer available.");
      }
      // AC-CH-3: a channel never advertises jobs, vacancies or wages.
      if (hasHireLanguage(course.title)) {
        throw new Error("This course is not available for enquiries.");
      }
    }

    let requestedTutor: CourseEnquiryTutor | null = null;
    if (data.requestedTutorCode) {
      const { data: tutor } = await supabaseAdmin
        .from("tutors")
        .select("user_id, tutor_code, display_name, is_published")
        .eq("tutor_code", data.requestedTutorCode)
        .eq("is_published", true)
        .maybeSingle();
      if (tutor?.user_id) {
        const { data: affiliation } = await supabaseAdmin
          .from("centre_affiliations")
          .select("id")
          .eq("centre_id", org.id)
          .eq("user_id", tutor.user_id)
          .eq("role_type", "affiliated_tutor")
          .eq("status", "approved")
          .maybeSingle();
        if (affiliation) {
          requestedTutor = {
            userId: tutor.user_id as string,
            displayName: (tutor.display_name as string) ?? "",
            tutorCode: (tutor.tutor_code as string) ?? "",
          };
        }
      }
      // Never silently demote a tutor request to a plain course enquiry: the
      // centre must know the visitor asked for someone specifically.
      if (!requestedTutor) {
        throw new Error("This tutor is not affiliated with the centre right now.");
      }
    }

    // Nothing to route: neither a course nor an approved tutor.
    if (!course && !requestedTutor) {
      throw new Error("Choose a course or a tutor to enquire about.");
    }

    const row = buildCourseEnquiryRow(
      {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        whoFor: data.whoFor,
        message: data.message
          ? sanitizeCaseFreeText(data.message, COURSE_ENQUIRY_MESSAGE_MAX_CHARS)
          : null,
        userId: null,
      },
      { id: org.id as string, name: org.name as string, slug: org.slug as string },
      course
        ? {
            id: course.id as string,
            title: course.title as string,
            subject: (course.subject as string | null) ?? null,
            curriculum: (course.curriculum as string | null) ?? null,
            target_grade: (course.target_grade as string | null) ?? null,
            district: (course.district as string | null) ?? null,
            mode: (course.mode as "online" | "in_person" | "either") ?? "either",
          }
        : null,
      requestedTutor,
    );

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("tutoring_cases")
      .insert(row as unknown as Database["public"]["Tables"]["tutoring_cases"]["Insert"])
      .select("id, case_code")
      .single();
    if (insertError) {
      // Never echo Postgres detail (constraint names, columns) to an
      // unauthenticated visitor; keep it in the server log.
      console.error("[centre-enquiry] insert failed:", insertError);
      throw new Error("Could not send your enquiry. Please try again.");
    }

    const caseCode = (inserted?.case_code as string) ?? "";
    const enquiryTitle = (row.title as string) ?? "Partner Centre enquiry";

    // Concierge: the ops webhook is fire-and-forget and never throws.
    void import("@/lib/ops-webhook.server")
      .then(({ notifyOps }) =>
        notifyOps("centre.course_enquiry", {
          case_id: inserted?.id,
          case_code: caseCode,
          organisation_id: org.id,
          course_id: course?.id ?? null,
          requested_tutor: requestedTutor?.tutorCode ?? null,
        }),
      )
      .catch(() => {});

    // Centre admins: one transactional email each, best effort. A failed
    // send must never fail the enquiry (the lead is already in the inbox).
    try {
      const { data: members } = await supabaseAdmin
        .from("organization_members")
        .select("email, role, status")
        .eq("organization_id", org.id);
      const recipients = (members ?? [])
        .filter((m) => m.status === "active" && (m.role === "owner" || m.role === "admin"))
        .map((m) => (m.email as string) ?? "")
        .filter((email) => email.includes("@"))
        .slice(0, 5);
      if (recipients.length > 0) {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        await Promise.allSettled(
          recipients.map((to) =>
            sendTemplateEmail("centre-enquiry", to, {
              templateData: {
                orgName: org.name,
                courseTitle: enquiryTitle,
                enquirerName: data.name,
                phone: data.phone,
                email: data.email || "",
                message: data.message || "",
                requestedTutor: requestedTutor?.displayName ?? "",
                caseCode,
              },
            }),
          ),
        );
      }
    } catch (error) {
      console.error("[centre-enquiry] admin email failed:", error);
    }

    return { ok: true as const, caseCode };
  });

/**
 * Approved affiliates for the workspace course form's optional
 * `assigned_tutor_id`. Owner/admin only; the DB trigger re-checks approval
 * so a stale list can never smuggle an unapproved tutor onto a card.
 */
export const listAssignableAffiliates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orgId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asAdminDb } = await import("@/features/materials/storage-helpers");
    const db = asAdminDb(supabaseAdmin);
    await assertCentreAdmin(db, context.userId, data.orgId);

    const { data: affiliations, error } = await supabaseAdmin
      .from("centre_affiliations")
      .select("user_id")
      .eq("centre_id", data.orgId)
      .eq("role_type", "affiliated_tutor")
      .eq("status", "approved");
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set(((affiliations ?? []) as { user_id: string | null }[]).map((a) => a.user_id)),
    ).filter((id): id is string => Boolean(id));
    if (userIds.length === 0) return [];

    const { data: tutors, error: tutorError } = await supabaseAdmin
      .from("tutors")
      .select("user_id, tutor_code, display_name, is_published")
      .in("user_id", userIds);
    if (tutorError) throw new Error(tutorError.message);

    return (
      (tutors ?? []) as Array<{
        user_id: string | null;
        tutor_code: string | null;
        display_name: string | null;
        is_published: boolean | null;
      }>
    )
      .filter((t) => t.user_id && t.is_published !== false)
      .map((t) => ({
        userId: t.user_id as string,
        tutorCode: t.tutor_code ?? "",
        displayName: (t.display_name ?? "").trim() || (t.tutor_code ?? ""),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  });
