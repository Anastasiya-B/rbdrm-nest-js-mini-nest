import 'reflect-metadata';

import type { IncomingMessage, ServerResponse } from 'node:http';

import { Container } from './container';
import {
  PARAMS_METADATA_KEY,
  type ParametersMetadata,
} from './decorators/params';
import { ValidationException, ValidationPipe } from './pipes/validation.pipe';
import { createRoutes, matchRoute, type RegisteredRoute } from './router';

type Constructor<T = unknown> = new (...args: any[]) => T;

type ControllerInstance = Record<string, (...args: any[]) => unknown>;

const BUILT_IN_TYPES: Constructor[] = [String, Number, Boolean, Array, Object];

const shouldValidate = (
  metatype: Constructor | undefined,
): metatype is Constructor => {
  if (!metatype) {
    return false;
  }

  return !BUILT_IN_TYPES.includes(metatype);
};

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

  private readonly validationPipe = new ValidationPipe();

  constructor(
    private readonly container: Container,
    controllers: Constructor[],
  ) {
    this.routes = createRoutes(controllers);
  }

  handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const method = req.method ?? 'GET';

      const url = new URL(req.url ?? '/', 'http://localhost');

      const matchedRoute = matchRoute(this.routes, method, url.pathname);

      if (!matchedRoute) {
        sendJson(res, 404, {
          statusCode: 404,
          message: 'Not Found',
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

      const parameterTypes: Constructor[] =
        Reflect.getMetadata(
          'design:paramtypes',
          route.controller.prototype,
          route.handlerName,
        ) ?? [];

      const requiresBody = Object.values(parameterMetadata).some(
        metadata => metadata.type === 'body',
      );

      let body: unknown;

      if (requiresBody) {
        body = await readJsonBody(req);
      }

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

          case 'body': {
            const metatype = parameterTypes[index];

            if (!shouldValidate(metatype)) {
              args[index] = body;
              break;
            }

            args[index] = await this.validationPipe.transform(body, metatype);

            break;
          }
        }
      }

      const handler = controller[route.handlerName];

      const result = await handler.apply(controller, args);

      const statusCode = route.httpMethod === 'POST' ? 201 : 200;

      sendJson(res, statusCode, result ?? null);
    } catch (error) {
      if (error instanceof ValidationException) {
        sendJson(res, 400, {
          statusCode: 400,
          message: 'Validation failed',
          errors: error.errors,
        });

        return;
      }

      sendJson(res, 500, {
        statusCode: 500,
        message:
          error instanceof Error ? error.message : 'Internal Server Error',
      });
    }
  };
}
