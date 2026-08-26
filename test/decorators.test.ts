import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import {
  CONTROLLER_PREFIX_METADATA_KEY,
  Controller,
} from '../src/decorators/controller';
import {
  Get,
  Post,
  ROUTE_METADATA_KEY,
  type RouteMetadata,
} from '../src/decorators/methods';
import {
  Body,
  Param,
  PARAMS_METADATA_KEY,
  Query,
  type ParametersMetadata,
} from '../src/decorators/params';

describe('HTTP decorators', () => {
  it('@Controller stores controller prefix metadata', () => {
    @Controller('users')
    class UsersController {}

    const prefix = Reflect.getMetadata(
      CONTROLLER_PREFIX_METADATA_KEY,
      UsersController,
    );

    expect(prefix).toBe('users');
  });

  it('@Get stores GET route metadata', () => {
    class UsersController {
      @Get(':id')
      findOne() {}
    }

    const metadata = Reflect.getMetadata(
      ROUTE_METADATA_KEY,
      UsersController.prototype,
      'findOne',
    ) as RouteMetadata;

    expect(metadata).toEqual({
      method: 'GET',
      path: ':id',
    });
  });

  it('@Post stores POST route metadata', () => {
    class UsersController {
      @Post()
      create() {}
    }

    const metadata = Reflect.getMetadata(
      ROUTE_METADATA_KEY,
      UsersController.prototype,
      'create',
    ) as RouteMetadata;

    expect(metadata).toEqual({
      method: 'POST',
      path: '',
    });
  });

  it('stores @Param, @Query and @Body parameter metadata by argument index', () => {
    class UsersController {
      create(
        @Param('id') id: string,
        @Query('limit') limit: string,
        @Body() body: object,
      ) {
        return {
          id,
          limit,
          body,
        };
      }
    }

    const metadata = Reflect.getMetadata(
      PARAMS_METADATA_KEY,
      UsersController.prototype,
      'create',
    ) as ParametersMetadata;

    expect(metadata).toEqual({
      0: {
        type: 'param',
        name: 'id',
      },
      1: {
        type: 'query',
        name: 'limit',
      },
      2: {
        type: 'body',
        name: undefined,
      },
    });
  });
});
