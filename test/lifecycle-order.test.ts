import 'reflect-metadata';

import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { Container } from '../src/container';
import { Controller } from '../src/decorators/controller';
import { Post } from '../src/decorators/methods';
import { Body } from '../src/decorators/params';
import { Dispatcher } from '../src/dispatcher';
import type {
  ExecutionContext,
  Guard,
  Interceptor,
  Middleware,
  Pipe,
} from '../src/lifecycle';

class TestDto {
  value!: string;
}

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

describe('request lifecycle order', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
  });

  it('runs lifecycle stages in the correct order', async () => {
    const events: string[] = [];

    const middleware: Middleware = async (_context, next) => {
      events.push('middleware');

      await next();
    };

    const guard: Guard = {
      canActivate(_context: ExecutionContext) {
        events.push('guard');

        return true;
      },
    };

    const interceptor: Interceptor = {
      async intercept(_context: ExecutionContext, next) {
        events.push('interceptor:before');

        const result = await next();

        events.push('interceptor:after');

        return result;
      },
    };

    const pipe: Pipe = {
      transform(value) {
        events.push('pipe');

        return value;
      },
    };

    @Controller('users')
    class UsersController {
      @Post()
      create(
        @Body()
        body: TestDto,
      ) {
        events.push('handler');

        return body;
      }
    }

    const dispatcher = new Dispatcher(new Container(), [UsersController], {
      middleware,
      guard,
      interceptor,
      pipe,
    });

    const { server, baseUrl } = await startServer(dispatcher);

    servers.push(server);

    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: 'test',
      }),
    });

    expect(response.status).toBe(201);

    expect(events).toEqual([
      'middleware',
      'guard',
      'interceptor:before',
      'pipe',
      'handler',
      'interceptor:after',
    ]);
  });
});
