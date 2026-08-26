import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import 'reflect-metadata';

import { Container } from '../src/container';
import { Inject, INJECT_TOKENS_METADATA_KEY } from '../src/decorators/inject';
import { Injectable, SCOPE_METADATA_KEY } from '../src/decorators/injectable';
import { TOKENS } from '../src/tokens';

describe('@Injectable', () => {
  it('uses singleton scope by default', () => {
    @Injectable()
    class UserService {}

    const scope = Reflect.getMetadata(SCOPE_METADATA_KEY, UserService);

    expect(scope).toBe('singleton');
  });

  it('stores transient scope', () => {
    @Injectable({ scope: 'transient' })
    class Logger {}

    const scope = Reflect.getMetadata(SCOPE_METADATA_KEY, Logger);

    expect(scope).toBe('transient');
  });
});

describe('Container', () => {
  it('resolves dependencies recursively', () => {
    @Injectable()
    class C {}

    @Injectable()
    class B {
      constructor(public c: C) {}
    }

    @Injectable()
    class A {
      constructor(public b: B) {}
    }

    const container = new Container();

    const result = container.resolve(A);

    expect(result).toBeInstanceOf(A);
    expect(result.b).toBeInstanceOf(B);
    expect(result.b.c).toBeInstanceOf(C);
  });

  it('returns the same instance for singleton scope', () => {
    @Injectable()
    class UserService {}

    const container = new Container();

    const first = container.resolve(UserService);
    const second = container.resolve(UserService);

    expect(first).toBe(second);
  });

  it('returns a new instance for transient scope', () => {
    @Injectable({ scope: 'transient' })
    class Logger {}

    const container = new Container();

    const first = container.resolve(Logger);
    const second = container.resolve(Logger);

    expect(first).not.toBe(second);
  });

  it('resolves dependency by token', () => {
    type Config = {
      apiUrl: string;
    };

    @Injectable()
    class ApiService {
      constructor(
        @Inject(TOKENS.CONFIG)
        public config: Config,
      ) {}
    }

    const config: Config = {
      apiUrl: 'https://example.com',
    };

    const container = new Container();

    container.register(TOKENS.CONFIG, config);

    const service = container.resolve(ApiService);

    expect(service.config).toBe(config);
    expect(service.config.apiUrl).toBe('https://example.com');
  });

  it('throws a readable error for circular dependencies', () => {
    @Injectable()
    class A {}

    @Injectable()
    class B {}

    Reflect.defineMetadata('design:paramtypes', [B], A);

    Reflect.defineMetadata('design:paramtypes', [A], B);

    const container = new Container();

    expect(() => container.resolve(A)).toThrow(/A -> B -> A/);
  });

  it('does not throw RangeError for circular dependencies', () => {
    @Injectable()
    class A {}

    @Injectable()
    class B {}

    Reflect.defineMetadata('design:paramtypes', [B], A);

    Reflect.defineMetadata('design:paramtypes', [A], B);

    const container = new Container();

    let thrownError: unknown;

    try {
      container.resolve(A);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError).not.toBeInstanceOf(RangeError);
  });

  it('throws an error for interface dependency without @Inject', () => {
    interface Config {
      apiUrl: string;
    }

    @Injectable()
    class ApiService {
      constructor(public config: Config) {}
    }

    const container = new Container();

    expect(() => container.resolve(ApiService)).toThrow(
      /Use @Inject\(token\) for interfaces/,
    );
  });
});

it('does not overwrite parent inject metadata', () => {
  const TOKEN_1 = Symbol('T1');
  const TOKEN_2 = Symbol('T2');

  class Parent {
    constructor(_value: unknown) {}
  }

  Inject(TOKEN_1)(Parent, undefined, 0);

  class Child extends Parent {}

  Inject(TOKEN_2)(Child, undefined, 0);

  const parentTokens = Reflect.getOwnMetadata(
    INJECT_TOKENS_METADATA_KEY,
    Parent,
  );

  const childTokens = Reflect.getOwnMetadata(INJECT_TOKENS_METADATA_KEY, Child);

  expect(parentTokens[0]).toBe(TOKEN_1);
  expect(childTokens[0]).toBe(TOKEN_2);
});
