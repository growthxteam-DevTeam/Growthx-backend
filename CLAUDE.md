# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev       # run with hot reload (primary dev workflow)
npm run build            # nest build
npm run start:prod       # run compiled output from dist/

npm run lint              # eslint --fix over src, apps, libs, test
npm run format             # prettier --write over src and test

npm test                    # run all unit/spec tests (jest, rootDir: src)
npm test -- user.service     # run tests matching a name/path pattern
npm run test:watch            # jest --watch
npm run test:cov               # jest with coverage
npm run test:e2e                # e2e tests via test/jest-e2e.json (separate config, not under rootDir: src)
```

There is currently only one spec file (`src/app.controller.spec.ts`) and one e2e spec (`test/app.e2e-spec.ts`); most modules have no tests yet.

## Architecture

NestJS 11 REST API (MongoDB via TypeORM's `mongodb` connector, not Mongoose). Global route prefix is `api/v1` (set in [src/main.ts](src/main.ts)). Standard Nest module layout per domain: `*.module.ts` / `*.controller.ts` / `*.service.ts` / `dto/` / `entities/`.

Modules: `auth`, `user`, `products`, `categories`, wired together in [src/app.module.ts](src/app.module.ts).

### Data model (MongoDB via TypeORM)

- `UserEntity` — `@ObjectIdColumn`, has `roles: Roles[]` (enum: `admin`/`user`), `password` marked `@Exclude()` so `ClassSerializerInterceptor` strips it from responses.
- `CategoryEntity` — belongs to a `UserEntity` (`addedBy`, many-to-one), has many `ProductEntity`.
- `ProductEntity` — belongs to a `UserEntity` (`addedBy`) and a `CategoryEntity` (`category`), both many-to-one.

Relations are declared with TypeORM decorators (`@OneToMany`/`@ManyToOne`/`@JoinColumn`) even though the underlying store is MongoDB — joins are not enforced by the DB itself, so relation integrity depends on application code.

`synchronize: true` is set on the TypeORM connection ([src/app.module.ts](src/app.module.ts)) — schema/collection shape is derived from entities automatically at boot, there are no migrations.

### Auth flow (custom, not Passport)

This project does **not** use `@nestjs/passport`. Auth is hand-rolled:

1. `AuthService.signup` / `signin` ([src/auth/auth.service.ts](src/auth/auth.service.ts)) hash passwords with `bcrypt` and sign a JWT (`{ id, email }`) via `@nestjs/jwt`, configured in [src/auth/auth.module.ts](src/auth/auth.module.ts) from `ACCESS_TOKEN_SECRET_KEY` / `ACCESS_TOKEN_EXPIRE_TIME` env vars (not present in `.env.example` — add them there if changed).
2. `CurrentUserMiddleware` ([src/utility/middlewares/current-user.middleware.ts](src/utility/middlewares/current-user.middleware.ts)) runs on every route (registered in `AppModule.configure`), decodes the bearer JWT (no signature verification here, just `jwt.decode`), loads the `UserEntity` by id, and attaches it to `req.currentUser`.
3. `AuthenticationGuard` ([src/utility/guards/authentication.guard.ts](src/utility/guards/authentication.guard.ts)) rejects requests with no `req.currentUser`.
4. `AuthorizationGuard` + `@AuthroizeRoles(...)` decorator ([src/utility/decorators/authorize-roles.decorator.ts](src/utility/decorators/authorize-roles.decorator.ts) — note the typo, keep it consistent with existing usage) restrict routes to specific `Roles`.
5. `@CurrentUser()` param decorator ([src/utility/decorators/current-user.decorator.ts](src/utility/decorators/current-user.decorator.ts)) pulls `req.currentUser` into a controller method.

Pattern for a protected, role-gated route (see [src/products/products.controller.ts](src/products/products.controller.ts), [src/categories/categories.controller.ts](src/categories/categories.controller.ts)):

```ts
@Post()
@UseGuards(AuthenticationGuard, AuthorizationGuard)
@AuthroizeRoles(Roles.ADMIN)
create(@Body() dto: CreateXDto, @CurrentUser() currentUser: UserEntity) { ... }
```

Guards/decorators are applied per-route, not globally — new endpoints that should require auth must opt in explicitly. `AuthorizationGuard` alone does not imply authentication; it must be paired with `AuthenticationGuard` (order matters: authentication first).

Since `password` uses `@Exclude()`, controllers that return a `UserEntity` (directly or nested) need `@UseInterceptors(ClassSerializerInterceptor)` on the controller (see `AuthController`) or the password will leak in the response.

### Validation

Global `ValidationPipe` in [src/main.ts](src/main.ts) has `whitelist: true` and `forbidNonWhitelisted: true` — DTOs must declare every field they accept (via `class-validator` decorators) or requests with extra fields are rejected outright.

## Environment

Config is loaded via `@nestjs/config` (`ConfigModule.forRoot({ isGlobal: true })`), reading from `.env`. `.env.example` only lists `MONGODB_URI` and `PORT`; the JWT vars (`ACCESS_TOKEN_SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_TIME`) used by `AuthModule` are undocumented there.
