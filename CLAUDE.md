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

`AppModule` ([src/app.module.ts](src/app.module.ts)) imports `ApplicationsModule` and `AuthModule`. An
applicant's account *is* their application record: the one-time `gsCode` emailed after submission is exchanged via
`POST /applications/create-password` for a bcrypt `passwordHash`, then `POST /auth/login` (`src/auth/`) verifies
email + password and returns a JWT signed with `JWT_SECRET`. No guard or middleware verifies the token yet — ask
before adding protected routes or roles. The frontend's admin-login and banner RTK endpoints
(`/admin/auth/login`, banners) still have no backend counterpart.

### Applications module

Two routes (see [README.md](README.md) for payloads and response shapes): `POST /applications` accepts the frontend
onboarding wizard as `multipart/form-data`, and `POST /applications/create-password` (JSON) sets the password from
the emailed GS code. `gsCode` and `passwordHash` are `@Exclude()`d on the entity — keep
`ClassSerializerInterceptor` on the controller so they never leak.

- [applications.controller.ts](src/applications/applications.controller.ts) uses
  `FileInterceptor('passportPhoto', passportPhotoMulterOptions)` — memory storage, JPEG/PNG only, 2 MB max
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

### Shared utilities

`src/utility/cloudinary/` (module/provider/service/constants), `src/utility/mail/` (nodemailer `MailService`,
sends the application-received email with the `gsCode` create-password link) and `src/utility/common/` (shared
enums such as `application-status.enum.ts`, `generate-gs-code.ts`). Put cross-module code here.

## Environment

Loaded via `@nestjs/config` (`isGlobal: true`) from `.env`. Required: `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `JWT_SECRET` (the app won't
boot without it). Optional: `PORT`,
`SMTP_PORT` (587), `MAIL_FROM`, `FRONTEND_URL` (`http://localhost:3000`).
