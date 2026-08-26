# mini-nest

Simple IoC container written in TypeScript.

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

## How it works

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
A -> B -> A
```
