import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MailX, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableEmpty,
  ConsoleTableHead,
  ConsoleTableSkeletonRows,
  ConsoleTd,
  ConsoleTh,
} from "@/components/ui/console-table";
import {
  addAccountBlocklistEntry,
  listAccountBlocklist,
  removeAccountBlocklistEntry,
  type AccountBlocklistRow,
} from "./account-status.functions";

/**
 * Issue #308: the email block list (admin-only). Admins can block an email
 * that has no account yet; banned accounts land here automatically and
 * restore removes them. Writes go through admin-gated server functions —
 * the table itself has no client policies at all.
 */
export function BlocklistTab() {
  const [entries, setEntries] = useState<AccountBlocklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const listFn = useServerFn(listAccountBlocklist);
  const addFn = useServerFn(addAccountBlocklistEntry);
  const removeFn = useServerFn(removeAccountBlocklistEntry);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await listFn({});
      setEntries(res.entries);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load block list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);
    try {
      await addFn({ data: { email: trimmed, note: note.trim() || undefined } });
      toast.success(`${trimmed} is blocked from signing up`);
      setEmail("");
      setNote("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to block email");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string, blockedEmail: string) {
    try {
      await removeFn({ data: { id } });
      toast.success(`${blockedEmail} removed from the block list`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove entry");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-bold text-[color:var(--ink)]">Block list</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Blocked emails and banned accounts' Google identities are refused at signup — including
          OAuth sign-in with a different Google account. Ban an existing account instead of adding
          it here; restoring a banned account removes its entry automatically.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="h-9 max-w-xs text-xs"
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Note (optional)"
            className="h-9 flex-1 text-xs"
          />
          <Button
            size="sm"
            onClick={() => void handleAdd()}
            disabled={busy || !email.trim()}
            className="h-9 gap-1.5 font-bold text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Block email
          </Button>
        </div>
      </div>

      <ConsoleTable density="compact" tableClassName="text-left text-xs">
        <ConsoleTableHead>
          <tr>
            <ConsoleTh>Email</ConsoleTh>
            <ConsoleTh>Google identity</ConsoleTh>
            <ConsoleTh>Note</ConsoleTh>
            <ConsoleTh>Added</ConsoleTh>
            <ConsoleTh align="right">Actions</ConsoleTh>
          </tr>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {loading && <ConsoleTableSkeletonRows columns={5} rows={4} />}

          {!loading && entries.length === 0 && (
            <ConsoleTableEmpty
              colSpan={5}
              icon={MailX}
              title="Block list is empty"
              description="No emails or Google identities are currently refused at signup."
            />
          )}

          {!loading &&
            entries.map((entry) => (
              <tr
                key={entry.id}
                className="align-middle transition-colors hover:bg-[color:var(--surface-subtle)]/40"
              >
                <ConsoleTd>
                  <span className="font-mono text-xs">{entry.email}</span>
                </ConsoleTd>
                <ConsoleTd>
                  {entry.google_sub ? (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {entry.google_sub}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">—</span>
                  )}
                </ConsoleTd>
                <ConsoleTd>
                  <span className="text-xs text-muted-foreground">{entry.note ?? "—"}</span>
                </ConsoleTd>
                <ConsoleTd>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </ConsoleTd>
                <ConsoleTd align="right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleRemove(entry.id, entry.email)}
                    className="h-7 gap-1 px-2 text-[11px] font-semibold text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </Button>
                </ConsoleTd>
              </tr>
            ))}
        </ConsoleTableBody>
      </ConsoleTable>
    </div>
  );
}
