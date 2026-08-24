import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Bootstrap. Per ADR-007/ADR-010: this process listens on an internal-only
// port; Caddy is the sole public entry point and terminates TLS. Per
// Security Design §8, security headers are set here as defense-in-depth
// even though Caddy also sets them at the edge.
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Structured logging only — Security Design §15: never log request/
    // response bodies wholesale. Nest's default logger is replaced by a
    // structured JSON logger before this ships past Phase 0; left as the
    // default here since that swap is an infra-workstream detail, not an
    // architectural one.
  });

  app.use(helmet());
  app.use(cookieParser());

  app.use((req: any, res: any, next: any) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    // skip csrf for public login/2fa? No, the frontend fetches csrf beforehand.
    const token = req.headers['x-csrf-token'];
    const cookieToken = req.cookies['csrf-token'];
    if (!token || !cookieToken || token !== cookieToken) {
      return res.status(403).json({ message: 'Invalid CSRF token' });
    }
    next();
  });

  // API Contract §1.3 — CORS is deny-by-default with an explicit
  // single-origin allow-list, never a wildcard on authenticated routes.
  app.enableCors({
    origin: process.env.CORS_ALLOWED_ORIGIN,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  // ADR-009 / Security Design §7: every request body is validated against
  // its DTO's explicit allow-list; unrecognized fields are rejected, not
  // silently dropped (whitelist + forbidNonWhitelisted), closing the
  // mass-assignment class of bug at the framework layer.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: 400,
    }),
  );

  // API Contract §1.4/§13 — a single global filter guarantees every error
  // response uses the standard envelope and never leaks a stack trace,
  // ORM error, or internal detail (Security Design §15).
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
}

bootstrap();
