import { Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { UserRow } from "./UserStatsOverview";

interface DeleteUserAlertDialogProps {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: (userId: string) => Promise<void>;
  isDeleting: boolean;
}

export function DeleteUserAlertDialog({
  user,
  open,
  onOpenChange,
  onConfirmDelete,
  isDeleting,
}: DeleteUserAlertDialogProps) {
  if (!user) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md border-border bg-card">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-black text-[color:var(--ink)]">
                Delete User Account?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                This action cannot be undone.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="my-2 space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-destructive dark:text-red-400">
          <p className="font-semibold">
            You are about to delete account{" "}
            <span className="font-bold underline">{user.display_name ?? user.email}</span>
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[11px] opacity-90">
            <li>User profile and Auth credentials will be permanently removed.</li>
            <li>
              All associated tutor profiles and records created by this account will be erased.
            </li>
            <li>All granted system roles will be revoked instantly.</li>
          </ul>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isDeleting} className="h-9 text-xs font-bold">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirmDelete(user.user_id);
            }}
            disabled={isDeleting}
            className="h-9 bg-destructive text-xs font-bold text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {isDeleting ? "Deleting..." : "Confirm Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
