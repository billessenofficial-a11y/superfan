"use client";

import * as React from "react";
import { Crown, Mail, UserMinus, UserPlus } from "lucide-react";
import { inviteMember, removeMember, updateMemberRole } from "@/lib/actions/artist";
import { formatDate, formatRelative } from "@/lib/utils";
import { ActionButton } from "@/components/shared/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRunAction } from "@/components/programs/use-run-action";

type Role = "owner" | "admin" | "marketing" | "community" | "viewer";
type AssignableRole = Exclude<Role, "owner">;

export type MemberRow = {
  id: string;
  userId: string;
  role: Role;
  acceptedAt: Date | null;
  createdAt: Date;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  lastSignInAt: Date | null;
};

export type InviteRow = { id: string; email: string; role: Role; expiresAt: Date; createdAt: Date };

const ROLES: { value: AssignableRole; label: string; hint: string }[] = [
  { value: "admin", label: "Admin", hint: "Everything except transferring ownership." },
  { value: "marketing", label: "Marketing", hint: "Campaigns, rewards, events, segments, imports, exports." },
  { value: "community", label: "Community", hint: "Fan profiles, notes, tags, challenges." },
  { value: "viewer", label: "Viewer", hint: "Read-only access." },
];

export function TeamPanel({ members, invites, currentUserId, canManage }: { members: MemberRow[]; invites: InviteRow[]; currentUserId: string; canManage: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? "person has" : "people have"} access to this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <MemberItem key={m.id} member={m} isSelf={m.userId === currentUserId} canManage={canManage} />
            ))}
          </ul>
        </CardContent>
      </Card>

      {invites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>Invitations expire after 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-border">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Mail className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited {formatRelative(i.createdAt)} · expires {formatDate(i.expiresAt)}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {i.role}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {canManage ? <InviteForm /> : null}
    </div>
  );
}

function MemberItem({ member, isSelf, canManage }: { member: MemberRow; isSelf: boolean; canManage: boolean }) {
  const { pending, run } = useRunAction();
  const name = member.displayName ?? member.email.split("@")[0];
  const isOwner = member.role === "owner";
  const editable = canManage && !isOwner;

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar src={member.avatarUrl} name={name} size={36} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {name}
            {isSelf ? <span className="text-xs font-normal text-subtle">(you)</span> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {member.email}
            {member.lastSignInAt ? ` · active ${formatRelative(member.lastSignInAt)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        {isOwner ? (
          <Badge variant="accent">
            <Crown /> Owner
          </Badge>
        ) : editable ? (
          <Select value={member.role} onValueChange={(v) => run(() => updateMemberRole({ memberId: member.id, role: v as AssignableRole }), { success: `${name} is now ${v}` })} disabled={pending}>
            <SelectTrigger size="sm" className="w-32" aria-label={`Role for ${name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className="capitalize">
            {member.role}
          </Badge>
        )}
        {editable ? (
          <ActionButton size="icon-sm" variant="ghost" aria-label={`Remove ${name}`} action={() => removeMember({ memberId: member.id })} confirm={`Remove ${name} from the team? They lose access immediately.`} successMessage={`${name} removed`}>
            <UserMinus className="size-4 text-danger" />
          </ActionButton>
        ) : null}
      </div>
    </li>
  );
}

function InviteForm() {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<AssignableRole>("marketing");
  const { pending, run } = useRunAction();
  const roleMeta = ROLES.find((r) => r.value === role);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a teammate</CardTitle>
        <CardDescription>Existing Superfan users get access instantly; everyone else receives an email invitation.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => inviteMember({ email: email.trim(), role }), { success: `Invitation sent to ${email.trim()}`, onSuccess: () => setEmail("") });
          }}
        >
          <Field label="Email" htmlFor="invite-email">
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@label.com" required />
          </Field>
          <Field label="Role" hint={roleMeta?.hint}>
            <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit" loading={pending} className="sm:mb-[1.4rem]">
            <UserPlus /> Invite
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
