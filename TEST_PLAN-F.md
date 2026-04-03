# Digital Visitor System - Comprehensive Test Plan & Roadmap

## Part 1: Comprehensive Test Plan

This test plan is divided into logical modules covering both API integration and End-to-End (E2E) UI flows.

### 1. Authentication & Authorization
*   **Login Flow:** Verify valid credentials generate a JWT and store `vd_token`, `vd_user`, and `vd_role` in `sessionStorage`. Verify invalid credentials return a 401.
*   **Role-Based Redirection:** Verify that logging in successfully redirects users to the correct panels:
    *   Admin/Secretary -> `/panel`
    *   Manager -> `/yonetici`
    *   Personnel -> `/personel.html`
*   **Session Management:** Verify that an expired or tampered JWT redirects the user back to `/login`. Verify the `logout` function clears the session and invalidates the token.
*   **Password Management:** Verify users can change their own password and that it adheres to the system's password policy.

### 2. User & Personnel Management
*   **Creation & Linking:** Verify that creating a user (especially with the `personnel` role) correctly invokes `syncPersonnelCompanyForUser` and links the `user_id` to the personnel record.
*   **Role Constraints:** Verify that the Secretary role can only create/update `secretary` or `personnel` roles and is blocked from modifying `admin` or `manager` roles.
*   **Soft Deletion:** Verify that deleting a user or personnel sets `is_active=0` rather than hard-deleting the row, and that they immediately disappear from the active UI lists.

### 3. Core Visitor Lifecycle & Host Notifications
*   **Fast Check-in (Secretary):** Verify that searching for a host auto-populates suggestions. Verify that submitting the form creates a visitor with status `waiting`.
*   **Blacklist Gate:** Try checking in a visitor with a TC ID that exists on the Blacklist. Verify the system blocks the creation.
*   **Targeted Socket Notifications:**
    *   When a visitor is created, verify `visitor:waiting` is emitted and *only* the specific host (`host_user_id`) receives the doorbell/toast on their panel.
*   **Approval Flow (Manager/Personnel):** Verify that a host can approve or reject a waiting visitor. Verify that a rejection sets the status to `cancelled` and emits `visitor:rejected` with the rejection reason.
*   **Arrival & Lobby Update:** Verify that marking a visitor as `arrived` updates their status to `inside`, sets `is_screen_active=1`, and emits `screen:update`.
*   **Checkout:** Verify that checking out a visitor sets their status to `left`, records the `checkout_time`, clears the `is_screen_active` flag, and emits `visitor:checkout`.

### 4. The Lobby Screen (`/lobi`)
*   **Polling & Socket Reactivity:** Verify that the screen polls `/api/screen/current` on load, and instantly refreshes when receiving a `screen:update` socket event.
*   **State Display:**
    *   *State A (Active Visitor):* Verify that if an active `inside` visitor exists, the screen shows the welcome layout with the visitor's Host Name and Host Company Name.
    *   *State B (Idle):* Verify that if no active visitors exist, it falls back to the default company branding and media playback.
*   **Media Cycle:** Verify that uploaded videos/images play in the correct `display_order` and respect the system layout settings.

### 5. Appointments & Room Reservations
*   **Appointment CRUD:** Verify creation, updating, and cancellation of appointments. 
*   **Appointment Check-In Shortcut:** Verify that checking in an appointment creates a new visitor record and automatically cancels the original appointment.
*   **Room Conflicts:** Verify that attempting to reserve a room for a time slot that overlaps with an existing active reservation returns a conflict error. Verify successful reservations show up across all role panels.

### 6. System Settings & Logs
*   **Company Management:** Verify creating, updating, and soft-deleting companies. Verify that deleting the *last* active company or the *default* company is blocked by the backend guards.
*   **CSV Exports:** Verify that the `/api/logs/export` endpoint downloads a properly formatted CSV file containing visitor history with BOM encoding for Excel compatibility.
*   **System Logs:** Verify that errors and global events are properly captured in the `system_logs` table.

---

## Part 2: Missing Components & What Needs to be Added

Based on the technical debt register and test coverage gaps identified in the system documentation, here are the missing components and architectural improvements that need to be implemented.

### 1. Missing Test Automation (Critical Additions)
*   **Socket.IO Test Harness:** Add deterministic testing for WebSockets. We need to automatically verify that `visitor:waiting` and `screen:update` payloads have the correct schema and trigger exactly when expected.
*   **End-to-End (E2E) UI Tests:** Implement Cypress or Playwright tests to navigate the actual browser DOM. specifically testing the role-redirect logic on the `login.html` page and the dynamic UI updates on the `personel.html` panel.
*   **Race Condition Tests:** Write a concurrency test simulating two secretaries checking in different visitors at the exact same millisecond to ensure the single-active-screen invariant (`is_screen_active=1`) is preserved in the Lobby.

### 2. Missing Backend Infrastructure & Features
*   **Atomic Appointment-to-Visitor Endpoint:** A dedicated backend endpoint (e.g., `POST /api/appointments/:id/checkin`) that wraps both actions in a single SQLite transaction to prevent partial failures.
*   **Content Upload Resilience:** Stricter MIME type validation, file size limits, and a cleanup mechanism that deletes the physical file from `/uploads/` if the database `INSERT` into the `contents` table fails.
*   **System Health Endpoint:** A `/api/health` endpoint that checks DB connectivity and the writability of the `UPLOAD_PATH`.

### 3. Security & Permission Hardening
*   **Strict Role Allow-lists:** Refactor `server/middleware/auth.js` to use explicit role allow-lists (e.g., `requireRole(['admin', 'manager'])`) instead of just blocking the `secretary` role, which inadvertently gives the `personnel` role admin-like privileges on some endpoints.
*   **Socket Payload Validation:** Schema validation for socket payloads before emitting them to clients.

### 4. Frontend Technical Debt Resolution
*   **Refactoring `app.js`:** The Secretary controller is massive. It needs to be split into domain-specific ES modules (e.g., `visitorController.js`, `settingsController.js`, `roomsController.js`).
*   **Namespace Collisions:** Functions like `showModal()` and `closeModal()` exist identically in multiple files. These need to be abstracted into a shared UI utility class.
*   **Legacy Code Cleanup:** The `index.html`, `app.js`, and `db.js` files located in the root directory are causing onboarding confusion and should be deleted or moved to a `/legacy` folder.