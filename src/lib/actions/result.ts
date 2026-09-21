import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/context";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, code?: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, code, fieldErrors };
}

/**
 * Wrap a server action so domain errors become friendly results instead of
 * opaque 500s. Redirect errors from Next are re-thrown untouched.
 */
export async function act<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return fail(err.issues[0]?.message ?? "Invalid input", "validation", fieldErrors);
    }
    if (err instanceof AuthError) return fail(err.message, err.code);
    if (err && typeof err === "object" && "code" in err && "message" in err && typeof (err as { message: unknown }).message === "string") {
      return fail((err as { message: string }).message, String((err as { code: unknown }).code));
    }
    console.error("[action]", err);
    return fail(err instanceof Error ? err.message : "Something went wrong");
  }
}

function isNextRedirect(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_"));
}
