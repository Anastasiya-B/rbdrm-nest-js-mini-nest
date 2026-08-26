export type HttpMethod = 'GET' | 'POST';

export interface RouteMetadata {
  method: HttpMethod;
  path: string;
}

export const ROUTE_METADATA_KEY = Symbol('route');

const createMethodDecorator =
  (method: HttpMethod) =>
  (path = ''): MethodDecorator => {
    return (target, propertyKey) => {
      const metadata: RouteMetadata = {
        method,
        path,
      };

      Reflect.defineMetadata(ROUTE_METADATA_KEY, metadata, target, propertyKey);
    };
  };

export const Get = createMethodDecorator('GET');

export const Post = createMethodDecorator('POST');
