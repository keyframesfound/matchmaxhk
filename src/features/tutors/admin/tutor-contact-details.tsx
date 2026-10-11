import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, Mail, MessageCircle, Phone, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { formatTutorCode } from "@/features/tutors/tutor-display";

/**
 * Issue #295: read-only contact reveal for admins inside the TutorEditor.
 *
 * Contact details never live on `public.tutors` (that table is anon-readable),
 * so this resolves them from the two real sources via admin-gated RPCs:
 *   1. The assigned MatchMax account (auth.users email + profiles.phone).
 *   2. The tutor join application (intake form: name / phone / email).
 *      Cards and applications have no hard link, so the admin picks the
 *      application once below — it is stamped on `tutor_applications
 *      .linked_tutor_id` and read back by `get_tutor_contact_details`.
 */

type TutorContactDetails = {
  account_email: string | null;
  account_phone: string | null;
  account_display_name: string | null;
  application_name: string | null;
  application_phone: string | null;
  application_email: string | null;
  application_id: string | null;
  application_status: string | null;
  application_created_at: string | null;
};

type LinkableApplication = {
  id: string;
  label: string;
  status: string | null;
  created_at: string;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-[color:var(--ink)]"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success(`${label} copied`);
        } catch {
          toast.error("Copy failed — select the text manually.");
        }
      }}
    >
      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[color:var(--ink)]/60">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block truncate text-sm font-semibold text-[color:var(--ink)] underline decoration-[color:var(--ink)]/20 underline-offset-2 hover:decoration-[color:var(--ink)]"
          >
            {value}
          </a>
        ) : (
          <p className="mt-0.5 truncate text-sm font-semibold text-[color:var(--ink)]">{value}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

export function TutorContactDetails({
  tutorId,
  tutorCode,
}: {
  tutorId: string;
  tutorCode: string;
}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "tutor-contact", tutorId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tutor_contact_details", {
        _tutor_id: tutorId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as TutorContactDetails | null;
    },
    staleTime: 60_000,
  });

  const applicationsQuery = useQuery({
    queryKey: ["admin", "applications-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_tutor_applications_for_linking");
      if (error) throw error;
      return data as LinkableApplication[];
    },
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "tutor-contact", tutorId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "applications-for-linking"] });
  };

  const linkMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const { error } = await supabase
        .from("tutor_applications")
        .update({ linked_tutor_id: tutorId } as never)
        .eq("id", applicationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application linked — contact details shown below.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tutor_applications")
        .update({ linked_tutor_id: null } as never)
        .eq("id", query.data?.application_id as string);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application unlinked.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (query.isError) {
    return <EmptyHint text="Couldn't load contact details — refresh and try again." />;
  }

  const contact = query.data;
  if (!contact) {
    return <EmptyHint text="No contact details found for this tutor." />;
  }

  const pickableApplications = (applicationsQuery.data ?? []).filter(
    (app) => app.id !== contact.application_id,
  );
  const applicationLabel = contact.application_created_at
    ? new Date(contact.application_created_at).toLocaleDateString("en-HK", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-5">
      {/* Assigned MatchMax account */}
      <div className="space-y-3">
        <p className="text-sm font-bold text-[color:var(--ink)]">Assigned account</p>
        {contact.account_email ? (
          <ContactRow
            icon={Mail}
            label="Account email"
            value={contact.account_email}
            href={`mailto:${contact.account_email}`}
          />
        ) : (
          <EmptyHint text="No MatchMax account assigned to this tutor card yet (see Assigned Account above)." />
        )}
        {contact.account_phone ? (
          <ContactRow
            icon={Phone}
            label="Account phone"
            value={contact.account_phone}
            href={`https://wa.me/${contact.account_phone.replace(/[^\d]/g, "")}`}
          />
        ) : null}
        {contact.account_display_name ? (
          <ContactRow
            icon={ExternalLink}
            label="Account display name"
            value={contact.account_display_name}
          />
        ) : null}
      </div>

      {/* Join application intake details */}
      <div className="space-y-3 border-t border-[color:var(--ink)]/10 pt-5">
        <p className="text-sm font-bold text-[color:var(--ink)]">Join application</p>
        {contact.application_id ? (
          <>
            {applicationLabel ? (
              <p className="text-xs text-muted-foreground">
                From the join request ({applicationLabel}
                {contact.application_status ? ` · ${contact.application_status}` : ""}).
              </p>
            ) : null}
            {contact.application_name ? (
              <ContactRow
                icon={ExternalLink}
                label="Legal full name (from form)"
                value={contact.application_name}
              />
            ) : null}
            {contact.application_phone ? (
              <ContactRow
                icon={MessageCircle}
                label="Contact number / WhatsApp (from form)"
                value={contact.application_phone}
                href={`https://wa.me/${contact.application_phone.replace(/[^\d]/g, "")}`}
              />
            ) : null}
            {contact.application_email ? (
              <ContactRow
                icon={Mail}
                label="Email (from form)"
                value={contact.application_email}
                href={`mailto:${contact.application_email}`}
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={unlinkMutation.isPending}
              onClick={() => unlinkMutation.mutate()}
            >
              {unlinkMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="mr-1.5 h-3.5 w-3.5" />
              )}
              Unlink application
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <EmptyHint
              text={`No join application linked to ${formatTutorCode(tutorCode)} yet. Cards and applications aren't matched automatically — pick the tutor's original application once and its contact details appear here for every future visit.`}
            />
            <div className="max-w-xl">
              <SearchableSelect
                value=""
                onChange={(id) => linkMutation.mutate(id)}
                onQueryChange={() => {
                  /* list is preloaded (latest 200) — search filters client-side */
                }}
                options={pickableApplications.map((app) => ({
                  value: app.id,
                  label: app.label,
                  description: app.status ?? undefined,
                }))}
                placeholder="Pick the tutor's join application…"
                searchPlaceholder="Type a name or email…"
                emptyText={
                  applicationsQuery.isLoading
                    ? "Loading applications…"
                    : pickableApplications.length === 0
                      ? "No applications found"
                      : "No matching applications"
                }
                loading={applicationsQuery.isFetching}
                loadingText="Loading…"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
