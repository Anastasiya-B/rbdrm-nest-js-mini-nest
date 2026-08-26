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

const splitPath = (path: string): string[] => {
  return path.split('/').filter(Boolean);
};

const getPrototypeMethodNames = (prototype: object): string[] => {
  const methodNames = new Set<string>();

  let currentPrototype: object | null = prototype;

  while (currentPrototype && currentPrototype !== Object.prototype) {
    for (const propertyName of Object.getOwnPropertyNames(currentPrototype)) {
      if (propertyName !== 'constructor') {
        methodNames.add(propertyName);
      }
    }

    currentPrototype = Object.getPrototypeOf(currentPrototype);
  }

  return [...methodNames];
};

const countDynamicSegments = (path: string): number => {
  return splitPath(path).filter(segment => segment.startsWith(':')).length;
};

export const createRoutes = (controllers: Constructor[]): RegisteredRoute[] => {
  const routes: RegisteredRoute[] = [];

  for (const Controller of controllers) {
    const prefix: string =
      Reflect.getMetadata(CONTROLLER_PREFIX_METADATA_KEY, Controller) ?? '';

    const prototype = Controller.prototype;

    const methodNames = getPrototypeMethodNames(prototype);

    for (const handlerName of methodNames) {
      let currentPrototype: object | null = prototype;

      let routeMetadata: RouteMetadata | undefined;

      while (currentPrototype && currentPrototype !== Object.prototype) {
        routeMetadata = Reflect.getOwnMetadata(
          ROUTE_METADATA_KEY,
          currentPrototype,
          handlerName,
        ) as RouteMetadata | undefined;

        if (routeMetadata) {
          break;
        }

        currentPrototype = Object.getPrototypeOf(currentPrototype);
      }

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

  return routes.sort(
    (left, right) =>
      countDynamicSegments(left.path) - countDynamicSegments(right.path),
  );
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
