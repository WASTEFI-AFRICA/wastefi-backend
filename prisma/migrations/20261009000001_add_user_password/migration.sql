-- The Prisma schema has had a nullable users.password column since password login
-- was added, but no migration created it, so a database built by `prisma migrate
-- deploy` rejected every register and login with "column users.password does not
-- exist". Nullable, because phone/OTP accounts have no password.
ALTER TABLE "users" ADD COLUMN "password" TEXT;
