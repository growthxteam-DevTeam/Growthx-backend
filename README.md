# Growth X — Backend API

NestJS 11 REST API for the Growth X admissions flow. MongoDB via TypeORM's `mongodb` connector (not Mongoose),
Cloudinary for passport photos, nodemailer for applicant emails, bcrypt for password hashing, JWT for login tokens.
An applicant's account is their application record: they submit the onboarding form and get a "we'll review your profile"
email, an admin reviews it and sends an invite email carrying a one-time GS code, they set a password with it, then log in
with email + password. The returned JWT unlocks the class discussion and quiz endpoints. Admins are separate accounts in
the `admins` collection (see [Admin](#admin)).

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
| `ADMIN_EMAIL`           | Production only                          | Email of the admin account seeded on boot. Outside production it defaults to `admin@growthx.com`. |
| `ADMIN_PASSWORD`        | Production only                          | Password of the seeded admin. Outside production it defaults to the dev password under [Admin](#admin). |
| `ADMIN_NAME`            | No (`Growth X Admin`)                    | Display name of the seeded admin.                                                    |
| `BACHS_API_KEY`         | Yes (payment after login)                | Bachs secret key. `sk_sandbox_...` targets the sandbox API, `sk_live_...` the live API. |
| `BACHS_BASE_URL`        | No (derived from the key prefix)         | Override the Bachs API base URL.                                                     |
| `BACHS_PRODUCT_ID`      | One of this or amount + currency         | Bachs product to charge for the program fee. Wins over `BACHS_AMOUNT`.               |
| `BACHS_AMOUNT`          | With `BACHS_CURRENCY`                    | Fixed program fee as a decimal string (e.g. `"150000"`) when no product id is set.   |
| `BACHS_CURRENCY`        | With `BACHS_AMOUNT`                      | Currency code for `BACHS_AMOUNT` (e.g. `NGN`).                                       |
| `BACHS_SUCCESS_URL`     | No (`<FRONTEND_URL>/success`)            | Where Bachs sends the payer after paying. Must be public: Bachs rejects `localhost`. |
| `BACHS_CANCEL_URL`      | No (`<FRONTEND_URL>/cancel`)             | Where Bachs sends the payer if they cancel. Must be public too.                      |

Submitting an application no longer creates a Bachs checkout: the program fee is taken after login (see
`GET /applications/me/payment`), which is what the `BACHS_*` variables are for.

Never commit real values for the secret variables; `.env` is gitignored and `.env.example` must stay blank for them.
Generate a JWT secret with `openssl rand -hex 32`.

## API Documentation

Base URL: `http://localhost:5000/api/v1` (global prefix set in `src/main.ts`; port from `PORT`). CORS is enabled for all origins.

Request bodies are validated by a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
— a field not declared in a DTO causes `400 Bad Request` instead of being silently dropped. Routes marked **JWT** below
need an `Authorization: Bearer <accessToken>` header (from `POST /auth/login`); routes marked **Admin** need the token from
`POST /admin/auth/login` instead (an applicant token is rejected with `403`, an admin token on a **JWT** route with `401`);
the rest are public.

### Endpoints

| Method | Path                             | Description                                                                |
| ------ | -------------------------------- | -------------------------------------------------------------------------- |
| `GET`  | `/`                              | Scaffold health check — returns the plain string `Hello World!`            |
| `POST` | `/applications`                  | Submit an onboarding application (`multipart/form-data`)                   |
| `POST` | `/applications/payment-webhook`  | Bachs payment webhook; marks the application paid (JSON)                   |
| `POST` | `/applications/create-password`  | Set an account password using the emailed GS code (JSON)                   |
| `GET`  | `/applications/me/payment`       | **JWT** — has the logged-in applicant paid the program fee?                |
| `POST` | `/applications/me/payment/checkout` | **JWT** — start a Bachs checkout for the logged-in applicant            |
| `POST` | `/auth/login`                    | Log in with email + password, returns a JWT (JSON)                         |
| `POST` | `/auth/forgot-password`          | Email a single-use password-reset link (JSON)                              |
| `POST` | `/auth/reset-password`           | Set a new password using the emailed reset token (JSON)                    |
| `POST` | `/admin/auth/login`              | Admin login with the seeded email + password, returns an admin JWT (JSON)  |
| `GET`  | `/admin/applications`            | **Admin** — applications (paginated) with all submitted details and invite state |
| `POST` | `/admin/applications/:id/invite` | **Admin** — email the applicant their GS code (also resends)               |
| `POST` | `/admin/applications/:id/reject` | **Admin** — email the applicant that they were rejected and mark it        |
| `GET`  | `/dashboard`                     | **JWT** — the caller's dashboard: banner, announcements, events, to-dos    |
| `GET`  | `/admin/dashboard/items`         | **Admin** — announcements / events / assignments (`?type=`)                |
| `POST` | `/admin/dashboard/items`         | **Admin** — add one                                                        |
| `PATCH`| `/admin/dashboard/items/:id`     | **Admin** — edit one                                                       |
| `DELETE`| `/admin/dashboard/items/:id`    | **Admin** — delete one                                                     |
| `GET`  | `/admin/dashboard/banners`       | **Admin** — program banners                                                |
| `PUT`  | `/admin/dashboard/banners`       | **Admin** — create or replace the banner for a program + cohort            |
| `DELETE`| `/admin/dashboard/banners/:id`  | **Admin** — delete a banner                                                |
| `GET`  | `/discussions/:classId/comments` | **JWT** — list a class's discussion comments with their replies            |
| `POST` | `/discussions/:classId/comments` | **JWT** — post a comment or a reply                                        |
| `POST` | `/discussions/comments/:id/like` | **JWT** — like a comment (toggle; clears an existing dislike)              |
| `POST` | `/discussions/comments/:id/dislike` | **JWT** — dislike a comment (toggle; clears an existing like)           |
| `GET`  | `/quizzes/:quizId`               | **JWT** — a quiz's questions (no answer key) and the caller's last attempt |
| `POST` | `/quizzes/:quizId/submissions`   | **JWT** — submit answers; graded and the score is saved                    |
| `GET`  | `/resources`                     | **JWT** — resource vault: curated articles and videos, by category or search |

Applications are reviewed through the admin endpoints above (and the `growth-x-admin` portal's `/admin/applications` page). Invite sets an
application's status to `accepted` and reject sets it to `rejected`; `reviewed` has no endpoint yet.

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

**Review, GS code and email:** there is no payment step at submission. After the record is saved, an "application
received — we'll review your profile and email you the next steps" email goes to `applicationPortal.email`. A random
12-character `gsCode` is generated and stored on the record (never returned) but **not** emailed: an admin reviews the
application and sends the invite (`POST /admin/applications/:id/invite`), which emails the code and a link to
`<FRONTEND_URL>/create-password?gsCode=<code>`. Emails are sent in the background: a mail failure is logged and does not
fail the request.

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

### POST /applications/payment-webhook

Public, called by Bachs. Configure this URL (`<backend>/api/v1/applications/payment-webhook`) as a webhook endpoint in
the Bachs dashboard for the `collection.succeeded` / `checkout.completed` events. The body is Bachs' event envelope
(`{ id, type, created_at, organization_id, data }`); only the checkout id in `data` is read. The body itself is never
trusted: the backend fetches the checkout session from Bachs (`GET /v1/checkout-sessions/{id}`) with the API key and
only marks the application paid (`paidAt`) when Bachs says the payment succeeded (and emails the GS code only if the
account has no password yet). Repeat
deliveries are ignored once paid. Unknown checkout ids are ignored. Always answers `200 { "received": true }`; if
Bachs can't be reached the request fails so Bachs retries.

> `X-Bachs-Signature` verification is not implemented yet because the signing scheme wasn't in the docs we read. The
> re-fetch above is what keeps forged requests from marking anyone paid.

### POST /applications/create-password

Public. JSON body. Backs the frontend `/create-password` page: the applicant opens the link from their email and
sets a password, authenticated only by the GS code.

| Field      | Type   | Required | Notes                                                                                 |
| ---------- | ------ | -------- | ------------------------------------------------------------------------------------- |
| `gsCode`   | string | Yes      | The code emailed by the admin invite (`POST /admin/applications/:id/invite`)          |
| `password` | string | Yes      | min 8 chars, with at least one number, one uppercase letter and one special character |

```json
{ "gsCode": "ABCD2345WXYZ", "password": "Good#Pass1" }
```

The password is hashed with bcrypt and stored on the application as `passwordHash` (never returned). A GS code can be
used once: after a password is set, the same code is rejected. The code is only emailed by the admin invite, so it
is the proof the applicant was approved; the endpoint does not check `invitedAt`, but it refuses (`403`) an application
that has since been rejected. Applications created while
payment was required (`paymentRequired`) must still have paid.

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

### GET /applications/me/payment

**JWT.** Backs the dashboard's non-dismissable payment modal: the frontend asks this right after login (and keeps
asking every 10 s while the modal is up) and shows the modal while `hasPaid` is `false`. Unpaid means the
application has no `paidAt`. If the account has a Bachs checkout in flight, the backend re-fetches it from Bachs
first and records the payment when Bachs says it succeeded, so the modal clears even if the webhook is late or
can't reach the backend (local dev). If Bachs can't be reached it simply answers `hasPaid: false`.

**Response `200`:**

```json
{ "status": "Success", "statusCode": 200, "data": { "hasPaid": false } }
```

### POST /applications/me/payment/checkout

**JWT.** No body. Creates a Bachs checkout (`POST /v1/checkout-sessions`, priced by `BACHS_PRODUCT_ID` or
`BACHS_AMOUNT` + `BACHS_CURRENCY`) for the caller's application, stores its id as `bachsCheckoutId` (replacing any
earlier one; that's the id the webhook matches), and returns the hosted URL for the frontend to redirect to. Bachs
sends the payer back to `<FRONTEND_URL>/success` or `/cancel`, both of which link back to the dashboard.

**Response `200`:**

```json
{ "status": "Success", "statusCode": 200, "paymentUrl": "https://checkout.bachs.io/..." }
```

**Errors:**

| Status | When                                                                      |
| ------ | ------------------------------------------------------------------------- |
| `401`  | Missing, invalid or expired token                                         |
| `404`  | The token's application no longer exists                                  |
| `409`  | Payment has already been made (also checked against Bachs for old checkouts) |
| `503`  | The Bachs checkout could not be created                                   |

Once payment is confirmed (by the webhook or by `GET /applications/me/payment`), the GS code email is only sent to
accounts that haven't created a password yet; someone paying after login gets no email.

---

## Admin

Staff accounts live in their own `admins` collection (`AdminEntity`: `name`, `email`, bcrypt `passwordHash`), apart from
applications. An admin token carries `role: "admin"`; `AdminGuard` rejects anything without it, and `JwtAuthGuard`
rejects anything with it, so neither kind of token works on the other's routes.

### Seeded admin account

On every boot `AdminSeederService` creates the admin if no admin with that email exists. If one already exists it is
left alone, with one exception: when `ADMIN_PASSWORD` is set in the environment, the stored password is updated to match
it, so editing `.env` and restarting is how you change the password. The built-in dev defaults never overwrite an
existing admin.

| Environment      | Email                | Password             |
| ---------------- | -------------------- | -------------------- |
| not `production` | `admin@growthx.com`  | `GrowthX@Admin2026`  |
| `production`     | `ADMIN_EMAIL`        | `ADMIN_PASSWORD`     |

The dev credentials are for local use only. In production nothing is seeded unless both variables are set (a warning is
logged instead), so set strong values, and change the dev password if your dev database is reachable by others. Log in at
the admin portal's `/admin/login` (`growth-x-admin`, `http://localhost:3001` in dev).

### POST /admin/auth/login

Public. JSON body `{ "email": "...", "password": "..." }`. The email is matched case-insensitively.

**Response `200`:**

```json
{
  "status": "Success",
  "statusCode": 200,
  "data": {
    "accessToken": "<jwt, 8 h>",
    "admin": { "id": "...", "name": "Growth X Admin", "email": "admin@growthx.com" }
  }
}
```

`401` for a wrong email or password (same message for both).

### GET /admin/applications

**Admin.** Applications, newest first, one page at a time. Optional query params: `page` (default `1`) and `limit`
(default `10`, max `100`). `data` is a list of:

```json
{
  "id": "...",
  "applicationPortal": { "fullName": "...", "email": "...", "program": "...", "cohort": "..." },
  "personalInfo": { "title": "...", "surname": "...", "firstName": "...", "businessName": "...", "dateOfBirth": "...", "gender": "..." },
  "businessBasics": { "businessDescription": "...", "operatingDuration": "...", "averageRevenue": "...", "fullTimeCommitment": "..." },
  "whoYouAre": { "challengeAndSkillGap": "...", "cohortMotivation": "..." },
  "accessibilitySupport": { "hasAccessibilityNeeds": "no" },
  "submit": { "passportPhotoUrl": "..." },
  "status": "pending",
  "createdAt": "...",
  "invitedAt": null,
  "hasAccount": false
}
```

`invitedAt` is when the last invite email went out (`null` if never); `hasAccount` is true once the applicant has set
a password. The GS code and password hash are never included.

The response also carries `meta`: `{ "total": 23, "page": 1, "limit": 10, "totalPages": 3 }`. A `page` past the last one
returns an empty `data` list; `page`/`limit` that aren't positive integers (or a `limit` over 100) fail with `400`.

### POST /admin/applications/:id/invite

**Admin.** Emails the applicant their GS code and a `/create-password` link, then sets `invitedAt` and `status` to
`accepted`. Calling it again resends the email. Unlike the other emails this one is awaited: if it can't be sent
nothing is marked and the request fails.

**Response `200`:** `{ "status": "Success", "statusCode": 200, "message": "Invite sent", "data": <same shape as a list item> }`

| Status | When                                                   |
| ------ | ------------------------------------------------------ |
| `401`  | Missing, invalid or expired token                      |
| `403`  | The token is not an admin token                        |
| `404`  | No application with that id                            |
| `409`  | The applicant has already created their account        |
| `503`  | The invite email could not be sent                     |

### POST /admin/applications/:id/reject

**Admin.** No body. Emails the applicant that they weren't accepted this time (and may apply to a later cohort), then
sets `status` to `rejected`. The email is awaited: if it can't be sent nothing is changed and the request fails, so the
admin can retry. A rejected applicant's earlier GS code stops working (`POST /applications/create-password` answers
`403`). Inviting them afterwards is still possible and sets the status back to `accepted`.

**Response `200`:** `{ "status": "Success", "statusCode": 200, "message": "Applicant rejected", "data": <same shape as a list item> }`

| Status | When                                                   |
| ------ | ------------------------------------------------------ |
| `401`  | Missing, invalid or expired token                      |
| `403`  | The token is not an admin token                        |
| `404`  | No application with that id                            |
| `409`  | The applicant already has an account, or is already rejected |
| `503`  | The rejection email could not be sent                  |

---

## Dashboard

What learners see on `/dashboard` is managed from the admin portal and stored in two collections: `dashboard_banners`
(one program banner per program + cohort) and `dashboard_items` (announcements, calendar events and to-do assignments,
told apart by `type`). An item can be addressed to one program, one cohort, both, or everyone (`program` / `cohort`
`null`). The allowed values are the onboarding form's: programs `zero-to-launch`, `build-for-funding`,
`scale-your-sales`, `price-for-profit`, `lead-your-team`; cohorts `cohort-1` to `cohort-4`
(`src/dashboard/dashboard.constants.ts`, mirrored in the frontends). Applications created with an older form version
hold other program values (e.g. `product-design`); those learners only match content addressed to everyone.

### GET /dashboard

**JWT.** Everything that applies to the caller, matched on their application's `program` and `cohort`.

```json
{
  "status": "Success",
  "statusCode": 200,
  "data": {
    "program": "zero-to-launch",
    "cohort": "cohort-1",
    "banner": { "title": "Zero to Launch", "durationWeeks": 6, "leader": "Sarah A.B", "cohortMembers": 32 },
    "announcements": [{ "id": "...", "text": "...", "createdAt": "..." }],
    "events": [{ "id": "...", "text": "Live session", "date": "2026-12-09T14:00:00.000Z" }],
    "assignments": [{ "id": "...", "text": "Turn in Quiz 2", "date": "2026-12-15T10:59:00.000Z", "points": 20 }]
  }
}
```

`banner` is `null` until one is saved for that exact program + cohort (a learner with no cohort never gets one).
`announcements` are newest first, at most 5. `events` are soonest first and start from yesterday (so today's survive
timezone differences). `assignments` are soonest due first, only those not yet due, at most 4; there is no submission
tracking, so nothing is ever marked done. `404` if the caller's application no longer exists.

### GET /admin/dashboard/items?type=

**Admin.** `type` is required: `announcement`, `event` or `assignment`. Announcements come newest first, the others by
date. Each item in `data`: `{ id, type, program, cohort, text, date, points, createdAt }` (`date` is the event date or
the assignment's due date, `null` for announcements; `points` is only set on assignments).

### POST /admin/dashboard/items

**Admin.** JSON body.

| Field     | Type            | Required                | Notes                                                      |
| --------- | --------------- | ----------------------- | ---------------------------------------------------------- |
| `type`    | string          | Yes                     | `announcement`, `event` or `assignment`; fixed afterwards  |
| `text`    | string          | Yes                     | Max 500 chars. The message, event title or assignment title |
| `program` | string \| null  | No                      | Omit or `null` for every program                           |
| `cohort`  | string \| null  | No                      | Omit or `null` for every cohort                            |
| `date`    | ISO date string | `event` and `assignment` | Event date / due date. Ignored for announcements           |
| `points`  | integer         | `assignment`            | 0 to 1000. Ignored for other types                         |

**Response `201`:** `{ "status": "Success", "statusCode": 201, "data": <item> }`. `400` on validation errors.

### PATCH /admin/dashboard/items/:id

**Admin.** Any of `text`, `program`, `cohort`, `date`, `points` (the type can't change). `null` for `program` / `cohort`
means everyone; `date` / `points` are ignored on types that don't use them. **Response `200`:** the updated `data`.
`404` for an unknown id.

### DELETE /admin/dashboard/items/:id

**Admin.** `200 { "message": "Item deleted" }`, `404` for an unknown id.

### GET /admin/dashboard/banners

**Admin.** All banners, ordered by program then cohort: `{ id, program, cohort, title, durationWeeks, leader, cohortMembers }`.

### PUT /admin/dashboard/banners

**Admin.** Creates the banner for `program` + `cohort`, or replaces the one that exists (that pair is unique). Body:
`program`, `cohort` (both required, from the lists above), `title` (max 100), `durationWeeks` (1 to 104), `leader`
(max 100), `cohortMembers` (0 to 100000). **Response `200`:** the saved banner as `data`.

### DELETE /admin/dashboard/banners/:id

**Admin.** `200 { "message": "Banner deleted" }`, `404` for an unknown id. Learners of that program + cohort go back to
seeing just their program name.

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
