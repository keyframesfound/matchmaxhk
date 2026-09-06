import { Users, ShieldCheck, GraduationCap, UserCheck, Activity } from "lucide-react";
import type { AppRole } from "@/features/auth/useAuth";

export type UserRow = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  roles: AppRole[];
  created_at?: string | null;
};

interface UserStatsOverviewProps {
  users: UserRow[];
  isLoading?: boolean;
}

export function UserStatsOverview({ users, isLoading }: UserStatsOverviewProps) {
  const totalUsers = users.length;
  const adminStaffCount = users.filter((u) =>
    u.roles.some((r) => r === "super_admin" || r === "admin" || r === "staff"),
  ).length;
  const tutorCount = users.filter((u) => u.roles.includes("tutor")).length;
  const parentCount = users.filter((u) => u.roles.includes("parent")).length;

  const adminPct = totalUsers ? Math.round((adminStaffCount / totalUsers) * 100) : 0;
  const tutorPct = totalUsers ? Math.round((tutorCount / totalUsers) * 100) : 0;
  const parentPct = totalUsers ? Math.round((parentCount / totalUsers) * 100) : 0;

  const stats = [
    {
      title: "Total Registered Users",
      value: isLoading ? "—" : totalUsers.toLocaleString(),
      subtitle: "Active user accounts",
      icon: Users,
      color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
      barColor: "bg-blue-500",
      pct: 100,
    },
    {
      title: "Admins & Staff",
      value: isLoading ? "—" : adminStaffCount.toLocaleString(),
      subtitle: `${adminPct}% of user base`,
      icon: ShieldCheck,
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      barColor: "bg-indigo-500",
      pct: adminPct,
    },
    {
      title: "Verified Tutors",
      value: isLoading ? "—" : tutorCount.toLocaleString(),
      subtitle: `${tutorPct}% of user base`,
      icon: GraduationCap,
      color:
        "text-[color:var(--foreground)] bg-[color:var(--foreground)]/[0.06] border-[color:var(--foreground)]/15",
      barColor: "bg-[color:var(--brand-teal)]",
      pct: tutorPct,
    },
    {
      title: "Parents & Clients",
      value: isLoading ? "—" : parentCount.toLocaleString(),
      subtitle: `${parentPct}% of user base`,
      icon: UserCheck,
      color: "text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20",
      barColor: "bg-slate-500",
      pct: parentPct,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={i}
            className="group relative overflow-hidden rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-all duration-200 hover:border-border hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.title}
              </span>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg border ${stat.color} transition-transform duration-200 group-hover:scale-105`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black tracking-tight text-[color:var(--ink)]">
                {stat.value}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Activity className="h-3 w-3 opacity-60" />
                {stat.subtitle}
              </span>
            </div>

            {/* Visual ratio bar */}
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className={`h-full ${stat.barColor} transition-all duration-500`}
                style={{ width: `${Math.max(stat.pct, 4)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
