import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarDays,
  Loader2,
  MessageSquare,
  SearchX,
  ShieldAlert,
  UserRoundPlus,
} from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
import {
  disconnectConnection,
  listConnectableTutors,
  listMyConnections,
  respondToConnection,
  type ConnectionFindTutor,
  type ConnectionItem,
  type ConnectionTutorPublic,
} from "@/features/connections/connections.functions";
import {
  CONNECT_INTENT_TAGS,
  renderSanitizedNote,
  type ConnectIntentTag,
} from "@/features/connections/connections-pure";
import { ConnectRequestModal } from "@/features/connections/connect-request-modal";

/**
 * #617 Connections Hub (Child A): Connected 已連結 | Pending 待確認 |
 * Find Tutors 尋找導師. Verified-tutor-only surface: signed-out users are
 * bounced to /auth by the _authenticated layout; non-tutors and unverified
 * tutors get the verification gate below. NOTE (deviation): the issue's
 * /tutor/connections path does not exist in this repo — the hub lives on
 * the account surface at /account/connections.
 */

const CURRICULUM_OPTIONS = ["DSE", "IB", "IGCSE", "A-Level"] as const;
const CONNECTIONS_TABS = ["connected", "pending", "find"] as const;
type ConnectionsTab = (typeof CONNECTIONS_TABS)[number];

type ConnectionsSearch = {
  tab?: ConnectionsTab;
  subject?: string;
  curriculum?: string;
  district?: string;
  intent?: string;
};

// validateSearch is TOTAL (repo cold-SSR rule): scalars are coerced to
// String, null/objects/arrays dropped, enums pass only exact values.
function validateSearch(search: Record<string, unknown>): ConnectionsSearch {
  const out: ConnectionsSearch = {};
  const rawTab =
    typeof search.tab === "string"
      ? search.tab
      : typeof search.tab === "number"
        ? String(search.tab)
        : null;
  if (rawTab && (CONNECTIONS_TABS as readonly string[]).includes(rawTab)) {
    out.tab = rawTab as ConnectionsTab;
  }
  for (const key of ["subject", "district"] as const) {
    const raw = search[key];
    if (typeof raw === "string" && raw.trim()) out[key] = raw;
    else if (typeof raw === "number") out[key] = String(raw);
  }
  for (const key of ["curriculum"] as const) {
    const raw = search[key];
    const value = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
    if ((CURRICULUM_OPTIONS as readonly string[]).includes(value)) out[key] = value;
  }
  const rawIntent =
    typeof search.intent === "string"
      ? search.intent
      : typeof search.intent === "number"
        ? String(search.intent)
        : "";
  if ((CONNECT_INTENT_TAGS as readonly string[]).includes(rawIntent)) {
    out.intent = rawIntent as ConnectIntentTag;
  }
  return out;
}

export const Route = createFileRoute("/_authenticated/account/connections")({
  ssr: false,
  validateSearch,
  head: () => ({
    meta: [{ title: "Connections | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: ConnectionsHubPage,
});

function ConnectionsHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const tab: ConnectionsTab = search.tab ?? "connected";

  const connectionsQuery = useQuery({
    queryKey: ["connections", "hub"],
    queryFn: () => listMyConnections(),
    staleTime: 30_000,
  });
  const verified = connectionsQuery.data?.verified === true;
  const items = connectionsQuery.data?.items ?? [];
  const pendingInboundCount = items.filter(
    (i) => i.status === "PENDING" && i.direction === "inbound",
  ).length;

  function setTab(next: ConnectionsTab) {
    void navigate({
      to: "/account/connections",
      search: (prev: Record<string, unknown>) => ({ ...prev, tab: next }),
    });
  }

  if (!connectionsQuery.isLoading && !verified) {
    return (
      <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <h1 className="mt-3 text-lg font-bold text-[color:var(--ink)]">
              {t("connections.gate_title")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("connections.gate_body")}
            </p>
            <Button variant="outline" asChild className="mt-5 font-semibold">
              <a href="/dashboard#my-tutor">{t("connections.gate_cta")}</a>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <PageContainer className="py-8 sm:py-10">
          <h1 className="text-2xl font-bold tracking-normal text-[color:var(--ink)]">
            {t("connections.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("connections.subtitle")}</p>

          <div
            className="mt-5 flex w-full max-w-xl gap-1 rounded-xl border border-border bg-card p-1"
            role="tablist"
            aria-label={t("connections.title")}
          >
            {CONNECTIONS_TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "relative flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  tab === key
                    ? "bg-[color:var(--ink)] text-[color:var(--background)]"
                    : "text-muted-foreground hover:bg-[color:var(--foreground)]/[0.04]",
                )}
              >
                {t(`connections.tab_${key}`)}
                {key === "pending" && pendingInboundCount > 0 ? (
                  <span
                    className={cn(
                      "ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      tab === key
                        ? "bg-[color:var(--background)]/20 text-[color:var(--background)]"
                        : "bg-[color:var(--brand-link)] text-white",
                    )}
                  >
                    {pendingInboundCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {connectionsQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : tab === "connected" ? (
              <ConnectedTab items={items} />
            ) : tab === "pending" ? (
              <PendingTab items={items} />
            ) : (
              <FindTab
                subject={search.subject}
                curriculum={search.curriculum}
                district={search.district}
                intent={search.intent}
              />
            )}
          </div>
        </PageContainer>
      </main>
      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared tutor row
// ---------------------------------------------------------------------------

function TutorAvatar({ tutor }: { tutor: ConnectionTutorPublic }) {
  const initial = (tutor.display_name || tutor.tutor_code || "?").slice(0, 1).toUpperCase();
  return tutor.photo_url ? (
    <img
      src={tutor.photo_url}
      alt=""
      className="h-12 w-12 shrink-0 rounded-full object-cover"
      loading="lazy"
    />
  ) : (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04] text-base font-semibold text-[color:var(--muted-foreground)]">
      {initial}
    </div>
  );
}

function TutorLine({ tutor }: { tutor: ConnectionTutorPublic }) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-[color:var(--ink)]">
        <span className="truncate">{tutor.display_name || tutor.tutor_code}</span>
        {tutor.verification_tier === "tier_2_verified" ? (
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[color:var(--brand-link)]">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("connections.verified")}
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {[tutor.tutor_code, tutor.subjects.slice(0, 3).join(", "), tutor.district ?? null]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

function IntentChip({ tag }: { tag: ConnectIntentTag }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-full bg-[color:var(--foreground)]/[0.06] px-2.5 py-0.5 text-xs font-medium text-[color:var(--ink)]">
      {t(`connections.intent_${tag}`)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Connected tab
// ---------------------------------------------------------------------------

function ConnectedTab({ items }: { items: ConnectionItem[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const disconnect = useMutation({
    mutationFn: (connectionId: string) => disconnectConnection({ data: { connectionId } }),
    onSuccess: () => {
      toast.success(t("connections.toast_disconnected"));
      void queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.startsWith("connections.") ? t(message) : t("connections.error.save_failed"),
      );
    },
  });

  const connected = items.filter((i) => i.status === "ACCEPTED");
  if (connected.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
        body={t("connections.empty_connected")}
      />
    );
  }

  return (
    <ul className="space-y-3">
      {connected.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-card p-4"
        >
          <TutorAvatar tutor={item.counterpart} />
          <TutorLine tutor={item.counterpart} />
          <IntentChip tag={item.intentTag} />
          <div className="flex items-center gap-2">
            {/* Child B owns the messaging thread — disabled placeholder for V1. */}
            <Button
              variant="outline"
              size="sm"
              disabled
              title={t("connections.message_soon")}
              className="font-semibold"
            >
              <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
              {t("connections.message")}
            </Button>
            {confirmingId === item.id ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-semibold text-destructive"
                  disabled={disconnect.isPending}
                  onClick={() => disconnect.mutate(item.id)}
                >
                  {t("connections.disconnect_confirm")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>
                  {t("connections.cancel")}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="font-semibold text-muted-foreground"
                onClick={() => setConfirmingId(item.id)}
              >
                {t("connections.disconnect")}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Pending tab
// ---------------------------------------------------------------------------

function PendingTab({ items }: { items: ConnectionItem[] }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const respond = useMutation({
    mutationFn: (input: { connectionId: string; action: "accept" | "decline" }) =>
      respondToConnection({ data: input }),
    onSuccess: (result, variables) => {
      if (result.status === "ACCEPTED") {
        toast.success(t("connections.toast_accepted_generic"));
      } else {
        toast.success(t("connections.toast_declined"));
      }
      void queryClient.invalidateQueries({ queryKey: ["connections"] });
      void variables;
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.startsWith("connections.") ? t(message) : t("connections.error.save_failed"),
      );
    },
  });

  const inbound = items.filter((i) => i.status === "PENDING" && i.direction === "inbound");
  const outboundPending = items.filter((i) => i.status === "PENDING" && i.direction === "outbound");
  const outboundDeclined = items.filter(
    (i) =>
      i.status === "DECLINED" &&
      i.direction === "outbound" &&
      i.cooldownUntil !== null &&
      Date.parse(i.cooldownUntil) > Date.now(),
  );

  if (inbound.length + outboundPending.length + outboundDeclined.length === 0) {
    return (
      <EmptyState
        icon={<UserRoundPlus className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
        body={t("connections.empty_pending")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {inbound.length > 0 ? (
        <section>
          <h2 className="text-sm font-bold text-[color:var(--ink)]">
            {t("connections.direction_inbound")}
          </h2>
          <ul className="mt-2 space-y-3">
            {inbound.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-card p-4"
              >
                <TutorAvatar tutor={item.counterpart} />
                <TutorLine tutor={item.counterpart} />
                <IntentChip tag={item.intentTag} />
                <div className="flex items-center gap-2">
                  <Button
                    variant="solid"
                    color="blue"
                    size="sm"
                    className="font-bold"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ connectionId: item.id, action: "accept" })}
                  >
                    {t("connections.accept")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-semibold"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ connectionId: item.id, action: "decline" })}
                  >
                    {t("connections.decline")}
                  </Button>
                </div>
                {item.introNote ? (
                  <p className="w-full border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
                    “{renderSanitizedNote(item.introNote, t("connections.contact_hidden"))}”
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {outboundPending.length > 0 ? (
        <section>
          <h2 className="text-sm font-bold text-[color:var(--ink)]">
            {t("connections.direction_outbound")}
          </h2>
          <ul className="mt-2 space-y-3">
            {outboundPending.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-card p-4"
              >
                <TutorAvatar tutor={item.counterpart} />
                <TutorLine tutor={item.counterpart} />
                <IntentChip tag={item.intentTag} />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  {t("connections.waiting")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {outboundDeclined.length > 0 ? (
        <section>
          <h2 className="text-sm font-bold text-[color:var(--ink)]">
            {t("connections.direction_outbound")}
          </h2>
          <ul className="mt-2 space-y-3">
            {outboundDeclined.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-card p-4 opacity-70"
              >
                <TutorAvatar tutor={item.counterpart} />
                <TutorLine tutor={item.counterpart} />
                <span className="inline-flex items-center rounded-full bg-[color:var(--foreground)]/[0.06] px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {t("connections.declined_until", {
                    date: new Date(item.cooldownUntil ?? "").toLocaleDateString(
                      i18n.language === "zh" || i18n.language.startsWith("zh") ? "zh-HK" : "en-HK",
                    ),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Find Tutors tab
// ---------------------------------------------------------------------------

function FindTab({
  subject,
  curriculum,
  district,
  intent,
}: {
  subject?: string;
  curriculum?: string;
  district?: string;
  intent?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [modalTarget, setModalTarget] = useState<ConnectionFindTutor | null>(null);

  const findQuery = useQuery({
    queryKey: [
      "connections",
      "find",
      subject ?? "",
      curriculum ?? "",
      district ?? "",
      intent ?? "",
    ],
    queryFn: () =>
      listConnectableTutors({
        data: {
          subject: subject || undefined,
          curriculum: curriculum || undefined,
          district: district || undefined,
          intentTag: intent || undefined,
        },
      }),
    staleTime: 30_000,
  });

  function setFilter(key: "subject" | "curriculum" | "district" | "intent", value: string) {
    void navigate({
      to: "/account/connections",
      search: (prev: Record<string, unknown>) => ({ ...prev, [key]: value || undefined }),
    });
  }

  const tutors = findQuery.data?.tutors ?? [];

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SearchableSelect
          value={subject ?? ""}
          onChange={(v) => setFilter("subject", v)}
          options={DEFAULT_SUBJECT_OPTIONS}
          placeholder={t("connections.filter_subject")}
          searchPlaceholder={t("connections.filter_subject")}
        />
        <SearchableSelect
          value={curriculum ?? ""}
          onChange={(v) => setFilter("curriculum", v)}
          options={CURRICULUM_OPTIONS.map((c) => ({
            value: c,
            label: t(`connections.curriculum_${c.replace("-", "_")}`),
          }))}
          placeholder={t("connections.filter_curriculum")}
        />
        <SearchableSelect
          value={district ?? ""}
          onChange={(v) => setFilter("district", v)}
          options={HK_DISTRICTS}
          placeholder={t("connections.filter_district")}
          searchPlaceholder={t("connections.filter_district")}
        />
        <SearchableSelect
          value={intent ?? ""}
          onChange={(v) => setFilter("intent", v)}
          options={[
            ...CONNECT_INTENT_TAGS.map((tag) => ({
              value: tag,
              label: t(`connections.intent_${tag}`),
            })),
          ]}
          placeholder={t("connections.filter_intent")}
        />
      </div>
      {intent ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("connections.filter_intent_hint")}</p>
      ) : null}

      <div className="mt-4">
        {findQuery.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : tutors.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
            body={t("connections.empty_find")}
          />
        ) : (
          <ul className="space-y-3">
            {tutors.map((tutor) => {
              const edgeBlocked =
                tutor.viewerStatus === "ACCEPTED" ||
                tutor.viewerStatus === "PENDING" ||
                tutor.viewerStatus === "BLOCKED";
              return (
                <li
                  key={tutor.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-card p-4"
                >
                  <TutorAvatar tutor={tutor} />
                  <TutorLine tutor={tutor} />
                  {tutor.curricula.length > 0 ? (
                    <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:inline">
                      {tutor.curricula.slice(0, 3).join(" · ")}
                    </span>
                  ) : null}
                  <div>
                    {edgeBlocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="font-semibold"
                        title={
                          tutor.viewerStatus === "PENDING"
                            ? t("connections.requested")
                            : t("connections.connected_label")
                        }
                      >
                        <CalendarDays className="mr-2 h-4 w-4" aria-hidden />
                        {tutor.viewerStatus === "PENDING"
                          ? t("connections.requested")
                          : t("connections.connected_label")}
                      </Button>
                    ) : (
                      <Button
                        variant="solid"
                        color="blue"
                        size="sm"
                        className="font-bold"
                        onClick={() => setModalTarget(tutor)}
                      >
                        <UserRoundPlus className="mr-2 h-4 w-4" aria-hidden />
                        {t("connections.connect")}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConnectRequestModal
        target={modalTarget ? { id: modalTarget.id, display_name: modalTarget.display_name } : null}
        open={modalTarget !== null}
        onOpenChange={(open) => {
          if (!open) setModalTarget(null);
        }}
        preselectedIntent={intent as ConnectIntentTag | undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmptyState({ icon, body }: { icon: React.ReactNode; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
      {icon}
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
