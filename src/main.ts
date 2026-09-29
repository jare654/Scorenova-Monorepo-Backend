import * as dotenv from "dotenv";
dotenv.config({ processEnv: process.env });

import { seedCurriculum } from "./helpers/curriculum.seeder";
import { JwtAuthGuard } from "@account/auth/guards/jwt-auth.guard";
import { HttpExceptionFilter } from "@infrastructure/filters/http-exception.filter";
import { ResponseEnvelopeInterceptor } from "@infrastructure/interceptors/response-envelope.interceptor";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { DataSource } from "typeorm";
import { json, urlencoded } from "express";
import { join } from "path";
import * as admin from "firebase-admin";
import { ServiceAccount } from "firebase-admin";
import { webcrypto } from "crypto";
import helmet from "helmet";

if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

declare const module: any;

// ─── Allowed CORS origins ─────────────────────────────────────────────────────
const CORS_ALLOWED_PATTERNS: RegExp[] = [
  /^https?:\/\/([a-zA-Z0-9-]+\.)*solanovatech\.com$/,
  /^https?:\/\/([a-zA-Z0-9-]+\.)*onrender\.com$/,
  /^https?:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/,
  /^https?:\/\/([a-zA-Z0-9-]+\.)*netlify\.app$/,
  /^https?:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?$/,  // any IPv4 address on any port
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/\[::1\](:\d+)?$/,                  // IPv6 localhost loopback
];

// Explicit string allowlist — covers any edge cases the regex might miss
const CORS_ALLOWED_EXACT: string[] = [
  "http://173.249.19.135:3000",
  "http://173.249.19.135:8011",
  "http://api.solanovatech.com",
  "https://api.solanovatech.com",
];

function isAllowedOrigin(origin: string): boolean {
  if (CORS_ALLOWED_EXACT.includes(origin)) return true;
  return CORS_ALLOWED_PATTERNS.some((pattern) => pattern.test(origin));
}

async function bootstrap() {
  const PORT = process.env.PORT ?? 3000;
  const isDev = process.env.NODE_ENV !== "production";

  // ── Create app ──────────────────────────────────────────────────────────────
  let app: NestExpressApplication;
  try {
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: isDev ? ["log", "warn", "error"] : ["warn", "error"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ❌  Failed to start: ${msg}`);
    console.error("       Check database connection settings in .env\n");
    process.exit(1);
  }

  // ── Run migrations automatically (idempotent) ──────────────────────────────
  try {
    const ds = app.get(DataSource);
    console.log("  📦 Running database migrations...");
    await ds.runMigrations();
    console.log("  ✅ Database migrations applied successfully");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠  Migration warning: ${msg}`);
  }

  // ── Seed curriculum (idempotent) ────────────────────────────────────────────
  try {
    await seedCurriculum(app.get(DataSource));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠  Curriculum seed warning: ${msg}`);
  }

  // ── Cleanup stale settings rows ─────────────────────────────────────────────
  try {
    await app.get(DataSource).query(`
      DELETE FROM settings
      WHERE section != TRIM(section)
        AND TRIM(section) IN (
          SELECT section FROM settings WHERE section = TRIM(settings.section)
        )
    `);
  } catch { /* table may not exist yet — safe to ignore */ }

  // ── Auto-grant premium to designated accounts ──────────────────────────────
  try {
    await app.get(DataSource).query(`
      UPDATE "accounts"
      SET "is_premium" = true,
          "premium_plan" = 'yearly',
          "premium_start_date" = NOW(),
          "premium_end_date" = NOW() + INTERVAL '5 years'
      WHERE REPLACE(REPLACE(REPLACE("phone_number", '+', ''), ' ', ''), '-', '') LIKE '%798687678'
    `);
    console.log("  💎 Ensured premium status for +251 798687678");
  } catch { /* safe to ignore */ }

  // ── Ensure user_daily_scans table exists ────────────────────────────────────
  try {
    await app.get(DataSource).query(`
      CREATE TABLE IF NOT EXISTS user_daily_scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(128) NOT NULL,
        scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
        scan_count INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_user_daily_scan UNIQUE(user_id, scan_date)
      );
      CREATE INDEX IF NOT EXISTS idx_user_daily_scans_lookup ON user_daily_scans(user_id, scan_date);
    `);
    console.log("  📸 Verified user_daily_scans table in database");
  } catch (err) {
    console.warn(`  ⚠ user_daily_scans table warning: ${err}`);
  }

  // ── Ensure admin account is branded Scorenova ───────────────────────────────
  try {
    await app.get(DataSource).query(`
      UPDATE "accounts"
      SET "name" = 'Scorenova Admin',
          "email" = 'admin@scorenova.et'
      WHERE "name" ILIKE '%Learnova%' OR "email" ILIKE '%learnova%'
    `);
    console.log("  🛡 Ensured Scorenova Admin account branding in database");
  } catch { /* safe to ignore */ }

  // ── Body parsers ────────────────────────────────────────────────────────────
  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ extended: true, limit: "50mb" }));

  // ── Security headers ────────────────────────────────────────────────────────
  // Keep CSP disabled here because Swagger UI and admin integrations depend on
  // inline scripts/styles; enforce CSP per HTML surface once policies are ready.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: isDev
        ? false
        : {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          },
    }),
  );

  // Apply restrictive CSP on API routes without breaking Swagger UI at "/".
  app.use(
    "/api/v1",
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────────────────────
  // Registered before guards so OPTIONS preflight is resolved at middleware level
  // before the JWT guard ever runs.
  app.enableCors({
    origin: (origin, callback) => {
      // No origin = server-to-server call or same-origin — allow
      if (!origin) return callback(null, true);
      // In development mode, allow all origins
      if (isDev) return callback(null, true);

      if (isAllowedOrigin(origin)) return callback(null, true);
      console.warn(`[CORS] Rejected origin: ${origin}`);
      callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-refresh-token"],
    exposedHeaders: ["Content-Range"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // ── Global prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix("api/v1");

  // ── Global pipes, guards, filters, interceptors ─────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: true,
    }),
  );
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  // ── Swagger (all environments — admin panel needs it) ───────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Exam Prep API")
    .setDescription("AI Exam Preparation App – Backend API")
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "Token" }, "Bearer")
    .build();

  SwaggerModule.setup(
    "/",
    app,
    SwaggerModule.createDocument(app, swaggerConfig, { deepScanRoutes: true }),
    {
      swaggerOptions: { persistAuthorization: false, docExpansion: "none" },
      customSiteTitle: "Exam Prep API Docs",
    },
  );

  // ── Firebase Admin SDK Initialization ───────────────────────────────────────
  const fbProjectId    = process.env.FIREBASE_PROJECT_ID?.trim();
  const fbPrivateKey   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const fbEmail        = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const serviceAccPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() || "./firebase-service-account.json";

  if (admin.apps.length === 0) {
    try {
      const fs = require("fs");
      const path = require("path");
      const resolvedServiceAccPath = path.isAbsolute(serviceAccPath)
        ? serviceAccPath
        : path.join(__dirname, "..", "..", serviceAccPath);

      if (fs.existsSync(resolvedServiceAccPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedServiceAccPath, "utf8"));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log(`  🔥 Firebase Admin initialized via service account file (${serviceAccPath})`);
      } else if (fbProjectId && fbPrivateKey && fbEmail) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId:   fbProjectId,
            privateKey:  fbPrivateKey,
            clientEmail: fbEmail,
          } as ServiceAccount),
        });
        console.log(`  🔥 Firebase Admin initialized via environment variables`);
      } else {
        console.warn(`  ⚠  Firebase Admin SDK is NOT configured. Set FIREBASE_PROJECT_ID / FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL in .env or place firebase-service-account.json in backend root.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠  Firebase init failed: ${msg}`);
    }
  }

  // ── Static assets (.well-known for Apple/Google app association) ─────────────
  app.useStaticAssets(join(__dirname, "../..", "src/.well-known"), {
    prefix: "/.well-known",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("apple-app-site-association")) {
        res.setHeader("Content-Type", "application/json");
      }
    },
  });

  // ── HMR (dev only) ──────────────────────────────────────────────────────────
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }

  await app.listen(PORT, "0.0.0.0");
  console.log(`\n  🚀  API running → http://localhost:${PORT}/api/v1`);
  console.log(`  📖  Swagger    → http://localhost:${PORT}/\n`);
}

bootstrap();