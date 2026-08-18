import 'reflect-metadata';
import { describe, expect, it } from 'vitest';

import { Container } from '../src/container';
import { Inject } from '../src/decorators/inject';
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
});
