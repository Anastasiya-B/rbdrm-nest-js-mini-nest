import 'reflect-metadata';

import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { Container } from '../src/container';
import { Controller } from '../src/decorators/controller';
import { Get, Post } from '../src/decorators/methods';
import { Body, Param } from '../src/decorators/params';
import { Dispatcher } from '../src/dispatcher';
import { CreateUserDto, CreateUserSchema } from '../src/dto/create-user.dto';
import { NotFoundError } from '../src/errors/not-found.error';

const startServer = async (
  dispatcher: Dispatcher,
): Promise<{
  server: Server;
  baseUrl: string;
}> => {
  const server = createServer(dispatcher.handle);

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve());
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

describe('ExceptionFilter', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
  });

  it('maps NotFoundError to 404 with meaningful message', async () => {
    @Controller('users')
    class UsersController {
      @Get(':id')
      findOne(
        @Param('id')
        id: string,
      ) {
        throw new NotFoundError(`User ${id} not found`);
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users/42`);

    expect(response.status).toBe(404);

    expect(await response.json()).toEqual({
      statusCode: 404,
      message: 'User 42 not found',
    });
  });

  it('maps Zod validation error to 400 with field details', async () => {
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

  it('maps unexpected errors to safe 500 response', async () => {
    @Controller('users')
    class UsersController {
      @Get('boom')
      getBoom() {
        throw new Error('boom');
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users/boom`);

    expect(response.status).toBe(500);

    const rawBody = await response.text();

    expect(rawBody).not.toMatch(/boom|at .*\.ts:/);

    expect(JSON.parse(rawBody)).toEqual({
      statusCode: 500,
      message: 'Internal Server Error',
    });
  });
});
