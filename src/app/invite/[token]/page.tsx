import { acceptInvite } from "@/lib/actions/artist";

/** Accepting a team invitation: requires sign-in, then joins the workspace. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await acceptInvite(token);
  return null;
}
