import type {
  ExecutionContext,
  Guard,
  Interceptor,
  Middleware,
} from './lifecycle';

export const defaultMiddleware: Middleware = async (_context, next) => {
  await next();
};

export class AllowAllGuard implements Guard {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

export class PassThroughInterceptor implements Interceptor {
  async intercept(
    _context: ExecutionContext,
    next: () => Promise<unknown>,
  ): Promise<unknown> {
    return next();
  }
}
