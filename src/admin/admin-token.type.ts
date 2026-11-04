// The `role` claim that separates an admin JWT from an applicant's (which has none).
export const ADMIN_ROLE = 'admin';

export interface AdminTokenPayload {
  sub: string;
  email: string;
  role: typeof ADMIN_ROLE;
}
