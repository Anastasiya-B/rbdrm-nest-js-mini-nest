import { Injectable } from '../decorators/injectable';
import { getRequestId } from '../context/request-context';

@Injectable()
export class RequestIdService {
  getCurrentRequestId(): string | undefined {
    return getRequestId();
  }
}
