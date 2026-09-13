# Database Setup Guide

## Prerequisites

You need PostgreSQL installed on your machine. Here are the options:

### Option 1: Install PostgreSQL Locally (Recommended for Development)

#### Windows:
1. Download from https://www.postgresql.org/download/windows/
2. Install PostgreSQL (default port 5432)
3. During installation, set a password for the postgres user
4. After installation, PostgreSQL should start automatically

#### Verify PostgreSQL is Running:
```cmd
psql --version
```

### Option 2: Use Docker (Alternative)

```cmd
docker run --name wastefi-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=wastefi -p 5432:5432 -d postgres:14
```

## Database Setup Steps

### Step 1: Create the Database

Using psql command line:
```cmd
psql -U postgres
CREATE DATABASE wastefi;
\q
```

Or using pgAdmin (GUI tool that comes with PostgreSQL installation):
1. Open pgAdmin
2. Right-click on Databases → Create → Database
3. Name it: `wastefi`
4. Click Save

### Step 2: Update .env File

Make sure your `.env` file has the correct database URL:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/wastefi
```

Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation.

Common formats:
- Local: `postgresql://postgres:postgres@localhost:5432/wastefi`
- Docker: `postgresql://postgres:postgres@localhost:5432/wastefi`
- Remote: `postgresql://username:password@host:port/database`

### Step 3: Run Prisma Commands

```cmd
# Generate Prisma Client
npm run prisma:generate

# Create and run migrations (this creates the tables)
npm run prisma:migrate

# Seed the database with sample data (optional)
npm run prisma:seed
```

## Troubleshooting

### Error: "Can't reach database server"

**Solution 1:** Check if PostgreSQL is running
```cmd
# Windows - Check if postgres service is running
sc query postgresql-x64-14
```

If not running, start it:
```cmd
net start postgresql-x64-14
```

**Solution 2:** Verify your DATABASE_URL in .env
- Make sure the password is correct
- Make sure the database name exists
- Check if port 5432 is correct

**Solution 3:** Test connection manually
```cmd
psql -U postgres -d wastefi
```

### Error: "Database 'wastefi' does not exist"

Create the database first:
```cmd
psql -U postgres
CREATE DATABASE wastefi;
\q
```

### Error during seed

If seeding fails, you can reset and try again:
```cmd
npm run db:reset
```

This will:
1. Drop the database
2. Recreate it
3. Run all migrations
4. Run the seed script

## Verify Setup

After successful setup, you can verify:

1. **View tables using Prisma Studio:**
```cmd
npm run prisma:studio
```
This opens a GUI at http://localhost:5555

2. **Check via psql:**
```cmd
psql -U postgres -d wastefi
\dt
```

You should see tables like: users, collection_points, waste_collections, transactions, etc.

## Quick Start (All-in-One)

If PostgreSQL is already installed and running:

```cmd
# Create database
psql -U postgres -c "CREATE DATABASE wastefi;"

# Run setup
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# Verify
npm run prisma:studio
```

## Need Help?

Common PostgreSQL connection strings:
- Local dev: `postgresql://postgres:postgres@localhost:5432/wastefi`
- Local with custom password: `postgresql://postgres:mypassword@localhost:5432/wastefi`
- Docker: `postgresql://postgres:postgres@localhost:5432/wastefi`
