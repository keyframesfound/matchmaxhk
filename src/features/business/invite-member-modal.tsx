import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteMember } from "@/features/business/business.functions";

type InviteMemberModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onInvited: () => void;
};

export function InviteMemberModal({
  open,
  onOpenChange,
  orgId,
  onInvited,
}: InviteMemberModalProps) {
  const inviteFn = useServerFn(inviteMember);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const result = (await inviteFn({ data: { orgId, email: email.trim() } })) as {
        emailSent: boolean;
      };
      toast.success(
        result.emailSent
          ? `Invitation sent to ${email.trim()}`
          : `Invite created for ${email.trim()} — they'll get admin access when they sign up with this email`,
      );
      setEmail("");
      onInvited();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite an admin</DialogTitle>
          <DialogDescription>
            They'll need to sign up or sign in with this email address to claim admin access.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address *</Label>
            <Input
              required
              type="email"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={sending}
              className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
            >
              {sending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
