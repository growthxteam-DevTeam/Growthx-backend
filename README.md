# Growth X — Backend API

NestJS 11 REST API for the Growth X admissions flow. MongoDB via TypeORM's `mongodb` connector (not Mongoose),
Cloudinary for passport photos, nodemailer for applicant emails, bcrypt for password hashing, JWT for login tokens.
An applicant's account is their application record: they pay through Bachs first, then get a one-time GS code by email,
set a password with it, then log in with email + password. The returned JWT unlocks the class discussion and quiz endpoints.

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
| `FRONTEND_URL`          | No (defaults to `http://localhost:3000`) | Frontend base URL used to build the `/create-password?gsCode=...` and `/reset-password?token=...` email links. |
| `JWT_SECRET`            | Yes                                      | Secret used to sign login tokens. The app won't start without it.                    |
| `BACHS_API_KEY`         | Yes                                      | Bachs secret key. `sk_sandbox_...` targets the sandbox API, `sk_live_...` the live API. |
| `BACHS_BASE_URL`        | No (derived from the key prefix)         | Override the Bachs API base URL.                                                     |
| `BACHS_PRODUCT_ID`      | One of this or amount + currency         | Bachs product to charge for the program fee. Wins over `BACHS_AMOUNT`.               |
| `BACHS_AMOUNT`          | With `BACHS_CURRENCY`                    | Fixed program fee as a decimal string (e.g. `"150000"`) when no product id is set.   |
| `BACHS_CURRENCY`        | With `BACHS_AMOUNT`                      | Currency code for `BACHS_AMOUNT` (e.g. `NGN`).                                       |
| `BACHS_SUCCESS_URL`     | No (`<FRONTEND_URL>/success`)            | Where Bachs sends the payer after paying. Must be public: Bachs rejects `localhost`. |
| `BACHS_CANCEL_URL`      | No (`<FRONTEND_URL>/cancel`)             | Where Bachs sends the payer if they cancel. Must be public too.                      |

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
| `POST` | `/applications/payment-webhook`  | Bachs payment webhook; confirms payment and emails the GS code (JSON)      |
| `POST` | `/applications/create-password`  | Set an account password using the emailed GS code (JSON)                   |
| `POST` | `/auth/login`                    | Log in with email + password, returns a JWT (JSON)                         |
| `POST` | `/auth/forgot-password`          | Email a single-use password-reset link (JSON)                              |
| `POST` | `/auth/reset-password`           | Set a new password using the emailed reset token (JSON)                    |
| `GET`  | `/discussions/:classId/comments` | **JWT** — list a class's discussion comments with their replies            |
| `POST` | `/discussions/:classId/comments` | **JWT** — post a comment or a reply                                        |
| `POST` | `/discussions/comments/:id/like` | **JWT** — like a comment (toggle; clears an existing dislike)              |
| `POST` | `/discussions/comments/:id/dislike` | **JWT** — dislike a comment (toggle; clears an existing like)           |
| `GET`  | `/quizzes/:quizId`               | **JWT** — a quiz's questions (no answer key) and the caller's last attempt |
| `POST` | `/quizzes/:quizId/submissions`   | **JWT** — submit answers; graded and the score is saved                    |
| `GET`  | `/resources`                     | **JWT** — resource vault: curated articles and videos, by category or search |

There is no endpoint yet to read applications back or change their status. Review currently happens
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

**Payment, GS code and email:** there is no review step. After the record is saved, a Bachs checkout is created
(`POST /v1/checkout-sessions`, with `metadata.application_id`) and a "complete your payment" email carrying the
checkout link is sent to `applicationPortal.email`. The GS code (a random 12-character `gsCode`, stored on the record
and never returned) is **not** sent yet. Once Bachs reports the payment (see `POST /applications/payment-webhook`),
a second email goes out with the GS code and a link to `<FRONTEND_URL>/create-password?gsCode=<code>`. Emails are sent
in the background: a mail failure is logged and does not fail the request. If the Bachs checkout can't be created, the
saved application is deleted again and the request fails with `503`, so the applicant can resubmit.

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
  },
  "paymentUrl": "https://checkout.bachs.io/..."
}
```

`paymentUrl` is the Bachs hosted checkout for this application (also emailed). `accessibilitySupport.accessibilityNeed` and `accessibilityNotes` are only present when `hasAccessibilityNeeds` is
`"yes"` (and the notes were filled in).
`status` is one of `pending` (default), `reviewed`, `accepted`, `rejected`.

**Errors:**

| Status | When                                                    |
| ------ | ------------------------------------------------------- |
| `400`  | Any field fails validation, or an unknown field is sent |
| `413`  | `passportPhoto` is over 10 MB                           |
| `415`  | `passportPhoto` is not JPEG/PNG                         |
| `503`  | The Bachs checkout could not be created; nothing saved  |

### POST /applications/payment-webhook

Public, called by Bachs. Configure this URL (`<backend>/api/v1/applications/payment-webhook`) as a webhook endpoint in
the Bachs dashboard for the `collection.succeeded` / `checkout.completed` events. The body is Bachs' event envelope
(`{ id, type, created_at, organization_id, data }`); only the checkout id in `data` is read. The body itself is never
trusted: the backend fetches the checkout session from Bachs (`GET /v1/checkout-sessions/{id}`) with the API key and
only marks the application paid (`paidAt`) when Bachs says the payment succeeded, then emails the GS code. Repeat
deliveries are ignored once paid. Unknown checkout ids are ignored. Always answers `200 { "received": true }`; if
Bachs can't be reached the request fails so Bachs retries.

> `X-Bachs-Signature` verification is not implemented yet because the signing scheme wasn't in the docs we read. The
> re-fetch above is what keeps forged requests from marking anyone paid.

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
used once: after a password is set, the same code is rejected. The code is only emailed after payment, and the endpoint
also refuses applications created since payment was introduced that haven't paid. Applications from before that (no
payment record) are not gated. It does not check the application's `status`.

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
| `403`  | The application requires payment and hasn't paid yet                |
| `409`  | The GS code has already been used to set a password                 |

---

## Resources

Backs the dashboard's Resource Vault. No database and no API keys: the backend reads a fixed list of trusted
publishers' RSS/Atom feeds (TechCabal, Disrupt Africa, TechCrunch, Sifted, Y Combinator, Feld Thoughts, Lenny's
Newsletter, SaaStr, Andrew Chen, Paul Graham, and the Y Combinator, Sequoia and a16z YouTube channels), see
`src/resources/resources.sources.ts`. That list is what makes the content "verified": a new source is added there and
nowhere else. Feeds are cached in memory for 30 minutes; a feed that fails to load is skipped (its last good copy is used
if there is one), so one broken publisher never breaks the vault. Feeds only carry recent items (YouTube: the latest 15
videos per channel), so each category shows recent material, not an archive.

### GET /resources

**JWT.** Query parameters, all optional:

| Param      | Type                                           | Notes                                                                            |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `category` | `"pre-seed" \| "pitch" \| "raise" \| "pricing"` | Keeps items whose title/summary match that category's keywords                   |
| `q`        | string, max 100 chars                          | Free-text search; filler words dropped, whole-word matching, best matches only   |
| `limit`    | integer 1-30 (default 12)                      |                                                                                  |

**Response `200`:**

```json
{
  "status": "Success",
  "statusCode": 200,
  "data": [
    {
      "id": "3f2a9c1d8e7b4a60",
      "title": "How to build an investment thesis and win early-stage deals",
      "url": "https://sifted.eu/articles/...",
      "source": "Sifted",
      "type": "article",
      "summary": "First 220 characters of the publisher's own summary...",
      "imageUrl": "https://.../thumbnail.jpg",
      "publishedAt": "2026-10-29T08:00:00.000Z",
      "readMinutes": 4
    }
  ]
}
```

`url` is always the publisher's own `http(s)` page: the frontend opens it in a new tab, so readers leave our app.
`imageUrl`, `publishedAt` and `readMinutes` can be `null` (`readMinutes` is only set for articles whose feed includes
the full text). `type` is `"article"` or `"video"`. Errors: `400` for an unknown `category` or a bad `q`/`limit`, `401`
without a valid token.

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

### POST /auth/forgot-password

Public. JSON body. Backs the frontend `/forgot-password` page. If an application with that email (matched
case-insensitively) has set a password, a random reset token is generated, only its SHA-256 hash and a 1-hour expiry are
stored on the application (`passwordResetTokenHash`, `passwordResetExpiresAt`, never returned), and an email goes out
with a link to `<FRONTEND_URL>/reset-password?token=<token>`. Requesting again replaces the previous token. The email is
sent in the background, and the response is identical whether or not the email has an account, so it can't be used to
find out who is registered.

| Field   | Type   | Required | Notes       |
| ------- | ------ | -------- | ----------- |
| `email` | string | Yes      | Valid email |

```json
{ "email": "jane@doe.com" }
```

**Response `200`:**

```json
{
  "status": "Success",
  "statusCode": 200,
  "message": "If an account exists for that email, a password reset link has been sent"
}
```

**Errors:** `400` when `email` is missing or invalid.

### POST /auth/reset-password

Public. JSON body. Backs the frontend `/reset-password` page (the link from the email carries the token).

| Field      | Type   | Required | Notes                                                                                 |
| ---------- | ------ | -------- | ------------------------------------------------------------------------------------- |
| `token`    | string | Yes      | The token from the emailed link                                                       |
| `password` | string | Yes      | min 8 chars, with at least one number, one uppercase letter and one special character |

```json
{ "token": "<token from the email>", "password": "Good#Pass2" }
```

The new password replaces `passwordHash`, and the token is cleared, so each link works once. Existing JWTs stay valid
until they expire.

**Response `200`:**

```json
{
  "status": "Success",
  "statusCode": 200,
  "message": "Password reset successfully"
}
```

**Errors:**

| Status | When                                                                                |
| ------ | ----------------------------------------------------------------------------------- |
| `400`  | Token unknown, already used or expired ("Invalid or expired reset link"), or a field fails validation |

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
