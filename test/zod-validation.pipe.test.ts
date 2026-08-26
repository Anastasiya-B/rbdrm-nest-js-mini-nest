import { describe, expect, it } from 'vitest';

import { CreateUserDto, CreateUserSchema } from '../src/dto/create-user.dto';
import {
  ValidationError,
  ZodValidationPipe,
} from '../src/pipes/zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('validates and transforms body into DTO instance', () => {
    const pipe = new ZodValidationPipe();

    const result = pipe.transform(
      {
        email: 'test@example.com',
      },
      CreateUserSchema,
    );

    expect(result).toBeInstanceOf(CreateUserDto);

    expect(result).toEqual({
      email: 'test@example.com',
    });
  });

  it('throws ValidationError for invalid body', () => {
    const pipe = new ZodValidationPipe();

    try {
      pipe.transform(
        {
          email: 'not-an-email',
        },
        CreateUserSchema,
      );

      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);

      if (error instanceof ValidationError) {
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

  it('returns value unchanged when schema is not provided', () => {
    const pipe = new ZodValidationPipe();

    const body = {
      message: 'hello',
    };

    const result = pipe.transform(body);

    expect(result).toBe(body);
  });
});
