import 'reflect-metadata';

import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { Container } from '../src/container';
import { Controller } from '../src/decorators/controller';
import { Injectable } from '../src/decorators/injectable';
import { Get, Post } from '../src/decorators/methods';
import { Body, Param, Query } from '../src/decorators/params';
import { Dispatcher } from '../src/dispatcher';
import { CreateUserDto, CreateUserSchema } from '../src/dto/create-user.dto';

const startServer = async (
  dispatcher: Dispatcher,
): Promise<{
  server: Server;
  baseUrl: string;
}> => {
  const server = createServer(dispatcher.handle);

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Could not determine server address');
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const closeServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

describe('Dispatcher', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
  });

  it('passes @Param value to controller method', async () => {
    @Controller('users')
    class UsersController {
      @Get(':id')
      findOne(
        @Param('id')
        id: string,
      ) {
        return { id };
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users/42`);

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      id: '42',
    });
  });

  it('passes @Query value to controller method', async () => {
    @Controller('users')
    class UsersController {
      @Get()
      findAll(
        @Query('limit')
        limit: string,
      ) {
        return {
          limit,
        };
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users?limit=5`);

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      limit: '5',
    });
  });

  it('passes parsed JSON body to controller method', async () => {
    @Controller('users')
    class UsersController {
      @Post()
      create(
        @Body()
        body: {
          email: string;
        },
      ) {
        return body;
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
      }),
    });

    expect(response.status).toBe(201);

    expect(await response.json()).toEqual({
      email: 'test@example.com',
    });
  });

  it('passes valid body as CreateUserDto instance', async () => {
    let receivedBody: CreateUserDto | undefined;

    @Controller('users')
    class UsersController {
      @Post()
      create(
        @Body(CreateUserSchema)
        body: CreateUserDto,
      ) {
        receivedBody = body;

        return {
          email: body.email,
        };
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
      }),
    });

    expect(response.status).toBe(201);

    expect(receivedBody).toBeInstanceOf(CreateUserDto);

    expect(await response.json()).toEqual({
      email: 'test@example.com',
    });
  });

  it('returns 400 with validation details for invalid DTO', async () => {
    @Controller('users')
    class UsersController {
      @Post()
      create(
        @Body(CreateUserSchema)
        body: CreateUserDto,
      ) {
        return body;
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'not-an-email',
      }),
    });

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(JSON.stringify(body)).toMatch(/email/);
  });

  it('resolves controller dependencies through Container', async () => {
    @Injectable()
    class UsersService {
      readonly id = Math.random();
    }

    @Controller('users')
    class UsersController {
      constructor(private readonly usersService: UsersService) {}

      @Get('service-id')
      getServiceId() {
        return {
          id: this.usersService.id,
        };
      }
    }

    const container = new Container();

    const service = container.resolve(UsersService);

    const dispatcher = new Dispatcher(container, [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users/service-id`);

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      id: service.id,
    });
  });

  it('returns 404 when route is not found', async () => {
    @Controller('users')
    class UsersController {
      @Get()
      findAll() {
        return [];
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/unknown`);

    expect(response.status).toBe(404);
  });
});
