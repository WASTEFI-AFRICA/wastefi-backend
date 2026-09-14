#!/bin/bash

# Database Restore Script for WasteFi
# Usage: ./scripts/restore-db.sh <backup-file>

set -e

if [ -z "$1" ]; then
    echo "❌ Error: Backup file not specified"
    echo "Usage: ./scripts/restore-db.sh <backup-file>"
    echo ""
    echo "Available backups:"
    ls -lh backups/db/wastefi_*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Load environment variables
source .env.production

echo "⚠️  WARNING: This will replace the current database!"
echo "Database: ${DB_NAME:-wastefi}"
echo "Backup file: ${BACKUP_FILE}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

echo "🗄️  Starting database restore..."

# Create temporary file
TEMP_FILE=$(mktemp)

# Decompress if gzipped
if [[ $BACKUP_FILE == *.gz ]]; then
    echo "📦 Decompressing backup..."
    gunzip -c "${BACKUP_FILE}" > "${TEMP_FILE}"
else
    cp "${BACKUP_FILE}" "${TEMP_FILE}"
fi

# Drop existing database and recreate
echo "🔄 Recreating database..."
docker-compose exec -T postgres psql -U ${DB_USER:-postgres} -c "DROP DATABASE IF EXISTS ${DB_NAME:-wastefi};"
docker-compose exec -T postgres psql -U ${DB_USER:-postgres} -c "CREATE DATABASE ${DB_NAME:-wastefi};"

# Restore backup
echo "📥 Restoring backup..."
cat "${TEMP_FILE}" | docker-compose exec -T postgres psql -U ${DB_USER:-postgres} ${DB_NAME:-wastefi}

# Clean up
rm "${TEMP_FILE}"

echo "✓ Database restored successfully!"
echo ""
echo "🔄 Restarting API service..."
docker-compose restart api

echo "✓ Restore process completed successfully!"
