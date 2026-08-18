import 'reflect-metadata';

import { INJECT_TOKENS_METADATA_KEY } from './decorators/inject';
import { SCOPE_METADATA_KEY, type Scope } from './decorators/injectable';

type Constructor<T = unknown> = new (...args: any[]) => T;
type Token = symbol | string;

export class Container {
  private singletons = new Map<Constructor, unknown>();
  private tokenValues = new Map<Token, unknown>();

  register<T>(token: Token, value: T): void {
    this.tokenValues.set(token, value);
  }

  resolve<T>(Target: Constructor<T>): T {
    return this.resolveTarget(Target, new Set());
  }

  private resolveTarget<T>(Target: Constructor<T>, path: Set<Constructor>): T {
    if (path.has(Target)) {
      const chain = [...path, Target].map(item => item.name).join(' -> ');

      throw new Error(`Circular dependency: ${chain}`);
    }

    const scope: Scope =
      Reflect.getMetadata(SCOPE_METADATA_KEY, Target) ?? 'singleton';

    if (scope === 'singleton') {
      const existingInstance = this.singletons.get(Target);

      if (existingInstance) {
        return existingInstance as T;
      }
    }

    const nextPath = new Set(path);
    nextPath.add(Target);

    const paramTypes: Constructor[] =
      Reflect.getMetadata('design:paramtypes', Target) ?? [];

    const injectTokens: Record<number, Token> =
      Reflect.getMetadata(INJECT_TOKENS_METADATA_KEY, Target) ?? {};

    const dependencies = paramTypes.map((Dependency, index) => {
      const token = injectTokens[index];

      if (token) {
        if (!this.tokenValues.has(token)) {
          throw new Error(`No value registered for token ${String(token)}`);
        }

        return this.tokenValues.get(token);
      }

      return this.resolveTarget(Dependency, nextPath);
    });

    const instance = new Target(...dependencies);

    if (scope === 'singleton') {
      this.singletons.set(Target, instance);
    }

    return instance;
  }
}
