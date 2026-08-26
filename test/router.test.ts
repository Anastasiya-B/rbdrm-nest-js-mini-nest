import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { Controller } from '../src/decorators/controller';
import { Get, Post } from '../src/decorators/methods';
import { createRoutes, matchRoute } from '../src/router';

describe('router', () => {
  it('builds routes from controller and method metadata', () => {
    @Controller('users')
    class UsersController {
      @Get(':id')
      findOne() {}

      @Post()
      create() {}
    }

    const routes = createRoutes([UsersController]);

    expect(routes).toHaveLength(2);

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          httpMethod: 'GET',
          path: '/users/:id',
          controller: UsersController,
          handlerName: 'findOne',
        }),
        expect.objectContaining({
          httpMethod: 'POST',
          path: '/users',
          controller: UsersController,
          handlerName: 'create',
        }),
      ]),
    );
  });

  it('normalizes controller prefix and method path', () => {
    @Controller('/users/')
    class UsersController {
      @Get('/profile/')
      profile() {}
    }

    const routes = createRoutes([UsersController]);

    expect(routes[0].path).toBe('/users/profile');
  });

  it('matches a static route', () => {
    @Controller('users')
    class UsersController {
      @Get()
      findAll() {}
    }

    const routes = createRoutes([UsersController]);

    const match = matchRoute(routes, 'GET', '/users');

    expect(match).not.toBeNull();
    expect(match?.route.handlerName).toBe('findAll');
    expect(match?.params).toEqual({});
  });

  it('matches dynamic route parameters', () => {
    @Controller('users')
    class UsersController {
      @Get(':id')
      findOne() {}
    }

    const routes = createRoutes([UsersController]);

    const match = matchRoute(routes, 'GET', '/users/42');

    expect(match).not.toBeNull();
    expect(match?.route.handlerName).toBe('findOne');

    expect(match?.params).toEqual({
      id: '42',
    });
  });

  it('does not match a different HTTP method', () => {
    @Controller('users')
    class UsersController {
      @Get(':id')
      findOne() {}
    }

    const routes = createRoutes([UsersController]);

    const match = matchRoute(routes, 'POST', '/users/42');

    expect(match).toBeNull();
  });

  it('does not match a different path', () => {
    @Controller('users')
    class UsersController {
      @Get(':id')
      findOne() {}
    }

    const routes = createRoutes([UsersController]);

    const match = matchRoute(routes, 'GET', '/products/42');

    expect(match).toBeNull();
  });
});
