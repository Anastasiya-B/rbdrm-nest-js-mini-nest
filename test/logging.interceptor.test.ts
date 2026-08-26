import 'reflect-metadata';

import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { Container } from '../src/container';
import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { Dispatcher } from '../src/dispatcher';
import { LoggingInterceptor } from '../src/interceptors/logging.interceptor';

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

describe('LoggingInterceptor', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();

    await Promise.all(servers.splice(0).map(closeServer));
  });

  it('logs method, path and request duration', async () => {
    @Controller('users')
    class UsersController {
      @Get(':id')
      async findOne() {
        await new Promise(resolve => setTimeout(resolve, 5));

        return {
          ok: true,
        };
      }
    }

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const dispatcher = new Dispatcher(new Container(), [UsersController], {
      interceptor: new LoggingInterceptor(),
    });

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users/42`);

    expect(response.status).toBe(200);

    expect(logSpy).toHaveBeenCalledTimes(1);

    const message = String(logSpy.mock.calls[0][0]);

    expect(message).toContain('GET /users/42');

    expect(message).toMatch(/[0-9]+(\.[0-9]+)? ?ms/);
  });
});
