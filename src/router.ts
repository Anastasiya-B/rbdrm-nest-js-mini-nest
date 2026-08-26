import 'reflect-metadata';

import { CONTROLLER_PREFIX_METADATA_KEY } from './decorators/controller';
import {
  ROUTE_METADATA_KEY,
  type HttpMethod,
  type RouteMetadata,
} from './decorators/methods';

type Constructor<T = unknown> = new (...args: any[]) => T;

export interface RegisteredRoute {
  httpMethod: HttpMethod;
  path: string;
  controller: Constructor;
  handlerName: string;
}

export interface MatchedRoute {
  route: RegisteredRoute;
  params: Record<string, string>;
}

const normalizePath = (...parts: string[]): string => {
  const normalized = parts
    .filter(Boolean)
    .map(part => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

  return `/${normalized}`;
};

export const createRoutes = (controllers: Constructor[]): RegisteredRoute[] => {
  const routes: RegisteredRoute[] = [];

  for (const Controller of controllers) {
    const prefix: string =
      Reflect.getMetadata(CONTROLLER_PREFIX_METADATA_KEY, Controller) ?? '';

    const prototype = Controller.prototype;

    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      propertyName => propertyName !== 'constructor',
    );

    for (const handlerName of methodNames) {
      const routeMetadata = Reflect.getMetadata(
        ROUTE_METADATA_KEY,
        prototype,
        handlerName,
      ) as RouteMetadata | undefined;

      if (!routeMetadata) {
        continue;
      }

      routes.push({
        httpMethod: routeMetadata.method,
        path: normalizePath(prefix, routeMetadata.path),
        controller: Controller,
        handlerName,
      });
    }
  }

  return routes;
};

const splitPath = (path: string): string[] => {
  return path.split('/').filter(Boolean);
};

export const matchRoute = (
  routes: RegisteredRoute[],
  httpMethod: string,
  pathname: string,
): MatchedRoute | null => {
  const requestSegments = splitPath(pathname);

  for (const route of routes) {
    if (route.httpMethod !== httpMethod) {
      continue;
    }

    const routeSegments = splitPath(route.path);

    if (routeSegments.length !== requestSegments.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let matches = true;

    for (let index = 0; index < routeSegments.length; index += 1) {
      const routeSegment = routeSegments[index];
      const requestSegment = requestSegments[index];

      if (routeSegment.startsWith(':')) {
        const paramName = routeSegment.slice(1);

        params[paramName] = decodeURIComponent(requestSegment);
        continue;
      }

      if (routeSegment !== requestSegment) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return {
        route,
        params,
      };
    }
  }

  return null;
};
