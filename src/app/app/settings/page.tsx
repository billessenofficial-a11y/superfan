import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { artistInvites, artistMembers, auditLogs, fanLevels, imports, scoreRules, users } from "@/db/schema";
import { can, requireArtistContext } from "@/lib/auth/context";
import { IMPORT_FIELDS } from "@/lib/csv/import";
import { POINTS_PER_DOLLAR_DEFAULT, REFERRAL_POINTS_DEFAULT } from "@/lib/scoring/defaults";
import { PageHeader } from "@/components/dashboard/page-header";
import { AuditLog } from "@/components/settings/audit-log";
import { GeneralForm } from "@/components/settings/general-form";
import { ImportWizard } from "@/components/settings/import-wizard";
import { LevelsEditor } from "@/components/settings/levels-editor";
import { ScoringEditor } from "@/components/settings/scoring-editor";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { SETTINGS_TABS, type SettingsTab } from "@/components/settings/tabs";
import { TeamPanel } from "@/components/settings/team-panel";

export const metadata = { title: "Settings · Superfan" };

const AUDIT_PAGE_SIZE = 50;

function readNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const [ctx, sp] = await Promise.all([requireArtistContext(), searchParams]);
  const tab: SettingsTab = SETTINGS_TABS.some((t) => t.value === sp.tab) ? (sp.tab as SettingsTab) : "general";
  const artistId = ctx.artist.id;

  return (
    <div>
      <PageHeader title="Settings" description="Workspace, scoring, levels, team and data." />
      <SettingsTabs active={tab} />
      <div className="mt-6">
        {tab === "general" ? (
          <GeneralForm
            artist={{
              name: ctx.artist.name,
              slug: ctx.artist.slug,
              genre: ctx.artist.genre,
              country: ctx.artist.country,
              bio: ctx.artist.bio,
              accentColor: ctx.artist.accentColor,
              avatarUrl: ctx.artist.avatarUrl,
              bannerUrl: ctx.artist.bannerUrl,
              followerCount: ctx.artist.followerCount,
              pointsPerDollar: readNumber(ctx.artist.settings.pointsPerDollar, POINTS_PER_DOLLAR_DEFAULT),
              referralPoints: readNumber(ctx.artist.settings.referralPoints, REFERRAL_POINTS_DEFAULT),
            }}
            canManage={can(ctx.role, "manageArtist")}
          />
        ) : null}

        {tab === "scoring" ? <ScoringTab artistId={artistId} weights={ctx.artist.scoreWeights} canManage={can(ctx.role, "manageScoring")} /> : null}
        {tab === "levels" ? <LevelsTab artistId={artistId} canManage={can(ctx.role, "manageScoring")} /> : null}
        {tab === "team" ? <TeamTab artistId={artistId} currentUserId={ctx.user.id} canManage={can(ctx.role, "manageTeam")} /> : null}
        {tab === "import" ? <ImportTab artistId={artistId} canImport={can(ctx.role, "importFans")} /> : null}
        {tab === "audit" ? <AuditTab artistId={artistId} page={Math.max(1, Number(sp.page) || 1)} /> : null}
      </div>
    </div>
  );
}

async function ScoringTab({ artistId, weights, canManage }: { artistId: string; weights: { commerce: number; attendance: number; engagement: number; advocacy: number; community: number }; canManage: boolean }) {
  const rules = await db
    .select({
      id: scoreRules.id,
      key: scoreRules.key,
      label: scoreRules.label,
      category: scoreRules.category,
      dimension: scoreRules.dimension,
      points: scoreRules.points,
      perUnit: scoreRules.perUnit,
      capPoints: scoreRules.capPoints,
      capWindow: scoreRules.capWindow,
      enabled: scoreRules.enabled,
    })
    .from(scoreRules)
    .where(eq(scoreRules.artistId, artistId))
    .orderBy(scoreRules.sortOrder, scoreRules.createdAt);
  return <ScoringEditor weights={weights} rules={rules} canManage={canManage} />;
}

async function LevelsTab({ artistId, canManage }: { artistId: string; canManage: boolean }) {
  const levels = await db
    .select({ id: fanLevels.id, name: fanLevels.name, minScore: fanLevels.minScore, color: fanLevels.color })
    .from(fanLevels)
    .where(eq(fanLevels.artistId, artistId))
    .orderBy(fanLevels.sortOrder);
  return <LevelsEditor levels={levels} canManage={canManage} />;
}

async function TeamTab({ artistId, currentUserId, canManage }: { artistId: string; currentUserId: string; canManage: boolean }) {
  const [members, invites] = await Promise.all([
    db
      .select({
        id: artistMembers.id,
        userId: artistMembers.userId,
        role: artistMembers.role,
        acceptedAt: artistMembers.acceptedAt,
        createdAt: artistMembers.createdAt,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        lastSignInAt: users.lastSignInAt,
      })
      .from(artistMembers)
      .innerJoin(users, eq(users.id, artistMembers.userId))
      .where(eq(artistMembers.artistId, artistId))
      .orderBy(artistMembers.createdAt),
    db
      .select({ id: artistInvites.id, email: artistInvites.email, role: artistInvites.role, expiresAt: artistInvites.expiresAt, createdAt: artistInvites.createdAt })
      .from(artistInvites)
      .where(and(eq(artistInvites.artistId, artistId), isNull(artistInvites.acceptedAt), gt(artistInvites.expiresAt, new Date())))
      .orderBy(desc(artistInvites.createdAt)),
  ]);
  return <TeamPanel members={members} invites={invites} currentUserId={currentUserId} canManage={canManage} />;
}

async function ImportTab({ artistId, canImport }: { artistId: string; canImport: boolean }) {
  const previous = await db
    .select({
      id: imports.id,
      fileName: imports.fileName,
      sourceLabel: imports.sourceLabel,
      status: imports.status,
      rowCount: imports.rowCount,
      importedCount: imports.importedCount,
      skippedCount: imports.skippedCount,
      errorCount: imports.errorCount,
      createdAt: imports.createdAt,
      completedAt: imports.completedAt,
    })
    .from(imports)
    .where(eq(imports.artistId, artistId))
    .orderBy(desc(imports.createdAt))
    .limit(20);
  return <ImportWizard previous={previous} canImport={canImport} fields={IMPORT_FIELDS.map((f) => ({ key: f.key, label: f.label, description: "description" in f ? f.description : undefined }))} />;
}

async function AuditTab({ artistId, page }: { artistId: string; page: number }) {
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        metadata: auditLogs.metadata,
        actorLabel: auditLogs.actorLabel,
        createdAt: auditLogs.createdAt,
        actorEmail: users.email,
        actorName: users.displayName,
        actorAvatarUrl: users.avatarUrl,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(eq(auditLogs.artistId, artistId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(AUDIT_PAGE_SIZE)
      .offset((page - 1) * AUDIT_PAGE_SIZE),
    db.select({ total: count() }).from(auditLogs).where(eq(auditLogs.artistId, artistId)),
  ]);
  return <AuditLog rows={rows} page={page} pageSize={AUDIT_PAGE_SIZE} total={total} />;
}
