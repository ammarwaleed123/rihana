-- Preferred interface language for the private app (portal + admin).
-- Stored on the user, not the device, so signing in on a new phone keeps it.
-- Defaults to 'en', which is what every existing account was seeing.
ALTER TABLE "users" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en';
