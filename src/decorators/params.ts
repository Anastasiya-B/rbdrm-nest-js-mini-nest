import type { ZodType } from 'zod';

export type ParameterType = 'body' | 'param' | 'query';

export interface ParameterMetadata {
  type: ParameterType;
  name?: string;
  schema?: ZodType;
}

export type ParametersMetadata = Record<number, ParameterMetadata>;

export const PARAMS_METADATA_KEY = Symbol('route:params');

const createParameterDecorator =
  (type: ParameterType, name?: string, schema?: ZodType): ParameterDecorator =>
  (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) {
      return;
    }

    const existingMetadata: ParametersMetadata =
      Reflect.getOwnMetadata(PARAMS_METADATA_KEY, target, propertyKey) ?? {};

    const parameterMetadata: ParameterMetadata = {
      type,
      name,
    };

    if (schema) {
      parameterMetadata.schema = schema;
    }

    const parametersMetadata: ParametersMetadata = {
      ...existingMetadata,
      [parameterIndex]: parameterMetadata,
    };

    Reflect.defineMetadata(
      PARAMS_METADATA_KEY,
      parametersMetadata,
      target,
      propertyKey,
    );
  };

export const Body = (schema?: ZodType): ParameterDecorator =>
  createParameterDecorator('body', undefined, schema);

export const Param = (name: string): ParameterDecorator =>
  createParameterDecorator('param', name);

export const Query = (name: string): ParameterDecorator =>
  createParameterDecorator('query', name);
