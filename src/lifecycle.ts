import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ZodType } from 'zod';

export interface ExecutionContext {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  path: string;
}

export interface Guard {
  canActivate(context: ExecutionContext): boolean | Promise<boolean>;
}

export interface Interceptor {
  intercept(
    context: ExecutionContext,
    next: () => Promise<unknown>,
  ): Promise<unknown>;
}

export interface Pipe {
  transform(value: unknown, schema?: ZodType): unknown | Promise<unknown>;
}

export type Middleware = (
  context: ExecutionContext,
  next: () => Promise<void>,
) => Promise<void>;
