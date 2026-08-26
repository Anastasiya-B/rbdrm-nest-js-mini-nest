# mini-nest

Simple mini-Nest implementation written in TypeScript.

The project started as a small IoC container and was extended with decorator-based HTTP routing, parameter injection, DTO transformation, and validation on top of `node:http`.

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

## Dispatcher

The dispatcher handles the HTTP request lifecycle implemented in this project:

```text
HTTP request
    ↓
parse URL
    ↓
find matching route
    ↓
extract route params / query / body
    ↓
transform and validate DTO when needed
    ↓
resolve controller through Container
    ↓
invoke controller method
    ↓
serialize result to JSON
```

The dispatcher resolves controllers through the IoC container:

```ts
container.resolve(Controller);
```

Controllers are therefore not created manually with `new`, and constructor dependencies are still resolved by the container from Part 1.

## Request body

POST request bodies are read directly from the `IncomingMessage` stream.

The dispatcher collects request chunks, converts them to a string, and parses the result with:

```ts
JSON.parse(rawBody);
```

A regular parameter such as:

```ts
@Body() body: object
```

receives the parsed plain JavaScript object.

## DTO validation

DTO validation is implemented using:

- `class-transformer`
- `class-validator`

Example DTO:

```ts
export class CreateUserDto {
  @IsEmail()
  email!: string;
}
```

For a controller method such as:

```ts
@Post()
create(
  @Body() body: CreateUserDto,
) {}
```

TypeScript emits method parameter type metadata under:

```ts
design: paramtypes;
```

The dispatcher reads the DTO class from that metadata.

The validation pipe first converts the plain request body into a real DTO instance:

```ts
plainToInstance(CreateUserDto, body);
```

and then validates that instance:

```ts
validate(instance);
```

This order is important because `class-validator` works with class instances rather than raw plain objects.

For a valid request body, the controller receives an actual DTO instance:

```ts
body instanceof CreateUserDto === true;
```

For an invalid body, the dispatcher returns HTTP `400` with validation details for all invalid fields.

Example:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "constraints": {
        "isEmail": "email must be an email"
      }
    }
  ]
}
```

Built-in parameter types such as `Object`, `String`, `Number`, `Boolean`, and `Array` are not treated as DTO classes and are not passed through DTO validation.

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

POST body:

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
  @Body() body: CreateUserDto,
) {}
```

passes a validated `CreateUserDto` instance to the handler.

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
- DTO transformation into a class instance
- invalid DTO response with HTTP 400 and validation details
- valid DTO reaching the controller method

Run all tests with:

```bash
npm test
```

or inside Docker:

```bash
docker compose run --rm api npm test
```
