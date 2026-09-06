import { Shield, Check, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROLE_DEFINITIONS } from "@/features/auth/roleLabel";
import type { UserRow } from "./UserStatsOverview";

interface RolesMatrixTabProps {
  users: UserRow[];
}

export function RolesMatrixTab({ users }: RolesMatrixTabProps) {
  // Count users per role
  const countByRole = ROLE_DEFINITIONS.reduce(
    (acc, def) => {
      acc[def.role] = users.filter((u) => u.roles.includes(def.role)).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-[color:var(--ink)]">
            Roles & Capabilities Matrix
          </h3>
          <p className="text-xs text-muted-foreground">
            Overview of platform role definitions, assigned counts, and security privileges.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          <span>Role updates enforced via Supabase RLS</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ROLE_DEFINITIONS.map((def) => {
          const userCount = countByRole[def.role] ?? 0;

          return (
            <div
              key={def.role}
              className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-all duration-200 hover:border-border hover:shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className={`text-xs font-bold ${def.badgeStyle}`}>
                    <Shield className="mr-1 h-3 w-3" />
                    {def.title}
                  </Badge>
                  <span className="rounded-full bg-muted/80 px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {userCount} {userCount === 1 ? "User" : "Users"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{def.description}</p>

                <div className="border-t border-border/50 pt-3">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Capabilities
                  </span>
                  <ul className="mt-2 space-y-1.5 text-xs text-[color:var(--ink)]">
                    {def.capabilities.map((cap, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 border-t border-border/40 pt-3 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                <span>
                  Slug: <code className="text-xs">{def.role}</code>
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground/80">
                  {def.role === "super_admin" ? "System Core" : "Application Role"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
