export const CONTROLLER_PREFIX_METADATA_KEY = Symbol('controller:prefix');

export const Controller = (prefix = ''): ClassDecorator => {
  return target => {
    Reflect.defineMetadata(CONTROLLER_PREFIX_METADATA_KEY, prefix, target);
  };
};
