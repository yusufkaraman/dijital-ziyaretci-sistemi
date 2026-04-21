# PostgreSQL & Prisma Migration Plan
## Digital Visitor System - Executable Technical Specification

**Migration Style:** Low-Risk Staged Cutover, No Frontend Contract Changes, SQLite Fallback Until PostgreSQL Parity Is Verified

**Deletion Policy:** Do not delete frontend files, backend route or service files, SQLite data, fallback logic, tests, or legacy compatibility code during the migration. Deletion and cleanup are allowed only in the final cleanup phase after automated and manual validation both pass.

---

## 1. Purpose and Expected Final Output

This document defines the exact target state for migrating the current Digital Visitor System from the synchronous SQLite/sql.js layer in `server/database.js` to PostgreSQL with Prisma.

### 1.1 Target State
At the end of the migration, the project should have all of the following:

- PostgreSQL running locally through Docker alongside the existing SQLite file during the transition.
- A valid `DATABASE_URL` in `.env` for Prisma.
- A complete `prisma/schema.prisma` covering the current active SQLite schema.
- Prisma migration history under `prisma/migrations`.
- A shared `server/prisma.js` client module.
- Routes and services reading and writing through Prisma instead of `db.prepare()`.
- A repeatable importer from `server/database.db` into PostgreSQL.
- Updated seed and test bootstrap flow that works without changing frontend pages.
- SQLite retained as fallback until PostgreSQL behavior is proven equivalent.

### 1.2 In Scope
- Backend persistence migration from SQLite to PostgreSQL.
- Prisma schema design and migration history.
- Data import from the current `server/database.db`.
- Seed, startup, and integration test updates.
- Preserving route URLs, request payloads, response keys, and Socket.IO event names.

### 1.3 Out of Scope
- Frontend redesign or frontend framework changes.
- TypeScript migration.
- Permission model redesign.
- Early deletion of SQLite support before parity is verified.
- Claiming hard zero-downtime guarantees without a real rollout mechanism.

### 1.4 Current Codebase Baseline
This specification is based on the current repository structure and must remain aligned with the existing backend shape, especially `server/database.js`, `server/index.js`, `server/seed.js`, `server/seed-auto.js`, route modules under `server/routes/`, service modules under `server/services/`, and the integration suite in `tests/api.integration.test.js`.

### 1.5 Executive Summary
The recommended implementation approach is:

1. provision PostgreSQL and Prisma without touching the frontend contract
2. model the complete schema and constraints from `server/database.js`
3. build an importer from SQLite to PostgreSQL
4. switch backend data access incrementally, not all at once
5. validate each milestone through tests and manual parity checks
6. keep SQLite available until PostgreSQL is proven stable

### 1.6 Assumptions and Preconditions
- Docker is available on the target machine.
- Node.js and npm are already working for the current project.
- The current SQLite-backed application is the behavioral baseline.
- `tests/api.integration.test.js` is treated as an important safety net, but not the only source of truth.
- The SQLite database file remains the source of truth during the migration window.

### 1.7 Non-Negotiable Invariants
- Do not delete files, fallback code paths, tests, or legacy compatibility logic before the final validated cleanup phase.
- Keep existing route URLs unchanged.
- Keep JSON response keys and high-level shapes unchanged.
- Keep Socket.IO event names unchanged.
- Keep role and permission behavior unchanged unless a separate task authorizes a change.
- Keep frontend pages in `public/` functionally unchanged.
- Keep seed behavior operationally equivalent, even if implementation details change.
- Keep rollback possible until acceptance criteria are fully met.
- At each safe checkpoint, stop and emit the session handoff format defined later in section `9.4A` before continuing into the next major milestone.

### 1.8 Architecture Decision Log
- Use PostgreSQL plus Prisma instead of raw PostgreSQL queries as the target architecture because schema drift, migrations, and model mapping need to be explicit and reviewable.
- Preserve SQLite during the migration window because the current `server/database.db` is both the behavioral baseline and the fastest rollback source.
- Prefer staged cutover instead of a one-shot rewrite because routes such as `visitors`, `appointments`, `screen`, `settings`, and `logs` have coupled behavior that is easier to verify incrementally.
- Preserve snake_case database names through Prisma mapping instead of renaming columns during migration, because API compatibility and debugging against legacy data are higher priorities than cosmetic naming cleanup.
- Keep integration tests as a required gate because `tests/api.integration.test.js` already encodes route behavior, permissions, ordering expectations, and basic performance thresholds.

## 2. Environment and PostgreSQL Provisioning

### 2.1 Creating `docker-compose.yml`
Create a `docker-compose.yml` file in the project root directory so PostgreSQL can run next to SQLite during the migration window. Prefer environment variables instead of hardcoded credentials.

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: dijital-ziyaretci-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      TZ: Europe/Istanbul
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
```

### 2.2 Dependencies and `.env`
Initialize Prisma and install only the packages that are actually missing from the current project:

```bash
docker compose up -d
npm install prisma --save-dev
npm install @prisma/client
npx prisma init
```

`dotenv` is already present in `package.json`, so it should be reused rather than reinstalled as a new requirement.

Use `.env` values in this shape:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-me
POSTGRES_DB=dijital_ziyaretci
POSTGRES_TEST_DB=dijital_ziyaretci_test_local
DATABASE_URL="postgresql://postgres:change-me@localhost:5432/dijital_ziyaretci?schema=public&connection_limit=10&pool_timeout=20"
DIRECT_URL="postgresql://postgres:change-me@localhost:5432/dijital_ziyaretci?schema=public"
TEST_DATABASE_URL="postgresql://postgres:change-me@localhost:5433/dijital_ziyaretci_test_local?schema=public&connection_limit=5&pool_timeout=20"
TEST_DIRECT_URL="postgresql://postgres:change-me@localhost:5433/dijital_ziyaretci_test_local?schema=public"
```

Keep `DB_PATH` and the current SQLite file available until import, validation, and rollback checks are complete.

### 2.2.1 Local Test Database Isolation
- Local `npm test` runs must never default to the same database used by `npm start`.
- The test bootstrap should resolve PostgreSQL test connectivity in this order: `TEST_DATABASE_URL`, test-specific env file content such as `.env.test`, then fail fast if only the development `DATABASE_URL` is available.
- Use a separate local test database name and a different host port such as `5433` so the application can run on the development database while tests run on an isolated test database.
- Reset, truncate, or recreate only the test database during automated tests.

### 2.2.2 Environment Template Files
- Create and check in `.env.example` with placeholders for `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_TEST_DB`, `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL`, `TEST_DIRECT_URL`, and `DB_PATH`.
- If test bootstrap uses a separate file such as `.env.test`, also check in `.env.test.example` with the non-secret structure required for local and CI test setup.
- Do not require new developers or CI to infer database variables from prose alone.

### 2.2.3 Secret Management Notes
- `.env.example` and `.env.test.example` must contain placeholders only, never real credentials or live tokens.
- Local development may use `.env`, but CI, staging, and production should inject real secrets from a platform secret store such as GitHub Actions Secrets, a vault product, or the deployment platform's native secret manager.
- Treat `change-me` values in this document as documentation placeholders only.
- Production and staging cutover notes must specify where `DATABASE_URL`, `DIRECT_URL`, Azure OAuth secrets, and any Web Push secrets are sourced at runtime.

### 2.3 CI/CD and Test Runtime Provisioning
Local Docker setup is not sufficient by itself. The migration plan must also define how PostgreSQL is started in CI so the PostgreSQL-backed test suite runs in a clean environment without depending on a developer machine.

For GitHub Actions, prefer a service container similar to the following:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: change-me
          POSTGRES_DB: dijital_ziyaretci_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres -d dijital_ziyaretci_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:change-me@127.0.0.1:5432/dijital_ziyaretci_test?schema=public
      DIRECT_URL: postgresql://postgres:change-me@127.0.0.1:5432/dijital_ziyaretci_test?schema=public
      TEST_DATABASE_URL: postgresql://postgres:change-me@127.0.0.1:5432/dijital_ziyaretci_test?schema=public
      TEST_DIRECT_URL: postgresql://postgres:change-me@127.0.0.1:5432/dijital_ziyaretci_test?schema=public
      DB_PATH: ./server/database.db
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm test
```

If CI or local development prefers Docker Compose, add a test-only file such as `docker-compose.test.yml` with an isolated host port and no dependency on the developer's primary PostgreSQL instance. A minimal example:

```yaml
version: '3.8'

services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: dijital_ziyaretci_test_local
      TZ: Europe/Istanbul
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d dijital_ziyaretci_test_local"]
      interval: 10s
      timeout: 5s
      retries: 5
```

Use `5433` for the test container so a developer can run the application against the development database on `5432` while tests run against the isolated test database.

### 2.4 Connection Pooling and Prisma Client Strategy
`server/prisma.js` must not be treated as a trivial one-line wrapper. The migration must define connection behavior explicitly:

- use one shared `PrismaClient` instance per process and a development-time `globalThis` guard to avoid leaking clients during reloads
- review `connection_limit` and `pool_timeout` in deployed environments instead of relying on implicit defaults
- keep a separate `DIRECT_URL` for migrations and administrative schema commands if runtime traffic uses a pooled connection string
- use direct PostgreSQL connections in local development and CI unless real concurrency measurements justify a pooler
- treat PgBouncer as an explicit production infrastructure decision for higher concurrency, not as an assumed part of the initial migration
- if PgBouncer is adopted later, keep Prisma migrations on the direct connection and revalidate Prisma compatibility against the pooled runtime path

Recommended baseline:

```env
DATABASE_URL="postgresql://postgres:change-me@localhost:5432/dijital_ziyaretci?schema=public&connection_limit=10&pool_timeout=20"
DIRECT_URL="postgresql://postgres:change-me@localhost:5432/dijital_ziyaretci?schema=public"
```

### 2.4.1 Runtime Observability and Monitoring
The migration plan must define how PostgreSQL behavior is observed after cutover, not only how it is configured.

- Add a Prisma query-observation hook such as `prisma.$on('query', ...)` for migration diagnostics, staging validation, or temporary production troubleshooting; when enabled, log query duration and the query target without leaking secrets.
- Monitor connection saturation through PostgreSQL connection-state visibility such as `pg_stat_activity` and through application-side connection-acquisition timeout errors; repeated pool timeout behavior should be treated as a production risk signal.
- Configure PostgreSQL `log_min_duration_statement` to a non-zero threshold during migration validation and the first cutover window so slow queries become visible in logs.
- Keep verbose query logging sampled or environment-gated so the long-term runtime does not drown in log noise.

### 2.5 Migration Command Policy
- Use `npx prisma migrate dev --name init_postgres` for local schema creation with history.
- Use `npx prisma migrate deploy` in controlled environments.
- Do not rely on `npx prisma db push` as the final project migration strategy.

### 2.6 Prisma Version Pinning Policy
- Pin `prisma` and `@prisma/client` to the same exact version in `package.json` without a caret or loose range.
- Commit the package-manager lockfile so Prisma engines and generated client behavior remain stable across local machines and CI.
- Validate the chosen Prisma version against Node.js 20 in CI because the migration plan already uses Node 20 as the baseline automation runtime.
- Do not upgrade one Prisma package without the other; any Prisma version bump must be a deliberate task followed by `npx prisma validate`, `npx prisma generate`, and `npm test`.

---

## 3. Schema Design Requirements (`schema.prisma`)

The Prisma schema must cover the real SQLite schema created in `server/database.js`, not only representative examples.

### 3.1 Required Model Coverage
The schema must model all active tables currently created by the application:

- `users`
- `companies`
- `personnel`
- `visitors`
- `appointments`
- `rooms`
- `room_reservations`
- `blacklist`
- `contents`
- `activity_logs`
- `screen_logs`
- `system_settings`
- `system_logs`
- `push_subscriptions`

### 3.2 Modeling Rules
- Preserve real table names with `@@map(...)` and snake_case columns with `@map(...)`.
- Model nullable foreign keys explicitly, especially `host_personnel_id`, `host_user_id`, `user_id`, `visitor_id`, `company_id`, and `current_visitor_id`.
- Preserve unique constraints such as `users.username`, `system_settings.key`, and the composite uniqueness on `push_subscriptions`.
- Convert clear boolean flags from SQLite `0`/`1` to Prisma `Boolean` fields where semantics are known.
- Preserve text fields as text unless a verified application requirement justifies changing their type.

### 3.3 Timestamp and Index Rules
- Do not copy `datetime('now','+3 hours')` directly into PostgreSQL defaults.
- Store timestamps consistently and preserve imported historical values.
- When importing a SQLite timestamp string that has no offset, interpret it as the legacy application wall-clock value from `Europe/Istanbul`, convert it once into `TIMESTAMPTZ`, and never apply the `+3 hours` adjustment a second time.
- Add a dedicated automated test case with fixed fixture timestamps near day-boundary and month-boundary values so double-shift and calendar-day drift are detected during the migration.
- Recreate the intent of the current SQLite indexes, especially for users, personnel, visitors, appointments, activity logs, screen logs, and companies.
- Use `@unique`, `@@unique`, and `@@index` in `schema.prisma` whenever Prisma can express the real constraint or index directly.
- Put Prisma-supported indexes in the same migration that creates or materially changes the owning table, instead of leaving index timing to later guesswork.
- Use hand-written SQL migrations only for unsupported constructs such as partial, expression, or operationally staged indexes.
- If Prisma schema syntax is insufficient for an index or constraint, add it through a SQL migration rather than dropping it.

### 3.4 High-Risk Field Mapping Matrix
The following matrix highlights the highest-risk and contract-sensitive field conversions. Any unlisted column should still be preserved 1:1 unless a separate decision log entry explicitly changes it.

| SQLite Table.Column | Prisma Model.Field | PostgreSQL Type Target | Nullability | Migration Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| `users.password_hash` | `User.passwordHash` | `TEXT` | non-null | copy directly | used by bcrypt login and password change |
| `users.is_active` | `User.isActive` | `BOOLEAN` | non-null | map `0/1` to `false/true` | auth middleware depends on active users only |
| `users.created_at` | `User.createdAt` | `TIMESTAMPTZ` | non-null | parse legacy text timestamp, preserve historical value | do not hardcode `+3 hours` default in target schema |
| `companies.is_default` | `Company.isDefault` | `BOOLEAN` | non-null | map `0/1` to `false/true` | only one active default company should remain |
| `companies.is_active` | `Company.isActive` | `BOOLEAN` | non-null | map `0/1` to `false/true` | company delete flow is soft-delete style |
| `personnel.company_id` | `Personnel.companyId` | `INTEGER` foreign key | nullable | preserve or set `NULL` | personnel can exist without a company |
| `personnel.user_id` | `Personnel.userId` | `INTEGER` foreign key | nullable | convert `0` to `NULL`, preserve valid links | importer must preserve later `host_user_id` resolution behavior |
| `personnel.is_active` | `Personnel.isActive` | `BOOLEAN` | non-null | map `0/1` to `false/true` | list endpoints default to active personnel |
| `visitors.host_personnel_id` | `Visitor.hostPersonnelId` | `INTEGER` foreign key | nullable | preserve or set `NULL` | host resolution depends on this value |
| `visitors.host_user_id` | `Visitor.hostUserId` | `INTEGER` foreign key | nullable | preserve or derive from personnel when needed | must match legacy host filtering behavior |
| `visitors.is_approved` | `Visitor.isApproved` | `BOOLEAN` | non-null | map `0/1` to `false/true` | approval and verify routes depend on it |
| `visitors.is_screen_active` | `Visitor.isScreenActive` | `BOOLEAN` | non-null | map `0/1` to `false/true` | lobby screen state depends on it |
| `visitors.arrival_time` | `Visitor.arrivalTime` | `TIMESTAMPTZ` | nullable | parse legacy text timestamp | used by active visitor ordering |
| `visitors.checkout_time` | `Visitor.checkoutTime` | `TIMESTAMPTZ` | nullable | parse legacy text timestamp | used in checkout history and CSV export |
| `appointments.host_user_id` | `Appointment.hostUserId` | `INTEGER` foreign key | nullable | preserve or derive from `host_personnel_id` | appointment filters and check-in depend on it |
| `appointments.planned_time` | `Appointment.plannedTime` | `TIMESTAMPTZ` | non-null | parse legacy text timestamp | ordering must remain ascending in list endpoints |
| `appointments.status` | `Appointment.status` | `TEXT` or enum-compatible text | non-null | preserve exact string values | `planned`, `arrived`, and `cancelled` are behavior-sensitive |
| `rooms.current_visitor_id` | `Room.currentVisitorId` | `INTEGER` foreign key | nullable | preserve or set `NULL` | room occupancy updates use this value |
| `room_reservations.start_time` | `RoomReservation.startTime` | `TIMESTAMPTZ` | non-null | parse legacy text timestamp | overlap check logic depends on comparable timestamps |
| `room_reservations.end_time` | `RoomReservation.endTime` | `TIMESTAMPTZ` | non-null | parse legacy text timestamp | overlap check logic depends on comparable timestamps |
| `system_settings.key` | `SystemSetting.key` | `TEXT` unique | non-null | copy directly | settings API depends on exact key names |
| `system_settings.value` | `SystemSetting.value` | `TEXT` | nullable | copy directly | preserve text values exactly, including logo and weather settings |
| `system_logs.details` | `SystemLog.details` | `TEXT` | nullable | copy directly | error log payloads may be free-form text |
| `push_subscriptions.subscription` | `PushSubscription.subscription` | `TEXT` | non-null | copy serialized JSON string directly | preserve composite uniqueness with `user_id` |
| `activity_logs.details` | `ActivityLog.details` | `TEXT` | nullable | copy directly | human-readable audit trail should remain searchable |
| `screen_logs.end_time` | `ScreenLog.endTime` | `TIMESTAMPTZ` | nullable | preserve open sessions as `NULL` | active screen log detection depends on null end time |
| `screen_logs.duration_seconds` | `ScreenLog.durationSeconds` | `INTEGER` | nullable | preserve or recalculate only if source is missing | keep imported values when present |

---

## 4. Backend Refactor Scope

### 4.1 Files and Runtime Surface Affected
This migration impacts more than one route. The implementation must account for:

- `server/index.js`
- `server/database.js`
- `server/routes/auth.js`
- `server/routes/users.js`
- `server/routes/visitors.js`
- `server/routes/personnel.js`
- `server/routes/companies.js`
- `server/routes/contents.js`
- `server/routes/appointments.js`
- `server/routes/push.js`
- `server/routes/rooms.js`
- `server/routes/blacklist.js`
- `server/routes/screen.js`
- `server/routes/settings.js`
- `server/routes/logs.js`
- `server/routes/outlook.js`
- `server/routes/weather.js`
- service files under `server/services/`

### 4.2 Refactor Rules
- Add `server/prisma.js` as the shared Prisma client.
- Update startup so Prisma is connected before database-backed requests are served.
- Preserve the database-backed `/favicon.ico` lookup currently performed from `system_settings` in `server/index.js`.
- Replace synchronous `db.prepare().get()`, `all()`, and `run()` calls with asynchronous Prisma operations.
- Use transactions for multi-step flows that update visitors, logs, and screen state together.
- Preserve JSON response keys, route URLs, HTTP status behavior, and Socket.IO event names.
- Do not change frontend files as part of this migration unless a pure compatibility fix is required.

### 4.3 Compatibility Requirement
The backend may change internally, but the external contract must remain stable for:

- `public/` pages and existing HTML entry points
- authentication flows
- visitor and appointment CRUD flows
- company, personnel, room, and settings management
- screen and push-notification related flows
- integration tests in `tests/api.integration.test.js`

### 4.4 Recommended Execution Sequence
The migration should be executed in this order so risks remain isolated and reversible:

1. prepare PostgreSQL and Prisma without changing application behavior
2. inventory tables, indexes, route dependencies, and service dependencies from the current codebase
3. create the full Prisma schema and migration history
4. generate the Prisma client and verify database connectivity
5. build and validate the SQLite-to-PostgreSQL importer
6. adapt seed and test bootstrap logic for PostgreSQL
7. migrate backend modules in small groups, not all at once
8. run automated and manual validation after each group
9. remove transitional logic only after parity is demonstrated

### 4.5 File-by-File Implementation Map
Use the following work map to keep implementation structured:

| File or Area | Expected Action | Validation Requirement |
| --- | --- | --- |
| `package.json` | add or adjust scripts only if required for Prisma, import, or test bootstrap | scripts run successfully |
| `.env` | add PostgreSQL variables without removing SQLite fallback inputs too early | app can still boot in controlled mode |
| `docker-compose.yml` | define PostgreSQL service for local development | container becomes healthy |
| `prisma/schema.prisma` | model all active tables, mappings, and constraints | schema validates and migrates |
| `prisma/migrations/*` | persist schema history | migration applies cleanly |
| `server/prisma.js` | create shared Prisma client | backend can establish connection |
| `server/index.js` | swap startup/bootstrap flow carefully | server starts and key routes respond |
| `server/database.js` | keep only as fallback or import source during transition | rollback remains possible |
| `server/routes/*` | replace SQLite data access incrementally | route behavior and response keys stay stable |
| `server/services/*` | replace direct SQL helpers and preserve business rules | related route tests and manual checks pass |
| `server/seed.js` and `server/seed-auto.js` | preserve operational seed behavior under PostgreSQL | seeded data is usable and consistent |
| importer script | move data deterministically from SQLite to PostgreSQL | row counts and spot checks match |
| `tests/api.integration.test.js` | adapt bootstrap and DB setup for PostgreSQL | full test suite passes |

### 4.6 Route-to-Model-and-Test Matrix
Use this matrix to avoid changing a route without also checking its main models and current validation surface.

| Route Surface | Primary Tables / Prisma Models | Supporting Services / Dependencies | Current Validation Target |
| --- | --- | --- | --- |
| `/api/auth` | `users`, `activity_logs` | `middleware/auth`, `services/auth-service.js`, bcrypt, JWT | `auth endpoints work`, `change password endpoint enforces policy and updates credentials`, `manager cannot manage users and personnel user can change own password` |
| `/api/users` | `users`, `personnel`, `companies` | `services/user-service.js`, permissions | `secretary can create secretary and personnel users only`, performance test on `/api/users` |
| `/api/personnel` | `personnel`, `companies`, `users` | `services/personnel-service.js` | `personnel CRUD-like flow works`, `multi-company personnel data supports autocomplete flow`, performance test on `/api/personnel` |
| `/api/companies` | `companies` | permissions | `companies CRUD-like flow works`, `multi-company personnel data supports autocomplete flow` |
| `/api/visitors` | `visitors`, `personnel`, `companies`, `blacklist`, `activity_logs`, `screen_logs` | `services/visitor-service.js`, `services/appointment-service.js`, `services/screen-service.js`, validation middleware | `visitors full status flow works`, `screen and logs endpoints work`, performance test on `/api/visitors` |
| `/api/appointments` | `appointments`, `visitors`, `personnel`, `companies` | `services/appointment-service.js`, permissions | `appointments CRUD flow works`, appointment ordering/filter assertions |
| `/api/rooms` | `rooms`, `room_reservations`, `users` | `services/room-service.js` | `rooms flow works` |
| `/api/contents` | `contents` | `services/content-service.js`, multer, uploads filesystem, logger | `contents flow works for text records`; file-upload path also needs manual verification, including failure-path file cleanup when DB persistence fails |
| `/api/blacklist` | `blacklist` | auth for write routes | `blacklist flow works` |
| `/api/screen` | `visitors`, `screen_logs`, `companies`, `contents`, `system_settings` | `services/screen-service.js` | `screen and logs endpoints work` |
| `/api/logs` | `activity_logs`, `system_logs`, `screen_logs`, joined `users`, `visitors`, `personnel` | permissions | `screen and logs endpoints work` |
| `/api/settings` | `system_settings` | permissions | `settings and role permissions are enforced` |
| `/api/push` | `push_subscriptions` | auth middleware | add a dedicated smoke test for `POST /api/push/subscribe` that asserts `201` and verifies JSON payload round-trip fidelity in `push_subscriptions.subscription` |
| `/api/weather` | `system_settings` plus external weather API state | in-memory cache, external fetch | no direct integration test today; manual lobby/weather verification recommended |
| `/api/outlook` | `users` plus external Azure/Graph state | MSAL, Graph client, permissions | preserve current mock-mode behavior during the migration and manually validate `/login`, `/sync`, and `/callback`; `/callback` currently appends ` (Outlook Bağlı)` to `users.department` for the `state` user id, and token-storage redesign is out of scope |
| startup `/favicon.ico` lookup | `system_settings` plus filesystem paths | `server/index.js`, upload path, public assets | manual parity check required because the route is not directly covered by the current test suite |

### 4.7 Transaction Boundary Matrix
The following flows should be treated as explicit transaction candidates during the Prisma migration.

| Flow | Tables Involved | Transaction Requirement | Commit-After Side Effects |
| --- | --- | --- | --- |
| user create or update with personnel sync | `users`, `personnel` | create/update user and linked personnel record atomically | none; response can be built after commit |
| company default switch | `companies` | clear previous default and set new default atomically | none |
| settings bulk update | `system_settings` | all key updates in one logical transaction | none |
| appointment check-in | `appointments`, `visitors` | visitor creation plus appointment status update must commit together | Socket.IO emit after commit |
| visitor create | `visitors`, `activity_logs` | visitor row and activity log should commit together | Socket.IO emit and push notification after commit |
| visitor arrival or approval | `visitors`, `screen_logs`, `activity_logs` | active visitor switch, approval/arrival state, and screen log changes should commit together | Socket.IO, screen update emit, and push notification after commit |
| visitor reject, cancel, or checkout | `visitors`, `screen_logs`, `activity_logs` | visitor state transition and screen log closure should commit together | Socket.IO and screen update emit after commit |
| room reservation create | `room_reservations` | use either a retryable `SERIALIZABLE` transaction or a per-room PostgreSQL advisory lock before the overlap check and insert; a plain read-then-insert at default isolation is not sufficient | none |

For room reservations, `SELECT ... FOR UPDATE` by itself is not a complete strategy when no overlapping row exists yet. The implementation must prevent concurrent no-row cases from both passing the overlap check and inserting.

### 4.8 Known Legacy Couplings and Edge Cases
- `auth-service.js` and `personnel-service.js` contain legacy manager-name normalization behavior that must not disappear silently.
- `appointment-service.js` may derive `host_user_id` from `personnel.user_id` or by matching `users.full_name`; importer and Prisma refactor must preserve this behavior.
- `user-service.js` ensures that user records and personnel records stay synchronized; migrating `users` without `personnel` parity will create regressions.
- `visitor-service.js` and `screen-service.js` couple visitor status, active screen state, screen logs, activity logs, notifications, and Socket.IO events.
- Some entities are soft-deleted (`users`, `personnel`, `companies`) while others currently use hard deletes (`appointments`, `visitors`, `blacklist`, `contents`); the migration must preserve current route behavior unless explicitly redesigned.
- `contents` file-upload behavior includes filesystem cleanup when DB writes fail; database migration must not break this cleanup expectation.
- `contents` upload create flow currently depends on writing the file first, then inserting the `contents` row, then deleting the file if DB persistence fails; the PostgreSQL refactor must preserve this failure-path cleanup contract.
- `room-service.js` currently performs the room overlap check as a separate read followed by insert; the PostgreSQL migration must not preserve this race window under concurrent requests.
- `push_subscriptions.subscription` stores serialized JSON; migration must preserve payload fidelity so `endpoint`, `keys.p256dh`, and `keys.auth` survive write/read round trips.
- `weather` uses `system_settings.weather_city`, in-memory caching, external HTTP calls, and fallback offline payloads; this route is not just a simple DB read.
- `outlook` is explicitly non-blocking for this migration: preserve the current draft/mock behavior, keep `/login` returning `503` when Azure configuration is missing, keep `/sync` returning the current mock success payload when Azure configuration is missing, and do not introduce new token-storage tables in this migration. `/callback` currently performs `UPDATE users SET department = department || ' (Outlook Bağlı)' WHERE id = state`; preserve that exact side effect unless a separate design task replaces it.
- `logs.js` exposes CSV export from a route mounted under `/api/logs/export`; this route shape should be preserved even if the internal query implementation changes.
- Current tests enforce response ordering for users, appointments, and performance-sensitive list endpoints; query rewrites must preserve ordering semantics.

### 4.9 File Upload Atomicity Rule for `contents`
Filesystem writes cannot participate in a PostgreSQL transaction, so the migration must preserve atomic user-visible behavior by enforcing this sequence:

1. accept and validate the uploaded file through Multer
2. compute the final stored path deterministically
3. perform the Prisma DB insert or update in a transaction if more than one DB write is involved
4. if the Prisma write fails, call upload-file cleanup before sending the error response
5. return `201` only after the DB write succeeds

For delete flows, capture the DB row first, delete the row through Prisma, and if file cleanup fails afterward, log the cleanup failure explicitly for remediation.

---

## 5. Data Migration and Seed Strategy

### 5.1 Deterministic Import Path
Create a dedicated importer that reads from the current SQLite file `server/database.db` and writes to PostgreSQL in a deterministic order. The import sequence should preserve relationships and should generally follow this order:

1. `users`
2. `companies`
3. `personnel`
4. `rooms`
5. `system_settings`
6. `contents`
7. `blacklist`
8. `visitors`
9. `appointments`
10. `room_reservations`
11. `activity_logs`
12. `screen_logs`
13. `system_logs`
14. `push_subscriptions`

If explicit IDs are preserved during import, PostgreSQL sequences must be reset afterward.
The importer must log the imported `MAX(id)` per preserved-ID table and either issue explicit `setval(...)` statements or an equivalent reset step so the next generated ID is always greater than the current maximum.

### 5.2 Normalization Rules During Import
The importer and new seed flow must preserve practical cleanup behavior already present in the current project:

- convert `0`/`1` flags to booleans
- convert invalid sentinel values such as `user_id=0` to `NULL` where appropriate
- preserve or safely normalize historical timestamps
- preserve `host_user_id` derivation and linked personnel/user relationships
- preserve default `system_settings` and company dictionary expectations

### 5.3 Seed and Auto-Seed Behavior
The migration must preserve the operational meaning of:

- `npm run seed`
- `server/seed.js`
- `server/seed-auto.js`

If the implementation changes these entry points, `package.json` scripts and startup flow must be updated in a way that keeps the workflow obvious and deterministic.

### 5.3.1 Seed Idempotency Policy
- `npm run seed` must be safe to run more than once without creating duplicate demo or baseline rows.
- Use Prisma `upsert` where the seed record maps to a genuine unique key such as `users.username` or `companies.name`.
- Use deterministic existence checks where the current seed logic already depends on a logical key rather than a formal unique constraint.
- Use `createMany(..., { skipDuplicates: true })` only when the relevant PostgreSQL unique constraints actually exist.
- `server/seed-auto.js` may remain a bootstrap-only path for empty databases, but accidental reruns must not multiply rows in partially initialized environments.

### 5.4 Data Parity Checklist
Before declaring the import complete, verify parity with a checklist rather than a single row-count assertion.

| Check Type | Minimum Requirement | Notes |
| --- | --- | --- |
| table presence | every active SQLite table exists in PostgreSQL | includes `push_subscriptions`, `screen_logs`, and `system_logs` |
| row counts | PostgreSQL row count matches SQLite for each imported table | explain any intentional mismatch |
| sampled records | spot-check at least 3 records from high-risk tables | prioritize `users`, `personnel`, `visitors`, `appointments`, `system_settings` |
| boolean conversion | sampled flags match expected `true/false` semantics | verify `is_active`, `is_default`, `is_approved`, `is_screen_active` |
| foreign keys | sampled optional and non-optional relationships resolve correctly | include `host_personnel_id`, `host_user_id`, `user_id`, `company_id` |
| ordering-sensitive data | latest or ordered records still sort correctly | especially `visitors.created_at` and `appointments.planned_time` |
| sequence state | importer records each preserved-ID table `MAX(id)` and proves the next generated ID is higher | required when IDs are preserved, especially for `users`, `companies`, `personnel`, `visitors`, `appointments`, `rooms`, and `contents` |
| push subscription serialization | stored subscription JSON parses cleanly after import or rewrite | verify `endpoint`, `keys.p256dh`, and `keys.auth` survive without truncation or structural loss |
| settings fidelity | key settings such as `weather_city`, `company_name`, and logo paths remain intact | required for startup, favicon, and lobby behavior |

---

## 6. Validation and Test Plan

### 6.1 Automated Verification
`tests/api.integration.test.js` must be adapted to PostgreSQL-backed startup and must continue to validate the same functional areas, including:

- page reachability for `/`, `/panel`, `/yonetici`, and `/lobi`
- authentication and password-change behavior
- user and personnel flows
- visitor, appointment, room, company, blacklist, settings, and related CRUD behavior
- legacy timestamp conversion using fixed fixture values that represent SQLite `datetime('now','+3 hours')` style strings near date boundaries
- push subscription write/read smoke behavior for `POST /api/push/subscribe`
- local database isolation proving that `npm test` uses `TEST_DATABASE_URL` or equivalent test-only settings instead of silently reusing the development database
- the existing 400-record timed integration test, with `/api/users`, `/api/personnel`, `/api/visitors`, and `/api/appointments` each remaining below `2500ms` on low-end CI machines
- startup and seeded baseline behavior

The success condition is that the full `npm test` suite passes against PostgreSQL.

### 6.2 Manual Verification
Before removing fallback logic, perform a manual parity check for:

- login and role-based navigation
- lobby screen behavior and current screen content flow
- favicon/logo behavior driven by `system_settings`
- visitor lifecycle transitions such as waiting, inside, and left
- critical admin panel pages that depend on unchanged response shapes

### 6.3 Phase Exit Criteria
Each major phase should have a clear exit condition before the next phase begins:

- Environment phase exits only when PostgreSQL is reachable and Prisma can connect.
- Schema phase exits only when the schema models all active SQLite tables and migrations apply cleanly.
- Import phase exits only when imported row counts and key spot checks match SQLite.
- Refactor phase exits only when migrated route groups pass tests and preserve response compatibility.
- Cutover phase exits only when automated and manual validation are both complete.

### 6.4 Acceptance Matrix
Use this matrix to evaluate completion objectively:

| Area | Evidence Required | Pass Condition |
| --- | --- | --- |
| PostgreSQL runtime | running container and successful connection | database is reachable |
| CI test runtime | checked-in workflow service block or test-only compose file plus passing job output | PostgreSQL-backed tests pass in a clean CI environment without local Docker assumptions |
| Local test isolation | `.env.test` or `TEST_DATABASE_URL` configuration plus a passing isolated run | `npm test` cannot silently reuse the development database |
| Observability | query-duration logging path, pool-saturation observation point, and PostgreSQL slow-query threshold notes | query timing and slow-query evidence can be captured during validation and early cutover |
| Secret management | checked-in env templates plus CI/staging/production secret-injection notes | real credentials are injected from a secret store rather than committed to the repo |
| Prisma schema | schema file plus applied migrations | all required tables and constraints exist |
| Importer | import run log and spot-checked records | imported data matches expected source data |
| Sequence state | importer audit plus post-import insert proof or explicit sequence audit | no preserved-ID table can generate a colliding ID |
| Timestamp conversion | dedicated test output plus sampled imported records | no double offset or calendar-day drift is observed |
| Performance baseline | timed integration test output on the 400-record fixture | `/api/users`, `/api/personnel`, `/api/visitors`, and `/api/appointments` each stay under `2500ms` on low-end CI |
| Backend routes | route responses and tests | response shapes remain compatible |
| Push subscriptions | smoke-test result plus sampled stored JSON | subscription payload round-trips without corruption |
| Seeds | successful seed or auto-seed flow | default users/settings/data are present |
| Integration tests | `npm test` result | all relevant tests pass |
| Manual parity | human verification checklist | critical screens and flows behave correctly |
| Cutover strategy | staging rehearsal notes and a production runbook | first production cutover assumes a planned maintenance or read-only window and names rollback trigger points |
| Rollback readiness | documented rollback rehearsal with elapsed time | SQLite fallback is restored and smoke-checked within the target RTO |

### 6.5 Exact Validation Commands and Expected Signals
Use concrete commands and explicit success signals instead of generic instructions such as "verify it works".

| Phase | Command | Expected Success Signal | If It Fails, Inspect |
| --- | --- | --- | --- |
| PostgreSQL runtime | `docker compose ps` | PostgreSQL service is `running` or `healthy` | compose file, env vars, port conflicts |
| Prisma connectivity | `npx prisma validate` | schema validates without errors | schema syntax, mappings, datasource env |
| Migration state | `npx prisma migrate status` | database is up to date or migration history is consistent | migration SQL, drift, wrong database target |
| Prisma client generation | `npx prisma generate` | client generated successfully | schema syntax, package install state |
| Local test isolation | `npm test` with `TEST_DATABASE_URL` pointed at the isolated test database and the development `DATABASE_URL` kept distinct | tests pass and no development database is modified | test env loading order, bootstrap DSN selection, cleanup logic |
| Observability check | app boot in a diagnostic mode for migration validation | Prisma query timing is observable, PostgreSQL slow-query logging is enabled at the chosen threshold, and pool timeout symptoms are visible | Prisma logging hook, redaction policy, PostgreSQL config, connection pressure signs |
| Importer | custom import command for this repo | importer ends without rejected rows, orphan failures, or sequence-reset verification errors | field mappings, FK order, null handling, sequence reset logic |
| Timestamp conversion tests | `npm test` | dedicated legacy timestamp cases pass without offset drift around boundary fixtures | importer parser, timezone assumption, Prisma readback |
| Performance baseline | `npm test` | the 400-record timed integration assertions pass with each covered endpoint under `2500ms` | missing indexes, N+1 reads, ordering/sort regressions, expensive count queries |
| Push subscription smoke test | `npm test` | `POST /api/push/subscribe` smoke coverage passes and stored JSON parses cleanly | JSON serialization, auth context, unique constraint behavior |
| Seed flow | `npm run seed` | process exits successfully and baseline data exists | seed assumptions, default company/user linkage |
| Automated tests | `npm test` | test process exits with all tests passing | most recently changed route group or bootstrap path |
| Manual app boot | `npm start` or equivalent project start command | login page, panel, and lobby load without DB errors | startup bootstrap, favicon lookup, settings reads |

### 6.6 Definition of Evidence
For this migration, a phase is not complete unless evidence can be shown. Acceptable evidence includes:

- successful command output for validation commands
- CI job output showing PostgreSQL service startup and a passing clean-environment test run
- local isolated test output showing the test database configuration is distinct from the development database
- query-duration sample logs and PostgreSQL slow-query evidence from the validation environment
- pool-saturation observation notes such as connection counts or connection-acquisition timeout evidence
- secret-injection notes showing how CI and deployed environments source real credentials
- migration status output showing applied migrations
- importer summary with row counts per table
- sequence-reset audit showing `MAX(id)` and the next generated value for preserved-ID tables
- timestamp-conversion test output for fixed legacy fixture values
- performance-test output showing the four timed list endpoints remain below the accepted threshold
- push-subscription smoke-test output and a sampled stored JSON payload
- small parity notes showing sampled record matches
- test results tied to the modified route group
- rollback rehearsal notes showing elapsed time from rollback trigger to restored SQLite smoke-check
- manual checklist notes for UI and runtime parity

Evidence should be attached or summarized per phase, not only at the end of the full migration.

---

## 7. Risks, Rollback, and Cleanup Rules

### 7.1 Main Migration Risks
- timestamp and timezone drift between SQLite text values and PostgreSQL timestamps
- boolean conversion mistakes from `0`/`1` values
- nullable foreign-key mismatches
- missed indexes causing slower list endpoints
- room reservation overlap races causing double-booking if transaction isolation or locking is too weak
- local test runs accidentally pointing at the development database and corrupting verification data
- insufficient query and pool observability hiding slow-query or saturation regressions until after cutover
- untuned Prisma connection settings causing pool exhaustion or unexpected timeout behavior under load
- unpinned Prisma versions causing client, migration, or engine drift across environments
- file-upload cleanup regressions leaving orphaned media files when DB writes fail
- secret misconfiguration in CI, staging, or production preventing the correct database from being selected
- seed assumptions differing from imported production-like data

### 7.2 Rollback Rule
Do not delete SQLite support immediately. Keep the current SQLite database file and a recoverable provider path until all validation steps pass. Rollback must mean the application can still be started against the known-good SQLite source while PostgreSQL issues are fixed.

### 7.3 Cleanup Rule
Only after PostgreSQL parity is proven may the project remove obsolete SQLite-only code paths, temporary import helpers, and transitional fallback logic.

### 7.4 Rollback Runbook
Rollback must be explicit, fast, and evidence-based.

#### Rollback Triggers
- importer produces unreconciled row-count mismatches
- authentication or core CRUD flows fail after a route-group migration
- `npm test` fails with migration regressions that are not immediately isolated
- lobby, screen, favicon, or settings behavior regresses in manual checks
- startup fails because Prisma bootstrap or environment wiring is incomplete

#### Rollback Procedure
1. stop treating PostgreSQL as the active provider for the current validation cycle
2. restore the known-good SQLite-backed startup path
3. keep the PostgreSQL database for forensic inspection rather than deleting it immediately
4. capture the failing command output, affected route group, and last edited files
5. revert or isolate only the recent migration step instead of discarding unrelated validated work
6. rerun the SQLite-backed baseline checks before attempting the next PostgreSQL iteration

#### Rollback Evidence to Capture
- failing command output or stack trace
- last successful phase and current failing phase
- impacted route(s) and model(s)
- whether data import, seed, or runtime bootstrap is implicated
- whether the failure is deterministic or intermittent

### 7.5 Recovery Time Objective (RTO)
For the first PostgreSQL cutover, the target RTO for returning to the SQLite-backed application is **15 minutes or less** from the moment a rollback trigger is declared to the moment smoke checks pass again on the restored SQLite path.

- If a rehearsal exceeds 15 minutes, do not approve production cutover.
- Measure the elapsed time during at least one rollback rehearsal before any production cutover decision.
- The minimum rollback smoke check should cover application boot, `/api/auth/login`, `/api/users?limit=1&offset=0`, `/api/visitors?date=today&limit=1`, and `/lobi`.

### 7.6 Staging and Production Cutover Guidance
This plan currently assumes local and CI validation first. If the system is promoted beyond that, the first production cutover should follow a conservative pattern.

- Run at least one staging rehearsal with production-like configuration, injected secrets, and representative data volume before production approval.
- Unless a separate design adds blue/green, dual-write, or feature-flagged provider switching, assume the first production cutover requires a planned maintenance or read-only window.
- Before cutover, prepare a final SQLite backup, confirm migrations are applied, confirm observability is enabled, and assign an owner for rollback authority.
- After switching runtime configuration to PostgreSQL, run the smoke-check set immediately and hold the maintenance window open until pass/fail is declared.
- If smoke checks fail or slow-query / pool-saturation signals exceed tolerance, trigger rollback immediately rather than debugging live on the cutover path.

---

## 8. Deliverables and Acceptance Criteria

### 8.1 Required Deliverables
- `docker-compose.yml` for PostgreSQL
- CI workflow service block and/or `docker-compose.test.yml` definition for PostgreSQL-backed tests
- `.env.example` and, if the test harness uses a separate file, `.env.test.example`
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `server/prisma.js`
- importer script from SQLite to PostgreSQL
- updated seed/bootstrap flow
- updated integration test support for PostgreSQL
- `package.json` and lockfile updates that pin `prisma` and `@prisma/client` to the same exact version
- runtime configuration notes for `DATABASE_URL`, `DIRECT_URL`, and pool-related parameters
- observability notes covering Prisma query timing, slow-query logging, and pool-saturation monitoring
- secret-injection notes for CI, staging, and production
- staging and first-production cutover runbook
- brief rollback notes for operating the app on SQLite until cutover is accepted

### 8.2 Definition of Done
- No frontend files need behavioral changes for the migration to work.
- All database-backed backend behavior required by the current tests is preserved.
- The full Prisma schema reflects the real tables in `server/database.js`.
- Imported data is readable and writable in PostgreSQL without contract regressions.
- Local `npm test` runs use a dedicated test database and cannot silently reuse the development database.
- PostgreSQL-backed tests run successfully in a clean CI job, not only on a local developer machine.
- The 400-record timed integration checks keep `/api/users`, `/api/personnel`, `/api/visitors`, and `/api/appointments` under `2500ms` on low-end CI.
- Query timing, slow-query visibility, and pool-saturation observation are enabled for migration validation and first cutover.
- `npm run seed` is idempotent and safe to rerun for baseline/demo data creation.
- `npm test` passes on the PostgreSQL-backed application.
- A rollback rehearsal proves the SQLite fallback can be restored within the 15-minute RTO target.
- A staging rehearsal and first-cutover runbook exist for any environment beyond local/CI validation.
- Manual verification confirms that the critical screens and flows still behave correctly.

### 8.3 Expected Artifacts Per Phase
The migration should leave behind explicit artifacts after each major phase.

| Phase | Expected Artifacts |
| --- | --- |
| environment setup | `docker-compose.yml`, `docker-compose.test.yml` or equivalent, updated `.env`, `.env.example`, optional `.env.test.example`, CI PostgreSQL service definition, Prisma initialization files |
| schema modeling | `prisma/schema.prisma`, generated Prisma client, migration files |
| importer implementation | importer script, import summary, row-count comparison notes, sequence-reset audit |
| seed/bootstrap adaptation | updated seed/bootstrap code, successful seed output, isolated test database wiring, seed idempotency notes |
| route/service refactor | scoped code diff for one route group, relevant passing tests, response compatibility notes |
| final validation | acceptance checklist, test result summary, performance evidence, observability evidence, rollback rehearsal notes, cutover runbook, cleanup decision |

---

## 9. Execution Protocol for Lower-Capability LLMs

This section is intentionally explicit so a lower-capability model can implement the migration with less ambiguity and fewer unsafe assumptions.

### 9.1 Operating Rules
- Read the target files before editing them.
- Change as few files as possible per step.
- Prefer one logical milestone per patch.
- Never invent table names, field names, route names, or response keys.
- Do not rewrite the whole backend in one pass.
- Do not delete SQLite support until tests and manual checks pass.
- When unsure, inspect existing route behavior and test expectations before editing.
- At each safe checkpoint, stop and emit the session handoff format defined later in section `9.4A` before continuing into the next major milestone.

### 9.2 Mandatory Step Breakdown
Execute the migration in these small steps:

1. inspect `server/database.js` and list every table, index, and default behavior
2. inspect `server/index.js`, `server/routes/*`, `server/services/*`, `server/seed.js`, `server/seed-auto.js`, and `tests/api.integration.test.js`
3. create `docker-compose.yml` and PostgreSQL environment variables
4. initialize Prisma and create `prisma/schema.prisma`
5. create and apply Prisma migrations
6. create `server/prisma.js`
7. create the SQLite-to-PostgreSQL importer
8. validate import counts and a small set of high-risk records
9. adapt seed/bootstrap logic
10. migrate one backend module group at a time
11. run tests after each module group
12. remove transitional logic only after full validation

After steps 3, 5, 8, and 9, and after each completed route-group iteration inside step 10, the executing model should treat the result as a preferred safe checkpoint and emit the section `9.4A` handoff before continuing.

### 9.3 Recommended Module Groups
For weaker models, migrate in this order instead of choosing randomly:

1. infrastructure files: Prisma config, client, startup bootstrap
2. authentication and user management
3. personnel and companies
4. visitors and appointments
5. rooms, blacklist, settings, and logs
6. screen-related flows and push-related flows
7. final cleanup and fallback reduction

### 9.4 Required Output Format Per Step
After each implementation step, the executing model should report results in this format:

- Objective
- Files read
- Files changed
- Validation performed
- Result
- Next step

This prevents large invisible jumps and makes reviews easier.

### 9.4A Session Handoff Protocol for Context-Window Safety
To avoid context-window degradation during a long migration, the executing model should stop at safe checkpoints and prepare a clean handoff for the next session instead of continuing until context quality drops.

At each safe checkpoint, the model should pause before starting the next milestone and report using this format:

- Completed step: `<one sentence>`
- Files changed: `<list>`
- Validation status: `<tests/checks passed, failed, or not run>`
- Risks or open questions: `<1-2 short items, or "none">`
- First objective for the next session: `<one concrete target>`
- Summary to paste into the next session: `<short context handoff>`

The final line of the handoff message must always be exactly:

`Now switch to a new session.`

This handoff should be emitted only when all of the following are true:

- the current step is complete within its own boundary
- the codebase is left in a runnable or recoverable state
- rollback or safe continuation is clear
- the next step would benefit from a fresh context window

The model should not emit this handoff in the middle of unfinished work. Each checkpoint summary should be short, specific, and non-repetitive.

### 9.5 Stop Conditions
The executing model must stop and inspect further instead of guessing when any of the following happen:

- a route response shape is unclear
- a field exists in SQLite but not yet in Prisma
- test failures do not clearly point to the modified module
- imported row counts do not match expectations
- a relationship appears to use sentinel values such as `0` or empty strings
- a multi-step business action spans visitors, screen state, notifications, and logs

### 9.6 Safe Default Decisions
If the model must choose between two approaches and both seem plausible, prefer these defaults:

- preserve existing snake_case database names through mappings
- preserve nullable relationships rather than forcing non-null constraints too early
- preserve response shape compatibility over internal elegance
- preserve explicit ordering from legacy SQL queries when known
- preserve fallback capability until acceptance criteria are met

### 9.7 Anti-Patterns to Avoid
- Do not migrate every route in a single edit.
- Do not replace the entire seed system before importer behavior is proven.
- Do not use `db push` as the only migration history for the final result.
- Do not silently rename fields because Prisma naming looks cleaner.
- Do not remove tests that fail due to migration regressions.
- Do not assume that passing one route means the whole backend is correct.

### 9.8 Phase Task Cards
Use these task cards if the migration is being executed by a weaker model that benefits from a highly repetitive workflow.

#### Phase Card A: Environment Setup
- Input: `package.json`, `.env`, project root, Docker availability
- Allowed Changes: `docker-compose.yml`, environment variable additions, Prisma dependency additions
- Required Output: PostgreSQL container definition, Prisma initialization, confirmed connection settings
- Validation: database container starts and Prisma can connect
- Stop If: environment variables are unclear or Docker is unavailable

#### Phase Card B: Schema Modeling
- Input: `server/database.js`
- Allowed Changes: `prisma/schema.prisma`, migration files
- Required Output: one Prisma schema that covers all active tables, mappings, and constraints
- Validation: schema validates, migrations apply, required tables exist
- Stop If: a SQLite field type or relationship is ambiguous

#### Phase Card C: Importer Implementation
- Input: `server/database.db`, `server/database.js`, Prisma schema
- Allowed Changes: importer script and related utility code only
- Required Output: deterministic import process plus sequence reset if IDs are preserved
- Validation: row counts match and high-risk tables are spot-checked
- Stop If: row count mismatches occur or foreign-key relationships do not reconcile

#### Phase Card D: Seed and Bootstrap Adaptation
- Input: `server/seed.js`, `server/seed-auto.js`, `server/index.js`, `package.json`
- Allowed Changes: seed/bootstrap logic and scripts only
- Required Output: PostgreSQL-compatible seed and startup behavior
- Validation: seed runs, app boots, baseline users/settings exist
- Stop If: seeded data diverges from expected defaults

#### Phase Card E: Auth and User Management Migration
- Input: `server/routes/auth.js`, `server/routes/users.js`, `server/middleware/auth.js`, `server/services/auth-service.js`, `server/services/user-service.js`, `tests/api.integration.test.js`
- Allowed Changes: only these files and directly required shared database provider files
- Required Output: Prisma-backed implementation with unchanged external contract
- Validation: relevant auth/user tests
- Stop If: response shape uncertainty appears or a transaction boundary is unclear

#### Phase Card E2: Personnel and Companies Migration
- Input: `server/routes/personnel.js`, `server/routes/companies.js`, `server/services/personnel-service.js`, `tests/api.integration.test.js`
- Allowed Changes: only these files and directly required shared database provider files
- Required Output: Prisma-backed implementation with unchanged external contract
- Validation: personnel tests
- Stop If: response shape uncertainty appears or a transaction boundary is unclear

#### Phase Card F: Visitors and Appointments Migration
- Input: `server/routes/visitors.js`, `server/routes/appointments.js`, `server/services/visitor-service.js`, `server/services/appointment-service.js`, `server/services/screen-service.js`, `tests/api.integration.test.js`
- Allowed Changes: only these files and directly required shared provider files
- Required Output: Prisma-backed implementation with unchanged external contract
- Validation: visitor and appointment tests
- Stop If: response shape uncertainty appears or a transaction boundary is unclear

#### Phase Card F2: Contents and Media Migration
- Input: `server/routes/contents.js`, `server/services/content-service.js`, `tests/api.integration.test.js`
- Allowed Changes: only these files and directly required shared database provider files
- Required Output: Prisma-backed implementation with unchanged external contract
- Validation: contents tests
- Stop If: response shape uncertainty appears or a transaction boundary is unclear

#### Phase Card G: Final Cleanup and Fallback Reduction
- Input: all remaining files and routes
- Allowed Changes: only transitional fallback logic and obsolete SQLite-only code paths
- Required Output: cleaned-up codebase with reduced fallback logic
- Validation: all tests pass, manual parity checks pass
- Stop If: any test or parity check fails

### 9.9 Reusable Execution Prompt Template
If this document is given to a lower-capability LLM, pair it with an instruction block in this form:

```text
You are implementing the PostgreSQL migration for this repository.

Rules:
1. Read the referenced files before editing.
2. Make only the smallest necessary change for the current phase.
3. Do not change frontend behavior, route URLs, JSON keys, or Socket.IO event names.
4. Do not delete SQLite support until validation is complete.
5. After each step, report: Objective, Files read, Files changed, Validation performed, Result, Next step.
6. If any schema, relationship, or response shape is unclear, stop and inspect rather than guessing.
7. At every safe checkpoint, emit the section 9.4A handoff and end with the exact line: Now switch to a new session.

Current phase: [fill in one phase card from section 9.8]
Current files to inspect first: [fill in exact file list]
Current allowed files to edit: [fill in exact file list]
Validation required before continuing: [fill in exact checks]
```

This reduces ambiguity and makes the migration more likely to succeed when the executor is not strong at long-range planning.

### 9.10 Allowed and Forbidden Files by Phase
Use this table when the executing model needs stricter guardrails than the generic prompt can provide.

| Phase | Preferred Editable Files | Files That Should Normally Not Be Edited During This Phase |
| --- | --- | --- |
| environment setup | `docker-compose.yml`, `.env`, `package.json`, Prisma init output | route files, service files, tests, frontend files |
| schema modeling | `prisma/schema.prisma`, `prisma/migrations/*` | route files, frontend files, unrelated seed logic |
| importer implementation | importer script, importer utilities | route files, frontend files, permission logic |
| seed/bootstrap adaptation | `server/seed.js`, `server/seed-auto.js`, `server/index.js`, `package.json` | most route files unless bootstrap changes force a minimal touch |
| auth/users migration | `server/routes/auth.js`, `server/routes/users.js`, `server/middleware/auth.js`, `server/services/auth-service.js`, `server/services/user-service.js` | visitors, appointments, rooms, contents, frontend files |
| personnel/companies migration | `server/routes/personnel.js`, `server/routes/companies.js`, `server/services/personnel-service.js` | unrelated route groups and frontend files |
| visitors/appointments migration | `server/routes/visitors.js`, `server/routes/appointments.js`, `server/services/visitor-service.js`, `server/services/appointment-service.js`, `server/services/screen-service.js` | users/auth routes unless a shared helper truly requires an edit |
| rooms/logs/settings/screen/push migration | the selected route group plus directly related services | unrelated route groups and frontend files |
| final cleanup | only validated transitional fallback files | schema, tests, and stable route groups unless cleanup is explicitly required |

### 9.11 Patch Budget Rules
To reduce regression risk, a lower-capability model should obey the following patch limits:

- change only one major route group per implementation step
- prefer changing no more than 3 to 5 files in one patch unless the phase is schema-only
- run validation after every route-group change
- do not combine schema creation, importer work, and route refactors in the same patch
- do not combine unrelated route groups in the same patch
- stop and summarize when a patch would otherwise exceed the current phase boundary

### 9.12 Phase-Specific Prompt Pack
These prompts can be copied directly for weaker execution models.

#### Prompt A: Environment Setup
```text
Implement only the environment setup phase for the PostgreSQL migration.

Read first:
- package.json
- .env
- postgres-migration-plan-EN.md

You may edit only:
- docker-compose.yml
- package.json
- .env
- Prisma initialization files created for setup

Do not edit route files, service files, tests, or frontend files.
Validation required:
- docker compose ps
- npx prisma validate
Report: Objective, Files read, Files changed, Validation performed, Result, Next step.
```

#### Prompt B: Schema Modeling
```text
Implement only the Prisma schema modeling phase.

Read first:
- server/database.js
- postgres-migration-plan-EN.md

You may edit only:
- prisma/schema.prisma
- prisma/migrations/*

Do not edit routes, services, tests, or frontend files.
Preserve snake_case names using Prisma mapping.
Validation required:
- npx prisma validate
- npx prisma migrate status
Report: Objective, Files read, Files changed, Validation performed, Result, Next step.
```

#### Prompt C: Importer Implementation
```text
Implement only the SQLite-to-PostgreSQL importer phase.

Read first:
- server/database.js
- server/database.db
- prisma/schema.prisma
- postgres-migration-plan-EN.md

You may edit only:
- importer script files
- small importer utility files

Do not edit route files, service files, tests, or frontend files.
Validation required:
- importer completes
- row counts and sampled records match expectations
Report: Objective, Files read, Files changed, Validation performed, Result, Next step.
```

#### Prompt D: Seed and Bootstrap Adaptation
```text
Implement only the seed and startup bootstrap adaptation phase.

Read first:
- server/index.js
- server/seed.js
- server/seed-auto.js
- package.json
- postgres-migration-plan-EN.md

You may edit only:
- server/index.js
- server/seed.js
- server/seed-auto.js
- package.json

Do not edit frontend files or unrelated route groups.
Validation required:
- npm run seed
- application boot succeeds
Report: Objective, Files read, Files changed, Validation performed, Result, Next step.
```

#### Prompt E: Auth and User Management Migration
```text
Implement only the auth and user-management migration phase.

Read first:
- server/routes/auth.js
- server/routes/users.js
- server/middleware/auth.js
- server/services/auth-service.js
- server/services/user-service.js
- tests/api.integration.test.js
- postgres-migration-plan-EN.md

You may edit only these files and directly required shared database provider files.
Do not edit visitors, appointments, rooms, contents, or frontend files.
Validation required:
- relevant auth/user tests
- npm test if uncertainty remains
Report: Objective, Files read, Files changed, Validation performed, Result, Next step.
```

#### Prompt E2: Personnel and Companies Migration
```text
Implement only the personnel and companies migration phase.

Read first:
- server/routes/personnel.js
- server/routes/companies.js
- server/services/personnel-service.js
- tests/api.integration.test.js
- postgres-migration-plan-EN.md

You may edit only these files and directly required shared database provider files.
Do not edit visitors, appointments, rooms, contents, or frontend files.
Preserve company default behavior, soft-delete behavior, and personnel autocomplete compatibility.
Validation required:
- personnel tests
- company tests
- autocomplete-related personnel checks
Report: Objective, Files read, Files changed, Validation performed, Result, Next step.
```

#### Prompt F: Visitors and Appointments Migration
```text
Implement only the visitors and appointments migration phase.

Read first:
- server/routes/visitors.js
- server/routes/appointments.js
- server/services/visitor-service.js
- server/services/appointment-service.js
- server/services/screen-service.js
- tests/api.integration.test.js
- postgres-migration-plan-EN.md

You may edit only these files and directly required shared provider files.
Do not edit unrelated route groups or frontend files.
Preserve response shape, ordering, screen updates, notifications, and host resolution behavior.
Validation required:
- visitor and appointment tests
- related screen/log spot checks
Report: Objective, Files read, Files changed, Validation performed, Result, Next step.
```

#### Prompt F2: Contents and Media Migration
```text
Implement only the contents and media migration phase.

Read first:
- server/routes/contents.js
- server/services/content-service.js
- tests/api.integration.test.js
- postgres-migration-plan-EN.md

You may edit only these files and directly required shared database provider files.
Do not edit unrelated route groups or frontend files.
Preserve upload-path behavior, file cleanup behavior, content ordering, and public file-path compatibility.
Validation required:
- contents tests
- manual upload and delete spot checks if file behavior changes
Report: Objective, Files read, Files changed, Validation performed, Result, Next step.
```

#### Prompt F3: Support and Admin Route Migration
```text
Implement only one selected support/admin route group from this set: rooms, blacklist, settings, logs, screen, push, weather, or outlook.

Read first:
- the selected route file
- any directly related service files
- relevant sections of tests/api.integration.test.js
- postgres-migration-plan-EN.md

You may edit only the selected route group, directly related services, and shared provider files.
Do not edit unrelated route groups or frontend files.
Preserve response shape, role checks, ordering, and any external/mock behavior.
Validation required:
- relevant integration tests if they exist
- otherwise manual verification plus targeted smoke checks
Report: Objective, Files read, Files changed, Validation performed, Result, Next step.
```

#### Prompt G: Final Validation and Cleanup
```text
Implement only the final validation and cleanup phase.

Read first:
- postgres-migration-plan-EN.md
- validation outputs from previous phases
- current fallback and bootstrap files

You may edit only validated transitional fallback files that are explicitly ready for cleanup.
Do not delete anything unless the acceptance matrix is already satisfied.
Validation required:
- full npm test
- acceptance checklist
- manual parity notes
Report: Objective, Files read, Files changed, Validation performed, Result, Next step.
```
