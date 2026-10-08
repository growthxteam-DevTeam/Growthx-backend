# Growth X — Backend API

NestJS 11 REST API for the Growth X admissions flow. MongoDB via TypeORM's `mongodb` connector (not Mongoose),
Cloudinary for passport photos, nodemailer for applicant emails, bcrypt for password hashing, JWT for login tokens.
An applicant's account is their application record: they get a one-time GS code by email, set a password with it, then
log in with email + password.

## Getting Started

```bash
npm install
cp .env.example .env   # fill in the values described below
npm run start:dev      # http://localhost:<PORT>/api/v1
```

## Environment Variables

| Variable                | Required                                 | Description                                                                          |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `MONGODB_URI`           | Yes                                      | MongoDB connection string.                                                           |
| `PORT`                  | No (defaults to `5000`)                  | Port the HTTP server listens on.                                                     |
| `CLOUDINARY_CLOUD_NAME` | Yes                                      | Cloudinary cloud name (passport photo uploads).                                      |
| `CLOUDINARY_API_KEY`    | Yes                                      | Cloudinary API key.                                                                  |
| `CLOUDINARY_API_SECRET` | Yes                                      | Cloudinary API secret.                                                               |
| `SMTP_HOST`             | Yes                                      | SMTP server host used by nodemailer.                                                 |
| `SMTP_PORT`             | No (defaults to `587`)                   | SMTP port; `465` enables TLS.                                                        |
| `SMTP_USER`             | Yes                                      | SMTP username.                                                                       |
| `SMTP_PASS`             | Yes                                      | SMTP password.                                                                       |
| `MAIL_FROM`             | No (defaults to `SMTP_USER`)             | "From" address on outgoing email.                                                    |
| `FRONTEND_URL`          | No (defaults to `http://localhost:3000`) | Frontend base URL used to build the `/create-password?gsCode=...` link in the email. |
| `JWT_SECRET`            | Yes                                      | Secret used to sign login tokens. The app won't start without it.                    |

Never commit real values for the secret variables; `.env` is gitignored and `.env.example` must stay blank for them.
Generate a JWT secret with `openssl rand -hex 32`.

## API Documentation

Base URL: `http://localhost:5000/api/v1` (global prefix set in `src/main.ts`; port from `PORT`). CORS is enabled for all origins.

Request bodies are validated by a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
— a field not declared in a DTO causes `400 Bad Request` instead of being silently dropped. Login issues a token, but no
route checks it yet.

### Endpoints

| Method | Path                            | Description                                                     |
| ------ | ------------------------------- | --------------------------------------------------------------- |
| `GET`  | `/`                             | Scaffold health check — returns the plain string `Hello World!` |
| `POST` | `/applications`                 | Submit an onboarding application (`multipart/form-data`)        |
| `POST` | `/applications/create-password` | Set an account password using the emailed GS code (JSON)        |
| `POST` | `/auth/login`                   | Log in with email + password, returns a JWT (JSON)              |

There is no endpoint yet to read applications back, change their status, or reset a password. Review currently happens
by querying MongoDB directly (Atlas or `mongosh`).

---

## Applications

Backs the frontend onboarding wizard (`growth-x/app/(auth)/onboarding`): one request carries every step's answers.

### POST /applications

Public. `multipart/form-data` (not JSON) so the optional passport photo travels in the same request. The request is
flat; the grouping in the response is only how the record is stored
(see `src/applications/entities/application-groups.entity.ts`).

| Field                   | Type                                                                                                | Required                                   | From wizard step        | Notes                   |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------- | ----------------------- |
| `fullName`              | string                                                                                              | Yes                                        | Application Portal      | min 2 chars             |
| `email`                 | string                                                                                              | Yes                                        | Application Portal      | valid email             |
| `program`               | string                                                                                              | Yes                                        | Application Portal      |                         |
| `cohort`                | string                                                                                              | No                                         | Application Portal      |                         |
| `title`                 | string                                                                                              | No                                         | Personal Information    |                         |
| `surname`               | string                                                                                              | Yes                                        | Personal Information    |                         |
| `firstName`             | string                                                                                              | Yes                                        | Personal Information    |                         |
| `businessName`          | string                                                                                              | Yes                                        | Personal Information    |                         |
| `dateOfBirth`           | date                                                                                                | Yes                                        | Personal Information    | ISO date string         |
| `gender`                | string                                                                                              | Yes                                        | Personal Information    |                         |
| `businessDescription`   | string                                                                                              | Yes                                        | Business Basics         | min 10 chars            |
| `operatingDuration`     | `"less-than-6-months" \| "6-months-to-1-year" \| "1-3-years" \| "3-5-years" \| "more-than-5-years"` | Yes                                        | Business Basics         |                         |
| `averageRevenue`        | `"no-revenue-yet" \| "early-revenue" \| "growing-revenue" \| "significant-revenue"`                 | Yes                                        | Business Basics         |                         |
| `fullTimeCommitment`    | `"full-time" \| "not-yet"`                                                                          | Yes                                        | Business Basics         |                         |
| `challengeAndSkillGap`  | string                                                                                              | Yes                                        | Who You Are             | min 10 chars            |
| `cohortMotivation`      | string                                                                                              | Yes                                        | Who You Are             | min 10 chars            |
| `hasAccessibilityNeeds` | `"yes" \| "no"`                                                                                     | Yes                                        | Accessibility & Support |                         |
| `accessibilityNeed`     | `"vision" \| "hearing" \| "mobility" \| "cognitive" \| "speech" \| "other" \| "undisclosed"`        | Only if `hasAccessibilityNeeds` is `"yes"` | Accessibility & Support |                         |
| `passportPhoto`         | file                                                                                                | No                                         | Submit                  | JPEG/PNG only, max 2 MB |

**Passport photo:** streamed straight to Cloudinary (folder `growth-x/passport-photos`); nothing is written to local
disk. The record stores the returned `secure_url` as `submit.passportPhotoUrl`.

**GS code and email:** every saved application gets a random 12-character `gsCode` (stored on the record, never
returned in any response). An "application received" email is then sent to `applicationPortal.email` with a link to
`<FRONTEND_URL>/create-password?gsCode=<code>`, and the code is also printed in the email body. The email is sent in
the background: a mail failure is logged and does not fail the request.

**Response `201`:**

```json
{
  "status": "Success",
  "statusCode": 201,
  "data": {
    "_id": "...",
    "applicationPortal": {
      "fullName": "Jane Doe",
      "email": "jane@doe.com",
      "program": "software-engineering",
      "cohort": "cohort-1"
    },
    "personalInfo": {
      "title": "Mrs",
      "surname": "Doe",
      "firstName": "Jane",
      "businessName": "Doe Logistics",
      "dateOfBirth": "1995-04-12T00:00:00.000Z",
      "gender": "female"
    },
    "businessBasics": {
      "businessDescription": "We help small logistics companies in Lagos...",
      "operatingDuration": "1-3-years",
      "averageRevenue": "early-revenue",
      "fullTimeCommitment": "full-time"
    },
    "whoYouAre": {
      "challengeAndSkillGap": "...",
      "cohortMotivation": "..."
    },
    "accessibilitySupport": {
      "hasAccessibilityNeeds": "yes",
      "accessibilityNeed": "hearing"
    },
    "submit": {
      "passportPhotoUrl": "https://res.cloudinary.com/.../growth-x/passport-photos/....jpg"
    },
    "status": "pending",
    "createdAt": "..."
  }
}
```

`accessibilitySupport.accessibilityNeed` is only present when `hasAccessibilityNeeds` is `"yes"`.
`status` is one of `pending` (default), `reviewed`, `accepted`, `rejected`.

**Errors:**

| Status | When                                                    |
| ------ | ------------------------------------------------------- |
| `400`  | Any field fails validation, or an unknown field is sent |
| `413`  | `passportPhoto` is over 2 MB                            |
| `415`  | `passportPhoto` is not JPEG/PNG                         |

### POST /applications/create-password

Public. JSON body. Backs the frontend `/create-password` page: the applicant opens the link from their email and
sets a password, authenticated only by the GS code.

| Field      | Type   | Required | Notes                                                                                 |
| ---------- | ------ | -------- | ------------------------------------------------------------------------------------- |
| `gsCode`   | string | Yes      | The code emailed after `POST /applications`                                           |
| `password` | string | Yes      | min 8 chars, with at least one number, one uppercase letter and one special character |

```json
{ "gsCode": "ABCD2345WXYZ", "password": "Good#Pass1" }
```

The password is hashed with bcrypt and stored on the application as `passwordHash` (never returned). A GS code can be
used once: after a password is set, the same code is rejected. The endpoint does not check the application's
`status`, so a code works as soon as it is emailed.

**Response `200`:**

```json
{
  "status": "Success",
  "statusCode": 200,
  "message": "Password created successfully"
}
```

**Errors:**

| Status | When                                                                |
| ------ | ------------------------------------------------------------------- |
| `400`  | `gsCode` doesn't match any application, or a field fails validation |
| `409`  | The GS code has already been used to set a password                 |

---

## Auth

### POST /auth/login

Public. JSON body. Backs the frontend `/login` page. Only applications that have set a password (see
`create-password` above) can log in. The email is matched case-insensitively.

| Field        | Type    | Required | Notes                                                       |
| ------------ | ------- | -------- | ----------------------------------------------------------- |
| `email`      | string  | Yes      | The email used on the application                           |
| `password`   | string  | Yes      |                                                             |
| `rememberMe` | boolean | No       | Token lasts 30 days when `true`, otherwise 1 day            |

```json
{ "email": "jane@doe.com", "password": "Good#Pass1", "rememberMe": true }
```

**Response `200`:**

```json
{
  "status": "Success",
  "statusCode": 200,
  "data": {
    "accessToken": "<jwt>",
    "user": {
      "id": "...",
      "name": "Jane Doe",
      "email": "jane@doe.com",
      "profilePicture": "https://res.cloudinary.com/.../....jpg"
    }
  }
}
```

The JWT payload is `{ sub: <application id>, email }`, signed with `JWT_SECRET`. `profilePicture` is `null` when no
passport photo was uploaded. No route verifies the token yet.

**Errors:**

| Status | When                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------- |
| `400`  | A field fails validation, or an unknown field is sent                                               |
| `401`  | Wrong password, unknown email, or no password set yet (all return the same "Invalid email or password") |
