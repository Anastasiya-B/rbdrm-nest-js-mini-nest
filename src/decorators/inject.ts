import 'reflect-metadata';

export const INJECT_TOKENS_METADATA_KEY = 'ioc:inject-tokens';

export const Inject = (token: symbol | string): ParameterDecorator => {
  return (target, _propertyKey, parameterIndex) => {
    const existingTokens: Record<number, symbol | string> =
      Reflect.getMetadata(INJECT_TOKENS_METADATA_KEY, target) ?? {};

    existingTokens[parameterIndex] = token;

    Reflect.defineMetadata(INJECT_TOKENS_METADATA_KEY, existingTokens, target);
  };
};
