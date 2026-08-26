import 'reflect-metadata';

import type { IncomingMessage, ServerResponse } from 'node:http';

import { Container } from './container';
import {
  createRequestId,
  runWithRequestContext,
} from './context/request-context';
import {
  PARAMS_METADATA_KEY,
  type ParametersMetadata,
} from './decorators/params';
import { ExceptionFilter } from './filters/exception.filter';
import {
  AllowAllGuard,
  defaultMiddleware,
  PassThroughInterceptor,
} from './lifecycle-defaults';
import type {
  ExecutionContext,
  Guard,
  Interceptor,
  Middleware,
  Pipe,
} from './lifecycle';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { createRoutes, matchRoute, type RegisteredRoute } from './router';

type Constructor<T = unknown> = new (...args: any[]) => T;

type ControllerInstance = Record<string, (...args: any[]) => unknown>;

export interface DispatcherOptions {
  middleware?: Middleware;
  guard?: Guard;
  interceptor?: Interceptor;
  pipe?: Pipe;
}

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const rawBody = Buffer.concat(chunks).toString('utf-8').trim();

  if (!rawBody) {
    return undefined;
  }

  return JSON.parse(rawBody);
};

const sendJson = (
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void => {
  res.statusCode = statusCode;

  res.setHeader('Content-Type', 'application/json');

  res.end(JSON.stringify(body));
};

export class Dispatcher {
  private readonly routes: RegisteredRoute[];

  private readonly middleware: Middleware;

  private readonly guard: Guard;

  private readonly interceptor: Interceptor;

  private readonly pipe: Pipe;

  private readonly exceptionFilter = new ExceptionFilter();

  constructor(
    private readonly container: Container,
    controllers: Constructor[],
    options: DispatcherOptions = {},
  ) {
    this.routes = createRoutes(controllers);

    this.middleware = options.middleware ?? defaultMiddleware;

    this.guard = options.guard ?? new AllowAllGuard();

    this.interceptor = options.interceptor ?? new PassThroughInterceptor();

    this.pipe = options.pipe ?? new ZodValidationPipe();
  }

  handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const incomingRequestId = req.headers['x-request-id'];

    const requestId = createRequestId(
      Array.isArray(incomingRequestId)
        ? incomingRequestId[0]
        : incomingRequestId,
    );

    res.setHeader('X-Request-Id', requestId);

    await runWithRequestContext(requestId, async () => {
      try {
        const method = req.method ?? 'GET';

        const url = new URL(req.url ?? '/', 'http://localhost');

        const context: ExecutionContext = {
          req,
          res,
          method,
          path: url.pathname,
        };

        await this.middleware(context, async () => {
          await this.dispatch(context, url);
        });
      } catch (error) {
        this.exceptionFilter.catch(error, res);
      }
    });
  };

  private async dispatch(context: ExecutionContext, url: URL): Promise<void> {
    const matchedRoute = matchRoute(this.routes, context.method, url.pathname);

    if (!matchedRoute) {
      sendJson(context.res, 404, {
        statusCode: 404,
        message: 'Not Found',
      });

      return;
    }

    const canActivate = await this.guard.canActivate(context);

    if (!canActivate) {
      sendJson(context.res, 403, {
        statusCode: 403,
        message: 'Forbidden',
      });

      return;
    }

    const { route, params } = matchedRoute;

    const controller = this.container.resolve(
      route.controller,
    ) as unknown as ControllerInstance;

    const parameterMetadata: ParametersMetadata =
      Reflect.getMetadata(
        PARAMS_METADATA_KEY,
        route.controller.prototype,
        route.handlerName,
      ) ?? {};

    const requiresBody = Object.values(parameterMetadata).some(
      metadata => metadata.type === 'body',
    );

    let body: unknown;

    if (requiresBody) {
      body = await readJsonBody(context.req);
    }

    const result = await this.interceptor.intercept(context, async () => {
      const args: unknown[] = [];

      for (const [indexAsString, metadata] of Object.entries(
        parameterMetadata,
      )) {
        const index = Number(indexAsString);

        switch (metadata.type) {
          case 'param':
            args[index] = metadata.name ? params[metadata.name] : undefined;
            break;

          case 'query':
            args[index] = metadata.name
              ? url.searchParams.get(metadata.name) ?? undefined
              : undefined;
            break;

          case 'body':
            args[index] = await this.pipe.transform(body, metadata.schema);
            break;
        }
      }

      const handler = controller[route.handlerName];

      return handler.apply(controller, args);
    });

    const statusCode = route.httpMethod === 'POST' ? 201 : 200;

    sendJson(context.res, statusCode, result ?? null);
  }
}
