import { Injectable } from '../decorators/injectable';
import { RequestIdService } from './request-id.service';

@Injectable()
export class UserContextService {
  constructor(private readonly requestIdService: RequestIdService) {}

  async readRequestId(): Promise<string | undefined> {
    await Promise.resolve();

    return this.requestIdService.getCurrentRequestId();
  }
}
