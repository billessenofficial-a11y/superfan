import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth/session";
import { appUrl } from "@/lib/env";

export async function POST(_req: NextRequest) {
  await signOut();
  return NextResponse.redirect(appUrl("/"), { status: 303 });
}

export async function GET(_req: NextRequest) {
  await signOut();
  return NextResponse.redirect(appUrl("/"));
}
