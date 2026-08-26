import 'reflect-metadata';

export const INJECT_TOKENS_METADATA_KEY = 'ioc:inject-tokens';

export const Inject = (token: symbol | string): ParameterDecorator => {
  return (target, _propertyKey, parameterIndex) => {
    const existingTokens: Record<number, symbol | string> =
      Reflect.getOwnMetadata(INJECT_TOKENS_METADATA_KEY, target) ?? {};

    const updatedTokens = {
      ...existingTokens,
      [parameterIndex]: token,
    };

    Reflect.defineMetadata(INJECT_TOKENS_METADATA_KEY, updatedTokens, target);
  };
};
