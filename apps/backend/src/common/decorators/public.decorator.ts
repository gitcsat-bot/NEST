import { SetMetadata } from '@nestjs/common';

// API Contract §2 — the exhaustive public-route list. A route is
// authenticated by default (Security Design §6: "every non-public request
// is authorized"); this decorator is the single, explicit way to except a
// route, so "public" is always a deliberate marking, never an omission.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
