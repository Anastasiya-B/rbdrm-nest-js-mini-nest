import { z } from 'zod';

export class CreateUserDto {
  email!: string;
}

export const CreateUserSchema = z
  .object({
    email: z.email(),
  })
  .transform(data => Object.assign(new CreateUserDto(), data));
