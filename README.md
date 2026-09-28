# Growth X — Backend API

NestJS 11 REST API backing the Growth X application/admissions flow. MongoDB via TypeORM's
`mongodb` connector (not Mongoose), Cloudinary for image uploads. No authentication layer —
the frontend onboarding wizard has no login step, so this API has none either.

## Getting Started

```bash
npm install
cp .env.example .env   # fill in the values described below
npm run start:dev      # http://localhost:<PORT>/api/v1
```

## Environment Variables

MongoDB connection string (TypeORM `mongodb` connector). |
| `PORT` | Port the HTTP server listens on `5000`. |
| `CLOUDINARY_CLOUD_NAME`| Cloudinary account cloud name — used for passport photo uploads. |
| `CLOUDINARY_API_KEY`| Cloudinary API key. |
| `CLOUDINARY_API_SECRET`| Cloudinary API secret. |

## API Documentation

Base URL: `http://localhost:5000/api/v1` (global prefix set in `src/main.ts`; port from `PORT`).

All request bodies are validated with a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — any field not listed in a DTO below causes a `400 Bad Request`, not a silent drop. There is no auth on any route.

---

## Applications (`/applications`)

Backs the frontend onboarding wizard (`growth-x/app/(auth)/onboarding`) — one endpoint aggregates every step's answers into a single saved record.

### POST /applications
Public. `multipart/form-data` (not JSON) so the optional passport photo can travel in the same request. The request body is still flat — the grouping below is only how the saved record is stored and returned (see `src/applications/entities/application-groups.entity.ts`), so the frontend doesn't need to nest anything when submitting.

| Field | Type | Required | From wizard step | Notes |
| --- | --- | --- | --- | --- |
| `fullName` | string | Yes | Application Portal | min 2 chars |
| `email` | string | Yes | Application Portal | valid email |
| `program` | string | Yes | Application Portal | |
| `cohort` | string | No | Application Portal | |
| `title` | string | No | Personal Information | |
| `surname` | string | Yes | Personal Information | |
| `firstName` | string | Yes | Personal Information | |
| `businessName` | string | Yes | Personal Information | |
| `dateOfBirth` | date | Yes | Personal Information | ISO date string |
| `gender` | string | Yes | Personal Information | |
| `businessDescription` | string | Yes | Business Basics | min 10 chars |
| `operatingDuration` | `"less-than-6-months" \| "6-months-to-1-year" \| "1-3-years" \| "3-5-years" \| "more-than-5-years"` | Yes | Business Basics | |
| `averageRevenue` | `"no-revenue-yet" \| "early-revenue" \| "growing-revenue" \| "significant-revenue"` | Yes | Business Basics | |
| `fullTimeCommitment` | `"full-time" \| "not-yet"` | Yes | Business Basics | |
| `challengeAndSkillGap` | string | Yes | Who You Are | min 10 chars |
| `cohortMotivation` | string | Yes | Who You Are | min 10 chars |
| `hasAccessibilityNeeds` | `"yes" \| "no"` | Yes | Accessibility & Support | |
| `passportPhoto` | file | No | Submit | JPEG/PNG only, max 2 MB |

`passportPhoto`, if sent, is streamed straight to Cloudinary (folder `growth-x/passport-photos`) — nothing is written to local disk. The saved record stores the returned `secure_url` as `submit.passportPhotoUrl`.

Response `201`:
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
      "hasAccessibilityNeeds": "no"
    },
    "submit": {
      "passportPhotoUrl": "https://res.cloudinary.com/.../growth-x/passport-photos/....jpg"
    },
    "status": "pending",
    "createdAt": "..."
  }
}
```

Errors: `400` on any failed field validation (see table above); `415` if `passportPhoto` isn't JPEG/PNG; `413` if it's over 2 MB.

`status` defaults to `pending` — it's tracked on the record for future review tooling, but there's no endpoint yet to read applications back or change their status. Review currently happens by querying MongoDB directly (e.g. via Atlas or `mongosh`).
