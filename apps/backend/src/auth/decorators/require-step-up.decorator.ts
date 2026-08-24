import { SetMetadata } from '@nestjs/common';

// TDS §12.3 — the closed list of routes behind fresh re-authentication:
// role/permission changes, user deactivation/deletion, security-setting
// changes, hard delete, and large reconciliation adjustments. Applying
// this decorator is how a route joins that list; StepUpGuard enforces it.
export const REQUIRE_STEP_UP_KEY = 'requireStepUp';
export const RequireStepUp = () => SetMetadata(REQUIRE_STEP_UP_KEY, true);
