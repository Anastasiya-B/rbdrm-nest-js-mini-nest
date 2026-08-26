import type { ServerResponse } from 'node:http';

import { NotFoundError } from '../errors/not-found.error';
import { ValidationError } from '../pipes/zod-validation.pipe';

const sendJson = (
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void => {
  res.statusCode = statusCode;

  res.setHeader('Content-Type', 'application/json');

  res.end(JSON.stringify(body));
};

export class ExceptionFilter {
  catch(error: unknown, res: ServerResponse): void {
    if (error instanceof ValidationError) {
      sendJson(res, 400, {
        statusCode: 400,
        message: 'Validation failed',
        errors: error.errors,
      });

      return;
    }

    if (error instanceof NotFoundError) {
      sendJson(res, 404, {
        statusCode: 404,
        message: error.message,
      });

      return;
    }

    sendJson(res, 500, {
      statusCode: 500,
      message: 'Internal Server Error',
    });
  }
}
