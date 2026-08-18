import 'reflect-metadata';

export type Scope = 'singleton' | 'transient';

type InjectableOptions = {
  scope?: Scope;
};

export const SCOPE_METADATA_KEY = 'ioc:scope';

export const Injectable = (options: InjectableOptions = {}): ClassDecorator => {
  return target => {
    const scope = options.scope ?? 'singleton';

    Reflect.defineMetadata(SCOPE_METADATA_KEY, scope, target);
  };
};
