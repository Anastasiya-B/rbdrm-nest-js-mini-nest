export type ParameterType = 'body' | 'param' | 'query';

export interface ParameterMetadata {
  type: ParameterType;
  name?: string;
}

export type ParametersMetadata = Record<number, ParameterMetadata>;

export const PARAMS_METADATA_KEY = Symbol('route:params');

const createParameterDecorator =
  (type: ParameterType, name?: string): ParameterDecorator =>
  (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) {
      return;
    }

    const existingMetadata: ParametersMetadata =
      Reflect.getOwnMetadata(PARAMS_METADATA_KEY, target, propertyKey) ?? {};

    const parametersMetadata: ParametersMetadata = {
      ...existingMetadata,
      [parameterIndex]: {
        type,
        name,
      },
    };

    Reflect.defineMetadata(
      PARAMS_METADATA_KEY,
      parametersMetadata,
      target,
      propertyKey,
    );
  };

export const Body = (): ParameterDecorator => createParameterDecorator('body');

export const Param = (name: string): ParameterDecorator =>
  createParameterDecorator('param', name);

export const Query = (name: string): ParameterDecorator =>
  createParameterDecorator('query', name);
