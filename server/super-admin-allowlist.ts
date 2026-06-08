/**
 * Super Admin email allowlist.
 *
 * Reads a comma-separated, case-insensitive list of emails from the
 * SUPER_ADMIN_EMAILS environment variable. Any user logging in with a matching
 * email is deterministically granted Super Admin access, regardless of login
 * order. When the variable is unset/empty, the allowlist is empty and the
 * existing "first user becomes Super Admin" fallback continues to apply.
 */

export function getSuperAdminEmails(): Set<string> {
  const raw = process.env.SUPER_ADMIN_EMAILS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getSuperAdminEmails().has(email.trim().toLowerCase());
}
