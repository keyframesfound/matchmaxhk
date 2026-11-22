import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConsolePanel } from "@/components/ui/console-panel";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  findAccountForGrant,
  grantMaterialsToImpactAccount,
  setImpactAccount,
  type AccountHit,
} from "@/features/impact/impact-grants.functions";
import { listAllMaterialsAdmin } from "@/features/materials/materials.functions";
import { cn } from "@/lib/utils";

/** Same 300 ms window as the Impact desk search and the tutor editor typeahead. */
const SEARCH_DEBOUNCE_MS = 300;
/** The server rejects a shorter account query, so the input must too. */
const MIN_QUERY_LENGTH = 2;
/** Matches the server validator's cap; the reason is stored on every order row. */
const MAX_REASON_LENGTH = 500;
const MIN_REASON_LENGTH = 3;
/** Also the server's `materialIds` max: one grant is one bounded batch. */
const MAX_SELECTION = 50;

/**
 * #794 AC-400-4, second clause, the desk screen: hand specific published shop
 * packs to one Impact account at HK$0. The grant itself is #250's engine
 * (`staffGrantMaterialsCore`): a delivered `material_orders` row per pack with
 * `is_grant`, excluded from the payout export, and a DB CHECK keeps it at HK$0.
 * This panel chooses the account, the packs and the reason.
 *
 * The Impact requirement is enforced by `grantMaterialsToImpactAccount`
 * server-side, which reads `profiles.impact_account` before delegating to the
 * grant core. The disabled button here only fails fast; it is not the gate.
 * English-only staff copy, like the rest of the desk panels.
 */
export function ImpactShopGrantPanel() {
  const queryClient = useQueryClient();
  const searchId = useId();
  const filterId = useId();
  const reasonId = useId();
  const impactSwitchId = useId();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<AccountHit | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Shared with the listing table above, so publishing a pack here is reflected
  // without a second fetch.
  const materialsQuery = useQuery({
    queryKey: ["admin", "materials"],
    queryFn: () => listAllMaterialsAdmin(),
  });

  const hits = useQuery({
    queryKey: ["impact-account-search", debounced],
    queryFn: () => findAccountForGrant({ data: { query: debounced } }),
    enabled: debounced.length >= MIN_QUERY_LENGTH,
  });

  const impact = useMutation({
    mutationFn: (input: { userId: string; impact: boolean }) => setImpactAccount({ data: input }),
    onSuccess: (_result, input) => {
      setPicked((current) =>
        current && current.id === input.userId
          ? { ...current, impactAccount: input.impact }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["impact-account-search"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const published = useMemo(
    () => (materialsQuery.data ?? []).filter((row) => row.status === "published"),
    [materialsQuery.data],
  );

  const publishedIds = useMemo(() => new Set(published.map((row) => row.id)), [published]);

  // A pack can be unpublished between selection and submit; drop it from the
  // payload rather than sending an id the engine will refuse.
  const effectiveIds = selectedIds.filter((id) => publishedIds.has(id));

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return published;
    return published.filter((row) => {
      const tutor = row.tutors?.display_name ?? "";
      return row.title.toLowerCase().includes(needle) || tutor.toLowerCase().includes(needle);
    });
  }, [published, filter]);

  const grant = useMutation({
    mutationFn: (input: { buyerAccountId: string; materialIds: string[]; reason: string }) =>
      grantMaterialsToImpactAccount({ data: input }),
    onSuccess: (result) => {
      const count = result.granted;
      toast.success(count === 1 ? "1 pack granted at HK$0." : `${count} packs granted at HK$0.`);
      setSelectedIds([]);
      setReason("");
    },
    onError: (e: Error) => {
      const message = e.message;
      if (message === "NOT_IMPACT") {
        // The server is the gate, so trust it over the row we rendered and put
        // the switch back in front of the desk.
        setPicked((current) => (current ? { ...current, impactAccount: false } : current));
        toast.error("Mark the account as Impact first.");
      } else if (message === "ACCOUNT_NOT_FOUND") {
        setPicked(null);
        toast.error("That account could not be found. Search again.");
      } else if (message === "FORBIDDEN") {
        toast.error("You do not have staff access for this grant.");
      } else if (/duplicate key|23505|already unlocked|already holds/i.test(message)) {
        toast.error("That account already holds one of these items.");
      } else if (/not published|no longer published|unpublished/i.test(message)) {
        toast.error("One or more packs are no longer published.");
      } else {
        toast.error(message);
      }
    },
  });

  const results = debounced.length >= MIN_QUERY_LENGTH ? (hits.data ?? []) : [];
  const atCap = effectiveIds.length >= MAX_SELECTION;
  const ready =
    picked !== null &&
    picked.impactAccount &&
    effectiveIds.length > 0 &&
    reason.trim().length >= MIN_REASON_LENGTH;

  const toggleItem = (materialId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(materialId) || current.length >= MAX_SELECTION) return current;
        return [...current, materialId];
      }
      return current.filter((id) => id !== materialId);
    });
  };

  return (
    <ConsolePanel>
      <h2 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Gift className="h-3.5 w-3.5" aria-hidden="true" />
        Impact: $0 shop grant
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        A grant writes a delivered HK$0 order for each pack. It never appears in a tutor payout.
      </p>

      {/* Step 1, the account. */}
      <div className="mt-4 border-t border-[color:var(--ink)]/10 pt-4">
        <label htmlFor={searchId} className="text-[11px] font-medium text-muted-foreground">
          1. Account
        </label>
        <Input
          id={searchId}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name"
          autoComplete="off"
          className="mt-1 h-9 text-sm"
        />
        {search.trim().length === 1 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Type at least 2 characters.</p>
        ) : null}

        {results.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {results.map((hit) => {
              const selected = picked?.id === hit.id;
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPicked(hit)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors motion-reduce:transition-none",
                      selected
                        ? "border-[color:var(--ink)]/30 bg-[color:var(--foreground)]/[0.04]"
                        : "border-[color:var(--ink)]/10 hover:bg-[color:var(--foreground)]/[0.03]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[color:var(--ink)]">
                        {hit.email ?? "No email"}
                      </span>
                      {hit.displayName ? (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {hit.displayName}
                        </span>
                      ) : null}
                    </span>
                    {hit.impactAccount ? (
                      <span className="shrink-0 rounded-full border border-[color:var(--ink)]/15 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Impact account
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : debounced.length >= MIN_QUERY_LENGTH && hits.isSuccess ? (
          <p className="mt-2 text-[11px] text-muted-foreground">No account matches that search.</p>
        ) : null}

        {picked ? (
          <div className="mt-3 rounded-lg border border-[color:var(--ink)]/15 bg-[color:var(--foreground)]/[0.04] px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--ink)]">
                Granting to {picked.email ?? picked.displayName ?? "this account"}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => setPicked(null)}
              >
                Clear
              </Button>
            </div>

            {picked.impactAccount ? null : (
              <div className="mt-2 border-t border-[color:var(--ink)]/10 pt-2">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  This is not an Impact account. Mark the account as Impact first.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <label
                    htmlFor={impactSwitchId}
                    className="text-xs font-medium text-[color:var(--ink)]"
                  >
                    Impact account
                  </label>
                  <Switch
                    id={impactSwitchId}
                    className="ml-auto"
                    checked={picked.impactAccount}
                    disabled={impact.isPending}
                    onCheckedChange={(checked) =>
                      impact.mutate({ userId: picked.id, impact: checked })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Step 2, the packs. Published only: the engine refuses anything else. */}
      <div className="mt-4 border-t border-[color:var(--ink)]/10 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={filterId} className="text-[11px] font-medium text-muted-foreground">
            2. Packs
          </label>
          <p className="text-[11px] text-muted-foreground">{effectiveIds.length} selected</p>
        </div>
        <Input
          id={filterId}
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by pack or tutor"
          autoComplete="off"
          className="mt-1 h-9 text-sm"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Published packs only. Up to {MAX_SELECTION} per grant, so a longer list splits into more
          than one grant.
        </p>

        {materialsQuery.isLoading ? null : published.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            No published packs. Publish a listing above, then grant it.
          </p>
        ) : visible.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">No pack matches that filter.</p>
        ) : (
          <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {visible.map((row) => {
              const checked = effectiveIds.includes(row.id);
              return (
                <li key={row.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2",
                      checked
                        ? "border-[color:var(--ink)]/30 bg-[color:var(--foreground)]/[0.04]"
                        : "border-[color:var(--ink)]/10 hover:bg-[color:var(--foreground)]/[0.03]",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!checked && atCap}
                      onCheckedChange={(value) => toggleItem(row.id, value === true)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[color:var(--ink)]">
                        {row.title}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {row.tutors?.display_name ?? "Unknown tutor"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-[color:var(--ink)]">
                      HK${Number(row.price_hkd).toFixed(0)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Step 3, the reason the desk is recorded against every row. */}
      <div className="mt-4 border-t border-[color:var(--ink)]/10 pt-4">
        <label htmlFor={reasonId} className="text-[11px] font-medium text-muted-foreground">
          3. Reason
        </label>
        <Input
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={MAX_REASON_LENGTH}
          placeholder="Why this account receives these packs"
          className="mt-1 h-9 text-sm"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Recorded on each order. At least {MIN_REASON_LENGTH} characters.
        </p>
      </div>

      <Button
        size="sm"
        className="mt-3 h-9 w-full font-semibold"
        disabled={!ready || grant.isPending}
        onClick={() => {
          if (!picked || !ready) return;
          grant.mutate({
            buyerAccountId: picked.id,
            materialIds: effectiveIds,
            reason: reason.trim(),
          });
        }}
      >
        {grant.isPending ? "Granting" : "Grant at HK$0"}
      </Button>
    </ConsolePanel>
  );
}
