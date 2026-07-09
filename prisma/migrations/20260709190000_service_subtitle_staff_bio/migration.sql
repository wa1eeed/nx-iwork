-- Richer public detail pages: a service subtitle, and a staff bio + photo for
-- the team intro cards and staff detail pages. Additive nullable columns.

ALTER TABLE "Service" ADD COLUMN "subtitle" TEXT;

ALTER TABLE "StaffMember" ADD COLUMN "bio" TEXT;
ALTER TABLE "StaffMember" ADD COLUMN "image" TEXT;
