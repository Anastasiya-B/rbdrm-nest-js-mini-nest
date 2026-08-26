import 'reflect-metadata';

import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { Container } from '../src/container';
import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { Dispatcher } from '../src/dispatcher';
import { UserContextService } from '../src/services/user-context.service';

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

describe('request context', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
  });

  it('returns generated X-Request-Id and exposes it in deep service', async () => {
    @Controller('users')
    class UsersController {
      constructor(private readonly userContextService: UserContextService) {}

      @Get(':id')
      async findOne() {
        const requestId = await this.userContextService.readRequestId();

        return {
          requestId,
        };
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users/1`);

    expect(response.status).toBe(200);

    const headerRequestId = response.headers.get('x-request-id');

    expect(headerRequestId).toBeTruthy();

    const body = (await response.json()) as {
      requestId: string;
    };

    expect(body.requestId).toBe(headerRequestId);
  });

  it('returns client X-Request-Id unchanged', async () => {
    @Controller('users')
    class UsersController {
      constructor(private readonly userContextService: UserContextService) {}

      @Get(':id')
      async findOne() {
        return {
          requestId: await this.userContextService.readRequestId(),
        };
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const requestId = 'client-request-123';

    const response = await fetch(`${baseUrl}/users/1`, {
      headers: {
        'X-Request-Id': requestId,
      },
    });

    expect(response.headers.get('x-request-id')).toBe(requestId);

    const body = (await response.json()) as {
      requestId: string;
    };

    expect(body.requestId).toBe(requestId);
  });

  it('does not mix request context between parallel requests', async () => {
    @Controller('users')
    class UsersController {
      constructor(private readonly userContextService: UserContextService) {}

      @Get(':id')
      async findOne() {
        await new Promise(resolve =>
          setTimeout(resolve, Math.floor(Math.random() * 10)),
        );

        return {
          requestId: await this.userContextService.readRequestId(),
        };
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController]);

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const requestIds = Array.from(
      { length: 10 },
      (_, index) => `request-${index + 1}`,
    );

    const responses = await Promise.all(
      requestIds.map(requestId =>
        fetch(`${baseUrl}/users/1`, {
          headers: {
            'X-Request-Id': requestId,
          },
        }),
      ),
    );

    const results = await Promise.all(
      responses.map(async response => ({
        header: response.headers.get('x-request-id'),
        body: (await response.json()) as {
          requestId: string;
        },
      })),
    );

    results.forEach((result, index) => {
      expect(result.header).toBe(requestIds[index]);

      expect(result.body.requestId).toBe(requestIds[index]);
    });
  });
});
