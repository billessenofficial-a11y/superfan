"use client";

import * as React from "react";
import { Download, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { deleteAccountAction, exportMyDataAction } from "@/lib/actions/fan";

export function DataControls() {
  const [exporting, startExport] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");

  const exportData = () =>
    startExport(async () => {
      const res = await exportMyDataAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([res.data.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `superfan-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Your data is downloading");
    });

  const deleteAccount = () =>
    startDelete(async () => {
      try {
        await deleteAccountAction();
      } catch (err) {
        // A redirect is thrown on success and handled by Next; anything else is a real failure.
        if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
        toast.error(err instanceof Error ? err.message : "Could not delete your account");
      }
    });

  return (
    <>
      <section className="card-surface p-5">
        <h2 className="text-sm font-semibold tracking-tight">Your data</h2>
        <p className="text-xs text-muted-foreground">Everything Superfan holds about you, in one file.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportData} loading={exporting}>
            <Download /> Download my data
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="/auth/signout">
              <LogOut /> Sign out
            </a>
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-danger/30 bg-danger-soft/40 p-5">
        <h2 className="text-sm font-semibold tracking-tight text-danger">Delete my account</h2>
        <p className="mt-1 text-xs text-muted-foreground">Removes your profile, unlinks your identities and signs you out. Your passports, points and badges are gone for good.</p>
        <Button variant="danger" size="sm" className="mt-4" onClick={() => setOpen(true)}>
          <Trash2 /> Delete account
        </Button>
      </section>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setConfirm("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>This can&apos;t be undone. Type DELETE to confirm.</DialogDescription>
          </DialogHeader>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" autoComplete="off" className="mt-4 font-mono" />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
              Keep my account
            </Button>
            <Button variant="danger" onClick={deleteAccount} loading={deleting} disabled={confirm !== "DELETE"}>
              Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
