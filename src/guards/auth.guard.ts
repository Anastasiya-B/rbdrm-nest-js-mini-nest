import type { ExecutionContext, Guard } from '../lifecycle';

export class AuthGuard implements Guard {
  canActivate(context: ExecutionContext): boolean {
    const authorization = context.req.headers.authorization;

    return Boolean(authorization && authorization.trim());
  }
}
