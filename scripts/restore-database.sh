#!/bin/bash
#
# Database Restore Script
# 
# Restores PostgreSQL database from backup file.
# Supports both compressed and uncompressed backups.
#
# Usage:
#   ./restore-database.sh <backup_file> [--force] [--verify]
#
# Options:
#   --force   Force restore (drop existing database first)
#   --verify  Verify restore after completion
#
# Environment Variables:
#   DATABASE_URL          - PostgreSQL connection string
#   BACKUP_DIR            - Backup storage directory (default: ./backups)
#

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"

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

# Check arguments
if [ $# -lt 1 ]; then
    error "Usage: $0 <backup_file> [--force] [--verify]"
    exit 1
fi

BACKUP_FILE="$1"
FORCE_RESTORE=false
VERIFY_RESTORE=false

# Parse options
for arg in "$@"; do
    case $arg in
        --force)
            FORCE_RESTORE=true
            ;;
        --verify)
            VERIFY_RESTORE=true
            ;;
    esac
done

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try in backup directory
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

log "Restoring from backup: $BACKUP_FILE"

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    error "DATABASE_URL environment variable is not set"
    exit 1
fi

# Extract database name
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
if [ -z "$DB_NAME" ]; then
    error "Could not extract database name from DATABASE_URL"
    exit 1
fi

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    if [ "$FORCE_RESTORE" = "true" ]; then
        warn "Dropping existing database: $DB_NAME"
        dropdb "$DB_NAME" || {
            error "Failed to drop database"
            exit 1
        }
    else
        error "Database $DB_NAME already exists. Use --force to drop and restore."
        exit 1
    fi
fi

# Create database if it doesn't exist
if ! psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    log "Creating database: $DB_NAME"
    createdb "$DB_NAME" || {
        error "Failed to create database"
        exit 1
    }
fi

# Determine if backup is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    COMPRESSED=true
    log "Detected compressed backup"
else
    COMPRESSED=false
    log "Detected uncompressed backup"
fi

# Restore backup
log "Restoring backup..."
if [ "$COMPRESSED" = "true" ]; then
    if gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" > /dev/null 2>&1; then
        log "Backup restored successfully"
    else
        error "Backup restore failed"
        exit 1
    fi
else
    if psql "$DATABASE_URL" < "$BACKUP_FILE" > /dev/null 2>&1; then
        log "Backup restored successfully"
    else
        error "Backup restore failed"
        exit 1
    fi
fi

# Verify restore if requested
if [ "$VERIFY_RESTORE" = "true" ]; then
    log "Verifying restore..."
    
    # Check if database has tables
    TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [ "$TABLE_COUNT" -gt 0 ]; then
        log "Restore verification successful: $TABLE_COUNT tables found"
    else
        warn "Restore verification warning: No tables found in database"
    fi
    
    # Check database size
    DB_SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" | tr -d ' ')
    log "Database size: $DB_SIZE"
fi

log "Restore process completed successfully"

# Exit with success
exit 0
