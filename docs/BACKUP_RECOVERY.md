# Database Backup & Recovery Guide

## Overview

WasteFi implements automated database backup and recovery system with retention policies, verification, and monitoring.

## Features

- **Automated Backups**: Scheduled daily backups via GitHub Actions
- **Retention Policy**: Configurable retention period (default: 30 days)
- **Compression**: Efficient storage with PostgreSQL custom format
- **Verification**: Integrity checks before restore
- **Metadata Tracking**: Detailed backup history and statistics
- **REST API**: Programmatic backup management
- **Recovery Testing**: Verify backup integrity without restoring

## Configuration

### Environment Variables

```env
# Backup directory (default: ./backups/db)
BACKUP_DIR=./backups/db

# Retention period in days (default: 30)
BACKUP_RETENTION_DAYS=30

# Maximum number of backups to keep (default: 50)
MAX_BACKUPS=50
```

## Backup Types

### Full Backup

Complete database snapshot including:

- All tables and data
- Indexes and constraints
- Sequences and views
- Functions and triggers

```bash
# Create full backup
npm run backup
```

### Incremental Backup (Future)

Planned feature for large databases:

- Only backs up changes since last backup
- Faster and more storage-efficient
- Requires base full backup

## Manual Backup

### Create Backup

```bash
# Using npm script
npm run backup

# Using pg_dump directly
pg_dump -h localhost -U postgres -F c -b -v -f backup.backup wastefi
```

### Restore Backup

```bash
# Using npm script
npm run restore backup-file.backup

# Using pg_restore directly
pg_restore -h localhost -U postgres -d wastefi -c -v backup.backup
```

## API Endpoints

### Create Backup

```http
POST /api/v1/admin/backups
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "type": "full"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Backup created successfully",
  "data": {
    "filename": "wastefi_full_2026-09-14_10-30-00.backup",
    "timestamp": "2026-09-14T10:30:00Z",
    "size": 5242880,
    "type": "full",
    "status": "success",
    "duration": 2500
  }
}
```

### List Backups

```http
GET /api/v1/admin/backups
Authorization: Bearer {admin-token}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "filename": "wastefi_full_2026-09-14_10-30-00.backup",
      "timestamp": "2026-09-14T10:30:00Z",
      "size": 5242880,
      "type": "full",
      "status": "success",
      "duration": 2500
    }
  ],
  "count": 1
}
```

### Get Backup Details

```http
GET /api/v1/admin/backups/{filename}
Authorization: Bearer {admin-token}
```

### Restore Backup

```http
POST /api/v1/admin/backups/{filename}/restore
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "verifyOnly": false
}
```

**Parameters:**

- `verifyOnly`: Set to `true` to verify backup without restoring

### Verify Backup

```http
POST /api/v1/admin/backups/{filename}/restore
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "verifyOnly": true
}
```

### Delete Backup

```http
DELETE /api/v1/admin/backups/{filename}
Authorization: Bearer {admin-token}
```

### Get Statistics

```http
GET /api/v1/admin/backups/stats
Authorization: Bearer {admin-token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalBackups": 15,
    "totalSize": 78643200,
    "oldestBackup": "2026-08-15T10:30:00Z",
    "newestBackup": "2026-09-14T10:30:00Z",
    "successRate": 100
  }
}
```

### Cleanup Old Backups

```http
POST /api/v1/admin/backups/cleanup
Authorization: Bearer {admin-token}
```

## Automated Backups

### GitHub Actions

Automated daily backups configured in `.github/workflows/cron-backup.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM UTC
```

### Manual Trigger

```bash
# Trigger via GitHub Actions UI
# Actions -> Scheduled Database Backup -> Run workflow
```

## Retention Policy

### Automatic Cleanup

Backups are automatically cleaned up based on:

1. **Age**: Backups older than `BACKUP_RETENTION_DAYS`
2. **Count**: Only `MAX_BACKUPS` most recent backups kept

Cleanup runs after each backup creation.

### Manual Cleanup

```bash
# Via API
POST /api/v1/admin/backups/cleanup

# Via script
npm run backup:cleanup
```

## Recovery Procedures

### Standard Recovery

1. **Stop Application**

   ```bash
   npm run stop
   ```

2. **Verify Backup**

   ```bash
   npm run backup:verify backup-file.backup
   ```

3. **Restore Database**

   ```bash
   npm run restore backup-file.backup
   ```

4. **Restart Application**
   ```bash
   npm start
   ```

### Point-in-Time Recovery

1. **Identify Target Backup**
   - List available backups
   - Select backup closest to desired time

2. **Test Restore** (Optional)
   - Restore to test database first
   - Verify data integrity

3. **Production Restore**
   - Follow standard recovery procedure

## Backup Verification

### Integrity Check

```bash
# Verify backup file
gzip -t backup-file.backup

# Verify via API
POST /api/v1/admin/backups/{filename}/restore
{ "verifyOnly": true }
```

### Test Restore

```bash
# Restore to test database
pg_restore -h localhost -U postgres -d wastefi_test -c -v backup.backup

# Verify data
psql -h localhost -U postgres -d wastefi_test -c "SELECT COUNT(*) FROM users;"
```

## Monitoring

### Backup Logs

All backup operations are logged:

```json
{
  "level": "info",
  "message": "Database backup completed",
  "filename": "wastefi_full_2026-09-14_10-30-00.backup",
  "size": "5 MB",
  "duration": "2500ms"
}
```

### Failure Alerts

Failed backups trigger alerts:

```json
{
  "level": "error",
  "message": "Database backup failed",
  "filename": "wastefi_full_2026-09-14_10-30-00.backup",
  "error": "pg_dump command failed"
}
```

### Success Metrics

Monitor backup health:

- Success rate
- Average backup size
- Average duration
- Last successful backup time

## Best Practices

### Backup Strategy

1. **Frequency**: Daily automated backups
2. **Timing**: Off-peak hours (2 AM UTC)
3. **Retention**: 30 days minimum
4. **Verification**: Weekly recovery tests
5. **Off-site Storage**: Copy to S3/cloud storage

### Recovery Testing

1. **Monthly**: Full restore test
2. **Quarterly**: Disaster recovery drill
3. **Document**: Recovery time metrics

### Security

1. **Access Control**: Admin-only backup endpoints
2. **Encryption**: Encrypt backups at rest
3. **Secure Transfer**: Use HTTPS for API
4. **Audit Logging**: Track all backup operations

## Troubleshooting

### Backup Fails

**Problem**: pg_dump command not found

**Solution**:

```bash
# Install PostgreSQL client tools
# Ubuntu/Debian
sudo apt-get install postgresql-client

# MacOS
brew install postgresql

# Windows
# Download from postgresql.org
```

**Problem**: Permission denied

**Solution**:

```bash
# Ensure backup directory is writable
chmod 755 ./backups/db
```

### Restore Fails

**Problem**: Database has active connections

**Solution**:

```bash
# Terminate connections
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'wastefi';"
```

**Problem**: Backup file corrupted

**Solution**:

```bash
# Verify backup integrity
gzip -t backup-file.backup

# Use different backup
```

## Storage Requirements

### Estimate Backup Size

```sql
-- Check current database size
SELECT pg_size_pretty(pg_database_size('wastefi'));

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

### Storage Calculator

| Database Size | Daily Backup | 30-Day Retention |
| ------------- | ------------ | ---------------- |
| 1 GB          | ~500 MB      | ~15 GB           |
| 10 GB         | ~5 GB        | ~150 GB          |
| 100 GB        | ~50 GB       | ~1.5 TB          |

_Assuming 50% compression ratio_

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Monitoring](./MONITORING.md)
- [Admin Dashboard](./ADMIN_DASHBOARD.md)
- [CI/CD Pipeline](./CICD.md)
