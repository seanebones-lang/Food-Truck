#!/bin/bash
#
# Database Backup Script
# 
# Creates automated backups of PostgreSQL database with retention policy.
# Implements backup verification and monitoring.
#
# Usage:
#   ./backup-database.sh [--full] [--verify]
#
# Options:
#   --full    Create full backup (default: incremental)
#   --verify  Verify backup after creation
#
# Environment Variables:
#   DATABASE_URL          - PostgreSQL connection string
#   BACKUP_DIR            - Backup storage directory (default: ./backups)
#   BACKUP_RETENTION_DAYS - Number of days to retain backups (default: 30)
#   BACKUP_COMPRESSION    - Enable compression (default: true)
#

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_COMPRESSION="${BACKUP_COMPRESSION:-true}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_TYPE="${1:-incremental}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    error "DATABASE_URL environment variable is not set"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Extract database connection details
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
if [ -z "$DB_NAME" ]; then
    error "Could not extract database name from DATABASE_URL"
    exit 1
fi

# Determine backup filename
if [ "$BACKUP_TYPE" = "--full" ]; then
    BACKUP_FILE="$BACKUP_DIR/full_backup_${DB_NAME}_${TIMESTAMP}.sql"
    BACKUP_TYPE_STR="full"
else
    BACKUP_FILE="$BACKUP_DIR/incremental_backup_${DB_NAME}_${TIMESTAMP}.sql"
    BACKUP_TYPE_STR="incremental"
fi

# Compressed backup filename
if [ "$BACKUP_COMPRESSION" = "true" ]; then
    BACKUP_FILE_COMPRESSED="${BACKUP_FILE}.gz"
else
    BACKUP_FILE_COMPRESSED="$BACKUP_FILE"
fi

log "Starting $BACKUP_TYPE_STR backup of database: $DB_NAME"
log "Backup file: $BACKUP_FILE_COMPRESSED"

# Create backup
log "Creating backup..."
if [ "$BACKUP_COMPRESSION" = "true" ]; then
    if pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE_COMPRESSED"; then
        log "Backup created successfully: $BACKUP_FILE_COMPRESSED"
    else
        error "Backup creation failed"
        exit 1
    fi
else
    if pg_dump "$DATABASE_URL" > "$BACKUP_FILE"; then
        log "Backup created successfully: $BACKUP_FILE"
    else
        error "Backup creation failed"
        exit 1
    fi
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
log "Backup size: $BACKUP_SIZE"

# Verify backup if requested
if [ "${2:-}" = "--verify" ] || [ "${3:-}" = "--verify" ]; then
    log "Verifying backup..."
    
    # Create temporary database for verification
    TEMP_DB="backup_verify_${TIMESTAMP}"
    
    # Create temporary database
    createdb "$TEMP_DB" 2>/dev/null || true
    
    # Restore backup to temporary database
    if [ "$BACKUP_COMPRESSION" = "true" ]; then
        if gunzip -c "$BACKUP_FILE_COMPRESSED" | psql "$TEMP_DB" > /dev/null 2>&1; then
            log "Backup verification successful"
        else
            error "Backup verification failed"
            dropdb "$TEMP_DB" 2>/dev/null || true
            exit 1
        fi
    else
        if psql "$TEMP_DB" < "$BACKUP_FILE" > /dev/null 2>&1; then
            log "Backup verification successful"
        else
            error "Backup verification failed"
            dropdb "$TEMP_DB" 2>/dev/null || true
            exit 1
        fi
    fi
    
    # Clean up temporary database
    dropdb "$TEMP_DB" 2>/dev/null || true
    log "Backup verification complete"
fi

# Create backup metadata file
METADATA_FILE="${BACKUP_FILE_COMPRESSED}.meta"
cat > "$METADATA_FILE" <<EOF
{
  "backup_type": "$BACKUP_TYPE_STR",
  "database": "$DB_NAME",
  "timestamp": "$TIMESTAMP",
  "file": "$(basename $BACKUP_FILE_COMPRESSED)",
  "size": "$BACKUP_SIZE",
  "compressed": $BACKUP_COMPRESSION,
  "verified": ${2:-false}
}
EOF

log "Backup metadata saved: $METADATA_FILE"

# Clean up old backups
log "Cleaning up backups older than $BACKUP_RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.sql*" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.meta" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
log "Old backups cleaned up"

# List current backups
log "Current backups:"
ls -lh "$BACKUP_DIR"/*.sql* 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' || warn "No backups found"

log "Backup process completed successfully"

# Exit with success
exit 0
