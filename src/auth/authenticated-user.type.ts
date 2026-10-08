import type { Request } from 'express';

export interface AuthenticatedUser {
  /** Id of the applicant's application record (JWT `sub`). */
  id: string;
  email: string;
}

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
