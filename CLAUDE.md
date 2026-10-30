# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev       # run with hot reload (primary dev workflow)
npm run build           # nest build
npm run start:prod      # run compiled output from dist/

npm run lint            # eslint --fix over src, apps, libs, test
npm run format          # prettier --write over src and test

npm test                # unit/spec tests (jest, rootDir: src)
npm test -- <pattern>   # run tests matching a name/path pattern
npm run test:watch      # jest --watch
npm run test:cov        # jest with coverage
npm run test:e2e        # e2e tests via test/jest-e2e.json (separate config, not under rootDir: src)
```

Only the scaffold tests exist (`src/app.controller.spec.ts`, `test/app.e2e-spec.ts`); the applications
module has none.

## Architecture

NestJS 11 REST API ("Growth X" backend), MongoDB via TypeORM's `mongodb` connector (not Mongoose). Global
route prefix is `api/v1`, CORS is enabled globally ([src/main.ts](src/main.ts)). Default port is `5000`.
Standard Nest layout per domain: `*.module.ts` / `*.controller.ts` / `*.service.ts` / `dto/` / `entities/`.

`AppModule` ([src/app.module.ts](src/app.module.ts)) imports `ApplicationsModule`, `AuthModule` and
`DiscussionsModule`. An applicant's account _is_ their application record: the one-time `gsCode`, emailed only after
the Bachs payment is confirmed, is exchanged via `POST /applications/create-password` for a bcrypt `passwordHash`, then `POST /auth/login`
(`src/auth/`) verifies email + password and returns a JWT signed with `JWT_SECRET`.

Protected routes opt in per controller/route with `@UseGuards(JwtAuthGuard)` (`src/auth/jwt-auth.guard.ts`, which
verifies the bearer token and sets `request.user = { id, email }`) and read the caller with `@CurrentUser()`.
`id` is the applicant's application `_id`. Nothing is guarded globally and there are no roles — ask before adding
them. The frontend's admin-login and banner RTK endpoints (`/admin/auth/login`, banners) still have no backend
counterpart.

### Discussions module

`src/discussions/` backs the class page's comment thread: `GET`/`POST /discussions/:classId/comments` and
`POST /discussions/comments/:id/like` / `.../dislike`, all behind `JwtAuthGuard`. Comments live in their own
`discussion_comments` collection with the author's name/photo copied in at write time, replies are one level deep
(`parentId`), and likes/dislikes are mutually exclusive `likedBy`/`dislikedBy` arrays of author ids (`likeCount` is
kept equal to `likedBy.length` so `top` sort can happen in the database). `GET` takes a `sort` query
(`newest` | `oldest` | `top`); pinned comments (`pinned: true`) always sort first regardless. `pinned` and
`staffPost` have no endpoint yet — set them directly in MongoDB. There is no websocket; the frontend polls. Mongo
operators (`$in`, `null` matching) don't type-check in TypeORM where clauses, so the service funnels them through
the `mongoWhere()` cast.

### Quizzes module

`src/quizzes/` serves quizzes defined in code (`quizzes.data.ts`, answer key included) and grades submissions.
`GET /quizzes/:quizId` strips the `correct` flags before responding — never send them to the client. A question scores
its points only when the chosen options exactly match the correct set (so multi-select is all-or-nothing); unanswered
questions score zero. Every submission is saved as a `quiz_attempts` document (retakes allowed), and the latest one
comes back as `lastAttempt`. Adding a quiz means adding an entry to `QUIZZES` and pointing the frontend's `QUIZ_ID` at it.

### Resources module

`src/resources/` serves the dashboard's Resource Vault: `GET /resources` (JWT) returns articles and videos pulled from the
curated RSS/Atom feeds in `resources.sources.ts`, filtered by category keyword lists or a free-text `q`. That file is the
only way content enters the vault ("verified" = we chose the publisher), so add a source there, after checking its feed
answers without a key. Feeds are cached in memory for 30 minutes and a failing feed is skipped. Item links are
validated to be `http(s)` before they reach the client. No Mongo, no env vars.

### Applications module

Three routes (see [README.md](README.md) for payloads and response shapes): `POST /applications` accepts the frontend
onboarding wizard as `multipart/form-data`, creates a Bachs checkout and emails the payment link (no GS code yet);
`POST /applications/payment-webhook` (Bachs calls it) re-fetches the checkout from Bachs, sets `paidAt` and emails the
GS code; `POST /applications/create-password` (JSON) sets the password from that GS code and 403s unpaid applications
that have `paymentRequired`. Never trust the webhook body — only the re-fetched session. `src/utility/bachs/` holds
`BachsService`. `gsCode` and `passwordHash` are `@Exclude()`d on the entity — keep
`ClassSerializerInterceptor` on the controller so they never leak.

- [applications.controller.ts](src/applications/applications.controller.ts) uses
  `FileInterceptor('passportPhoto', passportPhotoMulterOptions)` — memory storage, JPEG/PNG only, 10 MB max
  ([config/passport-photo.multer-options.ts](src/applications/config/passport-photo.multer-options.ts)).
  Keep these limits in sync with the frontend's onboarding constants.
- [create-application.dto.ts](src/applications/dto/create-application.dto.ts) is **flat**; the service groups
  fields per wizard step into the embedded subdocuments in
  [application-groups.entity.ts](src/applications/entities/application-groups.entity.ts) before saving
  `ApplicationEntity` (status defaults to `ApplicationStatus.PENDING`). Adding a wizard field means touching
  the DTO, the group entity, and the service mapping.
- The uploaded photo goes to Cloudinary via `CloudinaryService.uploadImage` (stream upload, no disk write);
  only the `secure_url` is stored (`submit.passportPhotoUrl`).

### Validation

Global `ValidationPipe` has `whitelist`, `forbidNonWhitelisted`, and `transform` all on — DTOs must declare every
accepted field with `class-validator` decorators or the request is rejected. Because the body is multipart, use
`@Type(() => Date)` etc. for non-string fields.

### Persistence

`synchronize: true` on the TypeORM connection and entities are auto-discovered via
`__dirname + '/**/*.entity{.ts,.js}'` — name new entity files `*.entity.ts`. There are no migrations.

Don't model arrays of sub-objects with `@Column(() => SomeClass)`: TypeORM's Mongo driver saves them as one object and
then throws `document[...].map is not a function` when loading (this broke `GET /quizzes/:quizId`). Use a plain
`@Column()` typed as an interface array instead. Single embedded groups (as on `ApplicationEntity`) are fine.

### Shared utilities

`src/utility/cloudinary/` (module/provider/service/constants), `src/utility/mail/` (`MailService`: the payment-request email and, after payment, the `gsCode` create-password email) and `src/utility/common/` (shared
enums such as `application-status.enum.ts`, `generate-gs-code.ts`). Put cross-module code here.

## Environment

Loaded via `@nestjs/config` (`isGlobal: true`) from `.env`. Required: `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `JWT_SECRET` (the app won't
boot without it). Optional: `PORT`,
`SMTP_PORT` (587), `MAIL_FROM`, `FRONTEND_URL` (`http://localhost:3000`). Payments need `BACHS_API_KEY` plus either
`BACHS_PRODUCT_ID` or `BACHS_AMOUNT` + `BACHS_CURRENCY` (`POST /applications` returns `503` without them).
