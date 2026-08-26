import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

interface RequestContextStore {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

export const createRequestId = (incomingRequestId?: string): string => {
  const trimmed = incomingRequestId?.trim();

  if (trimmed) {
    return trimmed;
  }

  return randomUUID();
};

export const runWithRequestContext = async <T>(
  requestId: string,
  callback: () => Promise<T>,
): Promise<T> => {
  return storage.run(
    {
      requestId,
    },
    callback,
  );
};

export const getRequestId = (): string | undefined => {
  return storage.getStore()?.requestId;
};
