# Manual Validation Checklist (Phase 2)

Please run through these checks to rigorously validate all the new features we implemented during this phase.

## 1. Authentication & Registration
- [ ] **OTP Pre-registration:** Register a new user and ensure an OTP is sent to the provided email.
- [ ] **OTP Single-Use:** Ensure the same OTP cannot be reused once validated.
- [ ] **MIS ID Validation:** Ensure invalid MIS IDs (e.g., wrong length, wrong prefix, invalid branch codes) are correctly rejected during registration.
- [ ] **Deactivated User UI:** Log in with a deactivated account and verify it shows the dedicated "Account Suspended" screen with admin contacts, instead of a generic error.
- [ ] **Session Persistence:** Log in, refresh the page, and confirm your session persists without needing to re-authenticate.

## 2. Roles & Permissions
- [ ] **Role Requests:** Register requesting an Admin or Student role. Verify the dashboard displays an amber banner ("Your request for XYZ role is pending admin approval").
- [ ] **Viewer Restrictions:** As a Viewer, confirm you cannot create or edit materials, catalogs, or locations.
- [ ] **Student Permissions:** As a Student, confirm you *can* create catalogs, edit location statuses, and manage materials.
- [ ] **Add Material Button:** As an Admin, log in and verify the "Add Material" button appears on the Materials page.

## 3. Catalog & Deletion Requests
- [ ] **Catalog Creation:** Ensure adding a new asset definition with an existing SKU correctly throws a validation error instead of a server crash (P2002 fix).
- [ ] **Phantom Deletion Requests:** Create a deletion request for a catalog item, then log in as an Admin and *directly* delete the catalog item. Ensure the pending deletion request disappears from the Deletion Requests queue.

## 4. Profile & UI Updates
- [ ] **MIS Extrapolation:** Verify the Profile page extrapolates the Degree, Expected Graduation Year, and Branch correctly based on the MIS ID prefix (e.g., `612015001` -> B.Tech in Computer Science).
- [ ] **Admin Approvals Tab:** Log in as an Admin and view the "Students" tab in the Approvals section. Confirm the new columns (WhatsApp, Subsystem, Team Role) render correctly.
- [ ] **Locations Status:** View a location and change its status between Open, Closed, and Locked. Ensure the UI updates immediately.

## 5. Deployment / Builds
- [ ] **Production Build:** Run `pnpm build` in the root folder and ensure both backend and frontend compile without TS errors.
