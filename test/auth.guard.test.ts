import 'reflect-metadata';

import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { Container } from '../src/container';
import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { Dispatcher } from '../src/dispatcher';
import { AuthGuard } from '../src/guards/auth.guard';

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

describe('AuthGuard', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
  });

  it('returns 403 and does not call handler without Authorization', async () => {
    let handlerCalls = 0;

    @Controller('users')
    class UsersController {
      @Get()
      findAll() {
        handlerCalls += 1;

        return [];
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController], {
      guard: new AuthGuard(),
    });

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users`);

    expect(response.status).toBe(403);
    expect(handlerCalls).toBe(0);

    expect(await response.json()).toEqual({
      statusCode: 403,
      message: 'Forbidden',
    });
  });

  it('allows request with Authorization header', async () => {
    let handlerCalls = 0;

    @Controller('users')
    class UsersController {
      @Get()
      findAll() {
        handlerCalls += 1;

        return {
          ok: true,
        };
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController], {
      guard: new AuthGuard(),
    });

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users`, {
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    expect(response.status).toBe(200);
    expect(handlerCalls).toBe(1);

    expect(await response.json()).toEqual({
      ok: true,
    });
  });
});
