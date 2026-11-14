// Supabase Auth accepts six characters by default. Keep login permissive for
// historical accounts while applying the server-supported floor to new ones.
export const ACCOUNT_PASSWORD_MIN_LENGTH = 6;
export const ACCOUNT_PASSWORD_MAX_LENGTH = 128;

export function accountPasswordRequirementAr(): string {
  return `كلمة المرور ${ACCOUNT_PASSWORD_MIN_LENGTH} أحرف على الأقل`;
}
