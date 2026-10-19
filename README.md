# Growth X — Backend API

NestJS 11 REST API for the Growth X admissions flow. MongoDB via TypeORM's `mongodb` connector (not Mongoose),
Cloudinary for passport photos, nodemailer for applicant emails, bcrypt for password hashing, JWT for login tokens.
An applicant's account is their application record: they get a one-time GS code by email, set a password with it, then
log in with email + password. The returned JWT unlocks the class discussion and quiz endpoints.

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
— a field not declared in a DTO causes `400 Bad Request` instead of being silently dropped. Routes marked **JWT** below
need an `Authorization: Bearer <accessToken>` header (from `POST /auth/login`); the rest are public.

### Endpoints

| Method | Path                             | Description                                                                |
| ------ | -------------------------------- | -------------------------------------------------------------------------- |
| `GET`  | `/`                              | Scaffold health check — returns the plain string `Hello World!`            |
| `POST` | `/applications`                  | Submit an onboarding application (`multipart/form-data`)                   |
| `POST` | `/applications/create-password`  | Set an account password using the emailed GS code (JSON)                   |
| `POST` | `/auth/login`                    | Log in with email + password, returns a JWT (JSON)                         |
| `GET`  | `/discussions/:classId/comments` | **JWT** — list a class's discussion comments with their replies            |
| `POST` | `/discussions/:classId/comments` | **JWT** — post a comment or a reply                                        |
| `POST` | `/discussions/comments/:id/like` | **JWT** — like a comment (toggle; clears an existing dislike)              |
| `POST` | `/discussions/comments/:id/dislike` | **JWT** — dislike a comment (toggle; clears an existing like)           |
| `GET`  | `/quizzes/:quizId`               | **JWT** — a quiz's questions (no answer key) and the caller's last attempt |
| `POST` | `/quizzes/:quizId/submissions`   | **JWT** — submit answers; graded and the score is saved                    |

There is no endpoint yet to read applications back, change their status, or reset a password. Review currently happens
by querying MongoDB directly (Atlas or `mongosh`).

---

## Applications

Backs the frontend onboarding wizard (`growth-x/app/(auth)/onboarding`): one request carries every step's answers.

### POST /applications

Public. `multipart/form-data` (not JSON) so the optional passport photo travels in the same request. The request is
flat; the grouping in the response is only how the record is stored
(see `src/applications/entities/application-groups.entity.ts`).

| Field                   | Type                                                                                                | Required                                   | From wizard step        | Notes                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------- | ------------------------------------------------------------------- |
| `fullName`              | string                                                                                              | Yes                                        | Application Portal      | min 2 chars                                                         |
| `email`                 | string                                                                                              | Yes                                        | Application Portal      | valid email                                                         |
| `program`               | string                                                                                              | Yes                                        | Application Portal      |                                                                     |
| `cohort`                | string                                                                                              | No                                         | Application Portal      |                                                                     |
| `title`                 | string                                                                                              | No                                         | Personal Information    |                                                                     |
| `surname`               | string                                                                                              | Yes                                        | Personal Information    |                                                                     |
| `firstName`             | string                                                                                              | Yes                                        | Personal Information    |                                                                     |
| `businessName`          | string                                                                                              | Yes                                        | Personal Information    |                                                                     |
| `dateOfBirth`           | date                                                                                                | Yes                                        | Personal Information    | ISO date string                                                     |
| `gender`                | string                                                                                              | Yes                                        | Personal Information    |                                                                     |
| `businessDescription`   | string                                                                                              | Yes                                        | Business Basics         | min 10 chars                                                        |
| `operatingDuration`     | `"less-than-6-months" \| "6-months-to-1-year" \| "1-3-years" \| "3-5-years" \| "more-than-5-years"` | Yes                                        | Business Basics         |                                                                     |
| `averageRevenue`        | `"no-revenue-yet" \| "early-revenue" \| "growing-revenue" \| "significant-revenue"`                 | Yes                                        | Business Basics         |                                                                     |
| `fullTimeCommitment`    | `"full-time" \| "not-yet"`                                                                          | Yes                                        | Business Basics         |                                                                     |
| `challengeAndSkillGap`  | string                                                                                              | Yes                                        | Who You Are             | min 10 chars                                                        |
| `cohortMotivation`      | string                                                                                              | Yes                                        | Who You Are             | min 10 chars                                                        |
| `hasAccessibilityNeeds` | `"yes" \| "no"`                                                                                     | Yes                                        | Accessibility & Support |                                                                     |
| `accessibilityNeed`     | `"vision" \| "hearing" \| "mobility" \| "cognitive" \| "speech" \| "other" \| "undisclosed"`        | Only if `hasAccessibilityNeeds` is `"yes"` | Accessibility & Support |                                                                     |
| `accessibilityNotes`    | string                                                                                              | No                                         | Accessibility & Support | Max 1000 chars; only stored when `hasAccessibilityNeeds` is `"yes"` |
| `passportPhoto`         | file                                                                                                | No                                         | Submit                  | JPEG/PNG only, max 10 MB                                            |

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
      "program": "zero-to-launch",
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
      "accessibilityNeed": "hearing",
      "accessibilityNotes": "I use a screen reader, so PDFs work better for me"
    },
    "submit": {
      "passportPhotoUrl": "https://res.cloudinary.com/.../growth-x/passport-photos/....jpg"
    },
    "status": "pending",
    "createdAt": "..."
  }
}
```

`accessibilitySupport.accessibilityNeed` and `accessibilityNotes` are only present when `hasAccessibilityNeeds` is
`"yes"` (and the notes were filled in).
`status` is one of `pending` (default), `reviewed`, `accepted`, `rejected`.

**Errors:**

| Status | When                                                    |
| ------ | ------------------------------------------------------- |
| `400`  | Any field fails validation, or an unknown field is sent |
| `413`  | `passportPhoto` is over 10 MB                           |
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

| Field        | Type    | Required | Notes                                            |
| ------------ | ------- | -------- | ------------------------------------------------ |
| `email`      | string  | Yes      | The email used on the application                |
| `password`   | string  | Yes      |                                                  |
| `rememberMe` | boolean | No       | Token lasts 30 days when `true`, otherwise 1 day |

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
passport photo was uploaded. Protected routes verify it with `JwtAuthGuard` (`src/auth/jwt-auth.guard.ts`) and read the
user with the `@CurrentUser()` decorator; a missing, malformed, forged or expired token returns `401`.

**Errors:**

| Status | When                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------- |
| `400`  | A field fails validation, or an unknown field is sent                                                   |
| `401`  | Wrong password, unknown email, or no password set yet (all return the same "Invalid email or password") |

---

## Discussions

Backs the frontend class page (`growth-x/app/(dashboard)/class`). Every class has its own thread, keyed by a `classId`
string such as `week-1-pricing-your-product` (letters, digits and hyphens, max 100 chars). Comments are stored in the
`discussion_comments` collection (`src/discussions/entities/discussion-comment.entity.ts`). All three routes need a JWT
(see Auth) and return `401` without one. There is no websocket: the frontend polls the list every 15 seconds.

A comment is either top-level or a reply. Replies are one level deep: `parentId` must be a top-level comment of the same
class.

### GET /discussions/:classId/comments

| Query   | Type    | Required | Notes                                                          |
| ------- | ------- | -------- | --------------------------------------------------------------- |
| `limit` | integer | No       | Top-level comments to return, 1-50 (default `10`)               |
| `sort`  | string  | No       | `newest` (default), `oldest`, or `top` (highest `likes` first)  |

Top-level comments come back ordered by `sort`; pinned comments always sort first regardless of `sort`. Each one
carries all its replies, oldest first. "Show more" in the UI simply requests a larger `limit`; `total` is the number
of top-level comments in the thread.

**Response `200`:**

```json
{
  "status": "Success",
  "statusCode": 200,
  "data": {
    "total": 7,
    "comments": [
      {
        "id": "...",
        "author": {
          "id": "...",
          "name": "Jane Doe",
          "profilePicture": "https://res.cloudinary.com/.../....jpg"
        },
        "content": "Great session!",
        "likes": 2,
        "likedByMe": false,
        "dislikedByMe": false,
        "pinned": false,
        "staffPost": false,
        "createdAt": "2026-10-08T12:00:00.000Z",
        "replies": [
          {
            "id": "...",
            "author": {
              "id": "...",
              "name": "Sarah A.B",
              "profilePicture": null
            },
            "content": "Thanks!",
            "likes": 0,
            "likedByMe": false,
            "dislikedByMe": false,
            "pinned": false,
            "staffPost": false,
            "createdAt": "2026-10-08T12:05:00.000Z",
            "replies": []
          }
        ]
      }
    ]
  }
}
```

`likedByMe`/`dislikedByMe` are relative to the caller; a comment is never both liked and disliked by the same person.
The author's name and photo are copied from their application when the comment is posted. `pinned` and `staffPost`
have no endpoint yet — both are set directly in the database.

### POST /discussions/:classId/comments

JSON body.

| Field      | Type   | Required | Notes                                                        |
| ---------- | ------ | -------- | ------------------------------------------------------------ |
| `content`  | string | Yes      | Trimmed; 1-1000 chars                                        |
| `parentId` | string | No       | Id of a top-level comment in the same class, to post a reply |

**Response `201`:** `{ "status": "Success", "statusCode": 201, "data": <comment, same shape as above> }`

### POST /discussions/comments/:id/like

No body. Toggles the caller's like on the comment; clears an existing dislike.

**Response `200`:** `{ "status": "Success", "statusCode": 200, "data": { "likes": 3, "likedByMe": true, "dislikedByMe": false } }`

### POST /discussions/comments/:id/dislike

No body. Toggles the caller's dislike on the comment; clears an existing like.

**Response `200`:** `{ "status": "Success", "statusCode": 200, "data": { "likes": 2, "likedByMe": false, "dislikedByMe": true } }`

**Errors (all routes above):**

| Status | When                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Invalid `classId`/`limit`/`sort`/`content`/`parentId`, an unknown field is sent, or `parentId` is not a top-level comment of this class |
| `401`  | Missing, malformed, forged or expired token, or the account no longer exists                                                     |
| `404`  | The comment to react to, like, dislike or reply to doesn't exist                                                                 |

---

## Quizzes

Backs the frontend quiz page (`growth-x/app/(dashboard)/class/quiz`). Quizzes are defined in code
(`src/quizzes/quizzes.data.ts`); there is no admin tool yet. All routes need a JWT. Each submission is saved in the
`quiz_attempts` collection, and learners can retake a quiz as often as they like.

The current quiz id is `week-2-pricing-your-product` (10 single- and multi-select questions, 1 point each, pass mark 7).

### GET /quizzes/:quizId

Returns the quiz without its answer key, plus the caller's most recent attempt (or `null`).

```json
{
  "status": "Success",
  "statusCode": 200,
  "data": {
    "id": "week-2-pricing-your-product",
    "title": "Week 2 Quiz: Pricing Your Product",
    "subtitle": "Practice Assignment",
    "passingScore": 7,
    "totalPoints": 10,
    "questions": [
      {
        "id": "q1",
        "text": "What should you check first if a customer says your price is too high?",
        "type": "single",
        "points": 1,
        "options": [
          { "id": "a", "text": "..." },
          { "id": "b", "text": "..." }
        ]
      }
    ],
    "lastAttempt": {
      "score": 8,
      "totalPoints": 10,
      "passed": true,
      "submittedAt": "2026-10-14T12:00:00.000Z"
    }
  }
}
```

`type` is `"single"` or `"multiple"`.

### POST /quizzes/:quizId/submissions

JSON body. Option ids are the `id`s from the quiz response.

| Field                  | Type     | Required | Notes                                                         |
| ---------------------- | -------- | -------- | ------------------------------------------------------------- |
| `answers`              | array    | Yes      | One entry per answered question                               |
| `answers[].questionId` | string   | Yes      | Must be a question of this quiz, at most once                 |
| `answers[].optionIds`  | string[] | Yes      | Chosen option ids; exactly one allowed for `single` questions |

```json
{
  "answers": [
    { "questionId": "q1", "optionIds": ["b"] },
    { "questionId": "q2", "optionIds": ["a", "b", "d"] }
  ]
}
```

Grading: a question earns its points only if the chosen options exactly match the correct ones (so a multi-select
answer with a missing or an extra option scores zero). Questions left out score zero. `passed` is
`score >= passingScore`.

**Response `201`:**

```json
{
  "status": "Success",
  "statusCode": 201,
  "data": {
    "score": 9,
    "totalPoints": 10,
    "passingScore": 7,
    "passed": true,
    "results": [
      { "questionId": "q1", "correct": true },
      { "questionId": "q2", "correct": false }
    ]
  }
}
```

The response says which questions were right or wrong but never reveals the correct options.

**Errors (both routes):**

| Status | When                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| `400`  | Invalid `quizId`, unknown question or option, a question answered twice, or several options on a `single` question |
| `401`  | Missing, malformed, forged or expired token                                                                        |
| `404`  | No quiz with that id                                                                                               |
