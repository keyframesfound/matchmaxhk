import { useState } from "react";
import { UserPlus, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_DEFINITIONS } from "@/features/auth/roleLabel";
import type { AppRole } from "@/features/auth/useAuth";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProvision: (data: {
    email: string;
    displayName?: string;
    password?: string;
    role: AppRole;
  }) => Promise<void>;
  isPending: boolean;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onProvision,
  isPending,
}: InviteUserDialogProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("parent");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    await onProvision({
      email: email.trim(),
      displayName: displayName.trim() || undefined,
      password: password.trim() || undefined,
      role,
    });

    // Reset fields
    setEmail("");
    setDisplayName("");
    setPassword("");
    setRole("parent");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--foreground)]/[0.06] text-[color:var(--foreground)]">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-[color:var(--ink)]">
                  Provision New User
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Create a user account and pre-assign their platform role.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="my-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[color:var(--ink)]">Email Address *</Label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[color:var(--ink)]">
                Display Name <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input
                type="text"
                placeholder="e.g. Alex Wong"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[color:var(--ink)]">Initial Role *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select initial role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_DEFINITIONS.map((def) => (
                    <SelectItem key={def.role} value={def.role}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{def.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[color:var(--ink)]">
                Password{" "}
                <span className="text-muted-foreground font-normal">(Auto-generated if empty)</span>
              </Label>
              <Input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="h-9 font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !email.trim()}
              className="h-9 font-bold text-xs"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {isPending ? "Creating..." : "Provision Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
