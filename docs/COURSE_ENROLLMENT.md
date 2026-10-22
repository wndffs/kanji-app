# Explicit Published-Course Enrollment

The dashboard links to `/courses`. Learners can add a published structured
course, then choose it using the existing current-course control. Joining never
changes the current course automatically, creates learning cards, reschedules
SRS, or modifies private answers/mnemonics. A DRAFT main course is not offered.

## API

- Authenticated `GET /courses/available?cursor=<uuid>` returns at most 20 public
  course summaries and a continuation cursor. The query excludes every course
  already joined by this user, regardless of enrollment status. It never lists
  draft/archived courses or private decks. Empty/error states are distinct.
- Authenticated `POST /courses/enroll` accepts only `courseId` as a UUID. User
  identity always comes from authentication, never the body.
- A Serializable transaction locks the owner row, then the published structured
  course row, and upserts only that owner's enrollment. Repeated requests are
  idempotent. The empty update preserves existing paused/completed enrollment
  status instead of resetting it. Serialization/uniqueness conflicts return a
  recoverable 409; missing/unpublished courses return 404.
- The response uses the existing course-selection DTO. No settings, lesson,
  answer or schedule write is part of enrollment. Course switching retains its
  independent active-lesson conflict check.

## Client and Verification

The catalog keeps an item after a failed save, allows a retry, disables repeated
submissions during a write, and removes it only after server confirmation.
Requests are revision/token scoped. Account changes clear old rows; a late old
response or 401 cannot replace another account's catalog or clear its session.

Focused API tests cover publication, ownership, UUID validation, bounded keyset
pagination, conflict feedback and no unrelated writes. A guarded PostgreSQL 18
case exercises competing real enrollments and preservation of current course,
existing enrollment and SRS. Desktop/mobile browser cases cover empty/error,
retry, pagination, account changes and responsive long course titles.

Enrollment requires the course to have been independently published first.
This endpoint cannot publish a course or bypass its editorial quality gate.
