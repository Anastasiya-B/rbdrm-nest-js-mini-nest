import type { ExecutionContext, Interceptor } from '../lifecycle';

export class LoggingInterceptor implements Interceptor {
  async intercept(
    context: ExecutionContext,
    next: () => Promise<unknown>,
  ): Promise<unknown> {
    const startedAt = performance.now();

    try {
      return await next();
    } finally {
      const duration = performance.now() - startedAt;

      console.log(
        `${context.method} ${context.path} — ${duration.toFixed(1)} ms`,
      );
    }
  }
}
