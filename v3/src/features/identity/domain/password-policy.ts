export const ACCOUNT_PASSWORD_MIN_LENGTH = 8;
export const ACCOUNT_PASSWORD_MAX_LENGTH = 128;

export function accountPasswordRequirementAr(): string {
  return `كلمة المرور ${ACCOUNT_PASSWORD_MIN_LENGTH} أحرف على الأقل`;
}
