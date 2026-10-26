import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  Flag,
  GraduationCap,
  Inbox,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/useAuth";
import { formatPostedAgo } from "@/lib/relative-time";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — MatchMax" },
      {
        name: "description",
        content: "Queues, demand and platform stats for the MatchMax admin console.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOverview,
});

/* ── data ──────────────────────────────────────────────────────────────── */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CASE_REVIEW_SLA_MS = 48 * 60 * 60 * 1000;

type HeadFilter = { column: string; op: "eq" | "gte"; value: string };

type LooseResult = { data: unknown; count: number | null; error: { message: string } | null };
type LooseQuery = {
  select: (columns: string, options?: { count: "exact"; head: boolean }) => LooseQuery;
  eq: (column: string, value: string | boolean) => LooseQuery;
  gte: (column: string, value: string) => LooseQuery;
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
  limit: (count: number) => LooseQuery;
  then<TResult1 = LooseResult, TResult2 = never>(
    onfulfilled?: ((value: LooseResult) => TResult1 | PromiseLike<TResult1>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

/* This overview queries several relations in one helper and two of them
 * (reports, case_fees) are not modeled in the generated supabase types yet,
 * so it goes through a minimal query surface instead of the typed client. */
const fromAny = supabase.from as unknown as (relation: string) => LooseQuery;

async function headCount(table: string, filters: HeadFilter[] = []): Promise<number> {
  let query = fromAny(table).select("*", { count: "exact", head: true });
  for (const filter of filters) {
    query =
      filter.op === "gte"
        ? query.gte(filter.column, filter.value)
        : query.eq(filter.column, filter.value);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

type JoinRequestRow = { id: string; data: unknown; created_at: string };
type ReportRow = {
  id: string;
  target_type: string;
  reason: string;
  created_at: string;
};
type CaseRow = { id: string; case_code: string; title: string; created_at: string };
type FeeRow = {
  id: string;
  amount_hkd: number;
  due_at: string | null;
  created_at: string;
  tutoring_cases: { case_code: string } | { case_code: string }[] | null;
};
type RecentTutorRow = { id: string; display_name: string | null; created_at: string };

export type ActivityKind = "join" | "case" | "report" | "tutor";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  actor: string;
  detail: string;
  createdAt: string;
};

export type Overview = {
  tutors: number;
  cases: number;
  users: number;
  newTutors: number;
  newCases: number;
  newUsers: number;
  joinRequestCount: number;
  reportCount: number;
  reviewCaseCount: number;
  joinRequests: ActivityItem[];
  reports: ActivityItem[];
  reviewCases: (ActivityItem & { breach: boolean })[];
  fees: { id: string; caseCode: string; amountHkd: number; createdAt: string }[];
  feeTotalHkd: number;
  activity: ActivityItem[];
};

async function selectAs<T>(query: LooseQuery, columns: string): Promise<T[]> {
  const { data, error } = await query.select(columns);
  if (error) throw error;
  return (data ?? []) as T[];
}

async function fetchOverview(): Promise<Overview> {
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();

  const [
    tutors,
    cases,
    users,
    newTutors,
    newCases,
    newUsers,
    joinRequestCount,
    reportCount,
    reviewCaseCount,
    joinRequestRows,
    reportRows,
    caseRows,
    feeRows,
    tutorRows,
  ] = await Promise.all([
    headCount("tutors"),
    headCount("tutoring_cases"),
    headCount("profiles"),
    headCount("tutors", [{ column: "created_at", op: "gte", value: weekAgo }]),
    headCount("tutoring_cases", [{ column: "created_at", op: "gte", value: weekAgo }]),
    headCount("profiles", [{ column: "created_at", op: "gte", value: weekAgo }]),
    headCount("tutor_applications", [{ column: "status", op: "eq", value: "pending" }]),
    headCount("reports", [{ column: "status", op: "eq", value: "open" }]),
    headCount("tutoring_cases", [{ column: "status", op: "eq", value: "new" }]),
    selectAs<JoinRequestRow>(
      fromAny("tutor_applications")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3),
      "id, data, created_at",
    ),
    selectAs<ReportRow>(
      fromAny("reports").eq("status", "open").order("created_at", { ascending: false }).limit(3),
      "id, target_type, reason, created_at",
    ),
    selectAs<CaseRow>(
      fromAny("tutoring_cases")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(3),
      "id, case_code, title, created_at",
    ),
    selectAs<FeeRow>(
      fromAny("case_fees").eq("status", "invoiced").order("created_at", { ascending: false }),
      "id, amount_hkd, due_at, created_at, tutoring_cases(case_code)",
    ),
    selectAs<RecentTutorRow>(
      fromAny("tutors").eq("is_published", true).order("created_at", { ascending: false }).limit(3),
      "id, display_name, created_at",
    ),
  ]);

  const joinRequests: ActivityItem[] = joinRequestRows.map((row) => ({
    id: row.id,
    kind: "join",
    actor: (row.data as { name?: string } | null)?.name?.trim() || "Tutor application",
    detail: "requested to join as tutor",
    createdAt: row.created_at,
  }));

  const reports: ActivityItem[] = reportRows.map((row) => ({
    id: row.id,
    kind: "report",
    actor: row.target_type.replace(/_/g, " "),
    detail: `reported — reason: ${row.reason}`,
    createdAt: row.created_at,
  }));

  const reviewCases = caseRows.map((row) => ({
    id: row.id,
    kind: "case" as const,
    actor: row.case_code,
    detail: row.title,
    createdAt: row.created_at,
    breach: Date.now() - new Date(row.created_at).getTime() > CASE_REVIEW_SLA_MS,
  }));

  const fees = feeRows.map((row) => {
    const embedded = Array.isArray(row.tutoring_cases) ? row.tutoring_cases[0] : row.tutoring_cases;
    return {
      id: row.id,
      caseCode: embedded?.case_code ?? "—",
      amountHkd: Number(row.amount_hkd),
      createdAt: row.created_at,
    };
  });

  const recentTutors: ActivityItem[] = tutorRows.map((row) => ({
    id: row.id,
    kind: "tutor",
    actor: row.display_name ?? "Tutor",
    detail: "published a tutor profile",
    createdAt: row.created_at,
  }));

  const activity = [...joinRequests, ...reports, ...reviewCases, ...recentTutors].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    tutors,
    cases,
    users,
    newTutors,
    newCases,
    newUsers,
    joinRequestCount,
    reportCount,
    reviewCaseCount,
    joinRequests,
    reports,
    reviewCases,
    fees,
    feeTotalHkd: fees.reduce((sum, fee) => sum + fee.amountHkd, 0),
    activity: activity.slice(0, 8),
  };
}

/* Engagement events are RLS-deny; read through the admin-only RPC instead. */
type Engagement = {
  days: { day: string; views: number }[];
  totals: { views: number; inquiries: number; requests: number };
  prev: { views: number; inquiries: number; requests: number };
  unique_viewers: number;
};

async function fetchEngagement(): Promise<Engagement | null> {
  const rpc = supabase.rpc.bind(supabase) as (
    fn: string,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("admin_engagement_overview");
  // Migration not applied yet (or non-admin caller) — the panel degrades
  // to an unavailable state instead of failing the whole overview.
  if (error) return null;
  return data as Engagement;
}

/* ── page ──────────────────────────────────────────────────────────────── */

function pctChange(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}%`;
}

function AdminOverview() {
  const { user } = useAuth();
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: fetchOverview,
    refetchInterval: 60_000,
  });
  const engagement = useQuery({
    queryKey: ["admin", "overview", "engagement"],
    queryFn: fetchEngagement,
    refetchInterval: 60_000,
  });

  const data = overview.data;
  const firstName = user?.user_metadata.display_name?.trim().split(" ")[0];

  const slaBreaches = data?.reviewCases.filter((item) => item.breach).length ?? 0;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const hide = (key: string) => setDismissed((prev) => new Set(prev).add(key));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {firstName ? `Welcome back, ${firstName}` : "Admin overview"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? (
              <>
                Today you have{" "}
                <span className="font-semibold text-foreground">
                  {data.joinRequestCount} join requests
                </span>
                ,{" "}
                <span className="font-semibold text-foreground">{data.reviewCaseCount} cases</span>{" "}
                to review and{" "}
                <span className="font-semibold text-foreground">
                  {data.reportCount} open reports
                </span>
                .
              </>
            ) : (
              <Skeleton className="h-4 w-80" />
            )}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/join-requests" search={{ application: undefined }}>
            Review queue
            <ArrowRight className="ml-1.5 size-4" />
          </Link>
        </Button>
      </div>

      {/* alerts (only when there is something real to say) */}
      {data && slaBreaches > 0 && !dismissed.has("sla") && (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>
            {slaBreaches} case{slaBreaches > 1 ? "s" : ""} past the 48h review SLA
          </AlertTitle>
          <AlertDescription>
            Oldest is{" "}
            {formatPostedAgo(data.reviewCases.find((item) => item.breach)?.createdAt ?? "")}.
            <button
              type="button"
              className="ml-2 font-medium underline-offset-2 hover:underline"
              onClick={() => hide("sla")}
            >
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}
      {data && data.feeTotalHkd > 0 && !dismissed.has("fees") && (
        <Alert>
          <Wallet className="size-4" />
          <AlertTitle>
            {data.fees.length} admin fee invoice{data.fees.length > 1 ? "s" : ""} awaiting payment —
            HK${data.feeTotalHkd.toLocaleString()} outstanding
          </AlertTitle>
          <AlertDescription>
            Oldest was invoiced {formatPostedAgo(data.fees[data.fees.length - 1].createdAt)}.
            <button
              type="button"
              className="ml-2 font-medium underline-offset-2 hover:underline"
              onClick={() => hide("fees")}
            >
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={GraduationCap}
          label="Tutors live"
          value={data?.tutors}
          badge={
            data && data.newTutors > 0
              ? { icon: TrendingUp, text: `+${data.newTutors} this week` }
              : undefined
          }
          to="/admin/tutors"
        />
        <StatCard
          icon={ClipboardList}
          label="Active cases"
          value={data?.cases}
          badge={
            data && data.newCases > 0
              ? { icon: TrendingUp, text: `+${data.newCases} this week` }
              : undefined
          }
          to="/admin/cases"
        />
        <StatCard
          icon={Users}
          label="New users · 7 days"
          value={data?.newUsers}
          badge={data ? { icon: Users, text: `${data.users} registered` } : undefined}
          to="/admin/users"
        />
        <StatCard
          icon={Wallet}
          label="Unpaid admin fees"
          value={data ? `HK$${data.feeTotalHkd.toLocaleString()}` : undefined}
          badge={
            data && data.fees.length > 0
              ? { icon: TriangleAlert, text: `${data.fees.length} invoices open`, danger: true }
              : data
                ? { icon: TrendingUp, text: "All settled" }
                : undefined
          }
          to="/admin/cases"
        />
      </div>

      {/* demand + funnel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DemandCard engagement={engagement.data} loading={engagement.isLoading} />
        <FunnelCard engagement={engagement.data} loading={engagement.isLoading} />
      </div>

      {/* needs attention */}
      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-base font-semibold tracking-tight">Needs attention</h2>
          <span className="text-xs text-muted-foreground">4 queues · freshest items first</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueueCard
            icon={UserPlus}
            title="Join requests"
            count={data?.joinRequestCount}
            items={data?.joinRequests}
            to="/admin/join-requests"
            footer="Review queue"
          />
          <QueueCard
            icon={ClipboardList}
            title="Cases to review"
            count={data?.reviewCaseCount}
            items={data?.reviewCases}
            to="/admin/cases"
            footer="Review queue"
          />
          <QueueCard
            icon={Flag}
            title="Open reports"
            count={data?.reportCount}
            items={data?.reports}
            to="/admin/reports"
            footer="Review queue"
          />
          <FeesQueueCard fees={data?.fees} count={data?.fees.length} totalHkd={data?.feeTotalHkd} />
        </div>
      </section>

      {/* activity + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityCard items={data?.activity} loading={overview.isLoading} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Frequent admin tasks</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {[
              { label: "Review pending cases", to: "/admin/cases" },
              { label: "Approve join requests", to: "/admin/join-requests" },
              { label: "Verify grades", to: "/admin/grades" },
              { label: "Moderate reports", to: "/admin/reports" },
              { label: "Manage tutors", to: "/admin/tutors" },
              { label: "Site settings", to: "/admin/settings" },
            ].map((action) => (
              <Link
                key={action.to + action.label}
                to={action.to}
                className="flex items-center justify-between rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {action.label}
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── pieces ────────────────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  badge,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | number;
  badge?: { icon: LucideIcon; text: string; danger?: boolean };
  to: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-xl border bg-card text-card-foreground transition-colors hover:border-muted-foreground/30"
    >
      <CardContent className="flex flex-col gap-1 px-5 py-5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="size-4 text-muted-foreground/70" />
          {label}
        </div>
        <div className="text-2xl font-bold tracking-tight">
          {value === undefined ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            (value.toLocaleString?.() ?? value)
          )}
        </div>
        {badge && (
          <span
            className={`mt-1 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              badge.danger ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
            }`}
          >
            <badge.icon className="size-3" />
            {badge.text}
          </span>
        )}
      </CardContent>
    </Link>
  );
}

const chartConfig = {
  views: { label: "Profile views", color: "var(--chart-1)" },
} satisfies ChartConfig;

function DemandCard({
  engagement,
  loading,
}: {
  engagement: Engagement | null | undefined;
  loading: boolean;
}) {
  const days = engagement?.days.slice(-7).map((entry) => ({
    ...entry,
    label: new Date(`${entry.day}T00:00:00Z`).toLocaleDateString("en-GB", {
      weekday: "short",
      timeZone: "UTC",
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Demand — tutor engagement</CardTitle>
        <CardDescription>Profile views per day, last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-44 w-full" />
        ) : !engagement || !days ? (
          <EmptyAnalytics />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 pb-2">
              <Metric label="Unique viewers (14d)" value={engagement.unique_viewers} />
              <Metric label="Profile views (14d)" value={engagement.totals.views} />
              <Metric label="Inquiries (14d)" value={engagement.totals.inquiries} />
            </div>
            <ChartContainer config={chartConfig} className="h-40 w-full">
              <BarChart data={days}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Bar dataKey="views" fill="var(--color-views)" radius={4} />
              </BarChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelCard({
  engagement,
  loading,
}: {
  engagement: Engagement | null | undefined;
  loading: boolean;
}) {
  const totals = engagement?.totals;
  const rate =
    totals && totals.views > 0 ? `${((totals.inquiries / totals.views) * 100).toFixed(1)}%` : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversion funnel</CardTitle>
        <CardDescription>View → inquiry → request, last 14 days</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !totals ? (
          <EmptyAnalytics />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight">{rate ?? "—"}</span>
              <span className="text-sm text-muted-foreground">inquiry rate</span>
              {rateChange(engagement) && (
                <Badge variant="secondary" className="ml-auto">
                  <TrendingUp className="size-3" />
                  {rateChange(engagement)}
                </Badge>
              )}
            </div>
            <FunnelRow
              label="Profile views"
              value={totals.views}
              delta={pctChange(totals.views, engagement?.prev.views ?? 0)}
            />
            <FunnelRow
              label="Inquiry clicks"
              value={totals.inquiries}
              delta={pctChange(totals.inquiries, engagement?.prev.inquiries ?? 0)}
            />
            <FunnelRow
              label="Request clicks"
              value={totals.requests}
              delta={pctChange(totals.requests, engagement?.prev.requests ?? 0)}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function rateChange(engagement: Engagement | null | undefined): string | null {
  if (!engagement) return null;
  const current =
    engagement.totals.views > 0 ? engagement.totals.inquiries / engagement.totals.views : 0;
  const previous =
    engagement.prev.views > 0 ? engagement.prev.inquiries / engagement.prev.views : 0;
  if (previous <= 0) return null;
  const pts = Math.round((current - previous) * 100);
  return `${pts >= 0 ? "+" : "−"}${Math.abs(pts)} pts vs prev week`;
}

function FunnelRow({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: string | null;
}) {
  return (
    <div className="flex items-center justify-between border-t pt-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-semibold">
        {value.toLocaleString()}
        {delta && <span className="text-xs font-medium text-muted-foreground">{delta}</span>}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col">
      <span className="text-lg font-bold leading-tight tracking-tight">
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

function EmptyAnalytics() {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-center">
      <Inbox className="size-5 text-muted-foreground/60" />
      <p className="text-sm font-medium">Engagement analytics unavailable</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        The admin_engagement_overview RPC is not applied yet. Apply the 20261026120000 migration to
        enable this panel.
      </p>
    </div>
  );
}

function QueueCard({
  icon: Icon,
  title,
  count,
  items,
  to,
  footer,
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  items?: (ActivityItem & { breach?: boolean })[];
  to: string;
  footer: string;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
        <Icon className="size-4 text-muted-foreground" />
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {count}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-0 pt-0">
        {items === undefined ? (
          <div className="flex flex-col gap-2 py-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">Nothing waiting.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 border-t py-2 text-sm first:border-t-0"
            >
              <span
                className={`min-w-0 flex-1 truncate ${item.breach ? "font-semibold text-destructive" : ""}`}
              >
                {item.actor}
                <span className="font-normal text-muted-foreground"> · {item.detail}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatPostedAgo(item.createdAt)}
              </span>
            </div>
          ))
        )}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mt-auto w-fit px-2 text-muted-foreground"
        >
          <Link to={to}>
            {footer}
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function FeesQueueCard({
  fees,
  count,
  totalHkd,
}: {
  fees?: { id: string; caseCode: string; amountHkd: number; createdAt: string }[];
  count?: number;
  totalHkd?: number;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
        <Wallet className="size-4 text-muted-foreground" />
        <CardTitle className="text-sm font-semibold">Unpaid admin fees</CardTitle>
        {count !== undefined && count > 0 && (
          <Badge variant="destructive" className="ml-auto">
            {count}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-0 pt-0">
        {fees === undefined ? (
          <div className="flex flex-col gap-2 py-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : fees.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">All fees settled.</p>
        ) : (
          <>
            <p className="py-1 text-xl font-bold tracking-tight">
              HK${(totalHkd ?? 0).toLocaleString()}
            </p>
            {fees.slice(0, 3).map((fee) => (
              <div
                key={fee.id}
                className="flex items-center gap-2 border-t py-2 text-sm first:border-t-0"
              >
                <span className="min-w-0 flex-1 truncate">
                  {fee.caseCode}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · invoiced {formatPostedAgo(fee.createdAt)}
                  </span>
                </span>
                <span className="shrink-0 font-medium">HK${fee.amountHkd.toLocaleString()}</span>
              </div>
            ))}
          </>
        )}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mt-auto w-fit px-2 text-muted-foreground"
        >
          <Link to="/admin/cases">
            Chase list
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const ACTIVITY_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "join", label: "Joins" },
  { value: "case", label: "Cases" },
  { value: "report", label: "Reports" },
  { value: "tutor", label: "Tutors" },
];

function ActivityCard({ items, loading }: { items?: ActivityItem[]; loading: boolean }) {
  const [tab, setTab] = useState("all");
  const visible = items?.filter((item) => tab === "all" || item.kind === tab) ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-start space-y-0">
        <div>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>Platform events, newest first</CardDescription>
        </div>
        <Tabs value={tab} onValueChange={setTab} className="ml-auto">
          <TabsList>
            {ACTIVITY_TABS.map((entry) => (
              <TabsTrigger key={entry.value} value={entry.value} className="px-2.5">
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent events.</p>
        ) : (
          visible.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className="flex items-center gap-2.5 border-b py-2.5 text-sm last:border-b-0"
            >
              <Badge
                variant={item.kind === "report" || item.kind === "case" ? "outline" : "secondary"}
                className="w-[4.5rem] shrink-0 justify-center"
              >
                {ACTIVITY_TABS.find((entry) => entry.value === item.kind)?.label}
              </Badge>
              <p className="min-w-0 flex-1 truncate text-muted-foreground">
                <span className="font-semibold text-foreground">{item.actor}</span> {item.detail}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatPostedAgo(item.createdAt)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
