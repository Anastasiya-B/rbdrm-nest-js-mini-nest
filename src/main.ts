import 'reflect-metadata';

import { createServer } from 'node:http';

import { Container } from './container';
import { Controller } from './decorators/controller';
import { Get } from './decorators/methods';
import { Param } from './decorators/params';
import { Dispatcher } from './dispatcher';
import { UserContextService } from './services/user-context.service';

@Controller('users')
class UsersController {
  constructor(private readonly userContextService: UserContextService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const requestId = await this.userContextService.readRequestId();

    return {
      id,
      requestId,
    };
  }
}

const container = new Container();

const dispatcher = new Dispatcher(container, [UsersController]);

const server = createServer(dispatcher.handle);

server.listen(3000, () => {
  console.log('mini-nest is running on http://localhost:3000');
});
