# mini-nest

Simple mini-Nest implementation written in TypeScript.

The project started as a small IoC container and was extended with decorator-based HTTP routing, parameter injection, Zod validation, a full request lifecycle, exception handling, and request-scoped context on top of `node:http`.

## Install

```bash
npm install
```

## Run tests

```bash
npm test
```

## Run tests in Docker

```bash
docker compose build
docker compose run --rm api npm test
```

## Build

```bash
npm run build
```

## How IoC works

Classes that can be created by the container are marked with `@Injectable()`.

When `experimentalDecorators` and `emitDecoratorMetadata` are enabled in `tsconfig.json`, TypeScript stores constructor parameter types in metadata under `design:paramtypes`.

The container reads this metadata using:

```ts
Reflect.getMetadata('design:paramtypes', Target);
```

and recursively resolves constructor dependencies.

Without `emitDecoratorMetadata`, TypeScript does not emit constructor type metadata, so the container cannot automatically know which dependencies should be created.

Interfaces do not exist at runtime, so `@Inject(token)` is used for dependencies that need an explicit string or `Symbol` token.

The container supports two scopes:

- `singleton` — one instance per container
- `transient` — a new instance on every resolve

Circular dependencies are detected during resolution and return a readable error such as:

```text
Circular dependency: A -> B -> A
```

## HTTP routing

HTTP routing is implemented without NestJS, Express, or Fastify. The dispatcher works directly on top of `node:http`.

Controllers are marked with `@Controller(prefix)`:

```ts
@Controller('users')
class UsersController {}
```

HTTP methods are registered with `@Get(path)` and `@Post(path)`:

```ts
@Controller('users')
class UsersController {
  @Get(':id')
  findOne() {}

  @Post()
  create() {}
}
```

The router reads metadata created by these decorators and combines the controller prefix with the method path.

For example:

```text
@Controller('users') + @Get(':id')
```

becomes:

```text
GET /users/:id
```

so a request to:

```text
GET /users/42
```

matches the route and produces:

```ts
{
  id: '42',
}
```

as route parameters.

Routes are discovered from decorator metadata rather than from a hardcoded array of application paths.

## Parameter decorators

The project supports:

- `@Body()`
- `@Param(name)`
- `@Query(name)`

Parameter decorators do not read values from the HTTP request themselves. They only store metadata describing where the dispatcher should get the value from.

A TypeScript parameter decorator receives:

```ts
target;
propertyKey;
parameterIndex;
```

The important value is `parameterIndex`. It identifies the exact position of the argument in the controller method.

For example:

```ts
@Get(':id')
findOne(
  @Param('id') id: string,
  @Query('limit') limit: string,
) {}
```

stores metadata conceptually similar to:

```ts
{
  0: {
    type: 'param',
    name: 'id',
  },
  1: {
    type: 'query',
    name: 'limit',
  },
}
```

When a request arrives, the dispatcher reads this metadata and builds an argument array using the stored indexes:

```ts
args[0] = params.id;
args[1] = query.limit;
```

The handler is then invoked with:

```ts
handler.apply(controller, args);
```

This is how a parameter decorator knows where its value should be inserted without reading the request directly.

## Request lifecycle

The dispatcher implements the following request lifecycle:

```text
HTTP Request
    |
    v
Middleware
    |
    v
Guard
    |
    v
Interceptor (before)
    |
    v
Pipe
    |
    v
Handler
    |
    v
Interceptor (after)
    |
    v
HTTP Response

Any error from the lifecycle
    |
    v
Exception Filter
```

Each stage has its own responsibility:

- **Middleware** runs at the beginning of the request lifecycle.
- **Guard** decides whether the request is allowed to continue.
- **Interceptor** wraps the next stages and can run logic both before and after them.
- **Pipe** transforms or validates an argument immediately before it is passed to the handler.
- **Handler** executes the controller method.
- **Exception Filter** catches errors from the lifecycle and maps them to safe HTTP responses.

The lifecycle order is verified by an integration test that expects exactly:

```ts
[
  'middleware',
  'guard',
  'interceptor:before',
  'pipe',
  'handler',
  'interceptor:after',
];
```

## Dispatcher

The dispatcher coordinates the full HTTP request flow:

```text
HTTP request
    ↓
create / reuse requestId
    ↓
AsyncLocalStorage context
    ↓
parse URL
    ↓
find matching route
    ↓
Middleware
    ↓
Guard
    ↓
Interceptor before
    ↓
extract params / query / body
    ↓
Pipe
    ↓
Handler
    ↓
Interceptor after
    ↓
serialize result to JSON
```

The dispatcher resolves controllers through the IoC container:

```ts
container.resolve(Controller);
```

Controllers are therefore not created manually with `new`, and constructor dependencies are still resolved by the container from Part 1.

## Auth Guard

`AuthGuard` checks the `Authorization` request header before validation and before the controller handler is executed.

A request without an authorization header is rejected with:

```text
HTTP 403 Forbidden
```

If the guard returns `false`, the handler is not invoked.

This is the main difference between a guard and an interceptor: a guard decides whether the request may continue, while an interceptor wraps the following lifecycle stages and can observe both the incoming execution and its result.

## Logging Interceptor

`LoggingInterceptor` wraps the pipe and handler execution.

It records the start time before calling `next()` and calculates the duration after the wrapped execution finishes.

Example:

```text
GET /users/42 — 12.3 ms
```

Because it wraps `next()`, the interceptor can execute code both before and after the handler.

## Request body

POST request bodies are read directly from the `IncomingMessage` stream.

The dispatcher collects request chunks, converts them into a string, and parses the result with:

```ts
JSON.parse(rawBody);
```

A regular parameter such as:

```ts
@Body() body: object
```

receives the parsed plain JavaScript object.

## Zod validation pipe

DTO validation is implemented with Zod 4.

A schema can be attached directly to `@Body()`:

```ts
@Post()
create(
  @Body(CreateUserSchema)
  body: CreateUserDto,
) {
  return body;
}
```

Example DTO and schema:

```ts
import { z } from 'zod';

export class CreateUserDto {
  email!: string;
}

export const CreateUserSchema = z
  .object({
    email: z.email(),
  })
  .transform(data => Object.assign(new CreateUserDto(), data));
```

The dispatcher passes the parsed request body and schema to `ZodValidationPipe`.

The pipe validates input using:

```ts
schema.safeParse(value);
```

For invalid input, validation details are built using the Zod 4 API:

```ts
result.error.issues;
```

For a valid body, the transformed value reaches the handler.

For this schema, the handler receives an actual DTO instance:

```ts
body instanceof CreateUserDto === true;
```

A `@Body()` decorator without a schema still receives the parsed JSON body without validation.

Invalid input produces HTTP `400` with a list of invalid fields.

Example:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "constraints": ["Invalid email address"]
    }
  ]
}
```

## Exception Filter

`ExceptionFilter` converts errors from the request lifecycle into HTTP responses.

The current mappings are:

```text
ValidationError  -> 400
NotFoundError    -> 404
unknown error    -> 500
```

A domain error such as:

```ts
throw new NotFoundError('User 42 not found');
```

is returned as an HTTP `404` with a meaningful message.

Unexpected errors are hidden from the client.

For example:

```ts
throw new Error('boom');
```

returns:

```json
{
  "statusCode": 500,
  "message": "Internal Server Error"
}
```

The original error message and stack trace are not exposed in the HTTP response.

The exception filter sits at the outer level of the request lifecycle, so it also catches errors thrown by handlers, pipes, and interceptors.

## Request context and AsyncLocalStorage

Every incoming HTTP request receives a `requestId`.

If the client sends:

```text
X-Request-Id
```

that value is reused.

Otherwise, the dispatcher generates a new UUID.

The same id is returned to the client in the response header:

```text
X-Request-Id
```

Request-specific context is stored using Node.js `AsyncLocalStorage` from `node:async_hooks`.

The whole request lifecycle is executed inside:

```ts
AsyncLocalStorage.run(...);
```

so code deep in the dependency tree can access the current request id without receiving it explicitly as a method argument.

For example:

```text
Controller
    ↓
UserContextService
    ↓
RequestIdService
    ↓
AsyncLocalStorage
```

The services do not need signatures such as:

```ts
someMethod(requestId: string)
```

Instead, they read the id from the current asynchronous context.

### Why AsyncLocalStorage instead of a global variable?

A global variable cannot safely hold request-specific data in an asynchronous HTTP server.

While one request is waiting for an `await`, the Node.js event loop may start processing another request. If both requests store their ids in the same global variable, the second request can overwrite the value before the first request continues.

The first request could then accidentally use the second request's id in a service, repository, or log entry.

`AsyncLocalStorage` keeps an independent store for each asynchronous execution chain. Multiple requests can therefore run concurrently while each one continues to see its own `requestId`.

This behavior is verified by a test that sends ten concurrent requests with different `X-Request-Id` values and checks that no id leaks into another response.

## Example requests

Dynamic route parameter:

```text
GET /users/42
```

with:

```ts
@Get(':id')
findOne(
  @Param('id') id: string,
) {}
```

passes:

```text
42
```

to the controller method.

Query parameter:

```text
GET /users?limit=5
```

with:

```ts
@Get()
findAll(
  @Query('limit') limit: string,
) {}
```

passes:

```text
5
```

as a separate method argument.

POST body with Zod validation:

```text
POST /users
Content-Type: application/json
```

```json
{
  "email": "user@example.com"
}
```

with:

```ts
@Post()
create(
  @Body(CreateUserSchema)
  body: CreateUserDto,
) {}
```

passes the validated and transformed body to the handler.

A client-provided request id:

```text
X-Request-Id: client-request-123
```

is available in deep services through `AsyncLocalStorage` and is returned unchanged in the response header.

## Tests

The test suite covers:

- recursive IoC dependency resolution
- singleton and transient scopes
- explicit injection tokens
- circular dependency detection
- controller metadata
- GET and POST route metadata
- parameter metadata and argument indexes
- controller prefix and method path composition
- static and dynamic route matching
- `@Param()` injection
- `@Query()` injection
- `@Body()` parsing
- HTTP 404 responses
- controller dependency resolution through the IoC container
- exact request lifecycle order
- `AuthGuard` returning 403 before the handler
- successful requests with an `Authorization` header
- `LoggingInterceptor` request duration logging
- Zod 4 request body validation
- valid DTO transformation
- invalid DTO response with HTTP 400 and field details
- `NotFoundError` mapping to HTTP 404
- unexpected errors mapping to a safe HTTP 500 response
- generated `X-Request-Id`
- reuse of a client-provided `X-Request-Id`
- deep service access to request context
- isolation of request context across ten concurrent HTTP requests

Run all tests with:

```bash
npm test
```

or inside Docker:

```bash
docker compose run --rm api npm test
```
