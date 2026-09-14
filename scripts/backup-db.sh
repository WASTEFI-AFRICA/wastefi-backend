#!/bin/bash

# Database Backup Script for WasteFi
# Usage: ./scripts/backup-db.sh

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/db"
BACKUP_FILE="${BACKUP_DIR}/wastefi_${TIMESTAMP}.sql"

# Load environment variables
source .env.production

echo "🗄️  Starting database backup..."

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Backup database
docker-compose exec -T postgres pg_dump -U ${DB_USER:-postgres} ${DB_NAME:-wastefi} > "${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_FILE}"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "✓ Backup completed: ${BACKUP_FILE}"

# Get file size
SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "  File size: ${SIZE}"

# Keep only last 7 backups
echo "🧹 Cleaning old backups (keeping last 7)..."
ls -t ${BACKUP_DIR}/wastefi_*.sql.gz | tail -n +8 | xargs -r rm

# List remaining backups
echo "📋 Available backups:"
ls -lh ${BACKUP_DIR}/wastefi_*.sql.gz

echo "✓ Backup process completed successfully!"
