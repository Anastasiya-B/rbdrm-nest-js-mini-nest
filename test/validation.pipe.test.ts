import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { CreateUserDto } from '../src/dto/create-user.dto';
import {
  ValidationException,
  ValidationPipe,
} from '../src/pipes/validation.pipe';

describe('ValidationPipe', () => {
  it('transforms plain object into DTO instance', async () => {
    const pipe = new ValidationPipe();

    const result = await pipe.transform(
      {
        email: 'test@example.com',
      },
      CreateUserDto,
    );

    expect(result).toBeInstanceOf(CreateUserDto);

    expect(result.email).toBe('test@example.com');
  });

  it('throws validation error for invalid DTO', async () => {
    const pipe = new ValidationPipe();

    try {
      await pipe.transform(
        {
          email: 'not-an-email',
        },
        CreateUserDto,
      );

      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);

      if (error instanceof ValidationException) {
        expect(error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
            }),
          ]),
        );
      }
    }
  });
});
