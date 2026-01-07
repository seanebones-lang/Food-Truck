#!/bin/bash
#
# Disaster Recovery Test Script
# 
# Simulates disaster recovery scenarios and validates recovery procedures.
#
# Usage:
#   ./dr-test.sh [scenario]
#
# Scenarios:
#   database_corruption  - Test database corruption recovery
#   data_deletion       - Test accidental data deletion recovery
#   application_failure - Test application failure recovery
#   full_dr            - Complete DR test
#
# Environment Variables:
#   DATABASE_URL          - PostgreSQL connection string
#   DR_TEST_DATABASE      - Test database name (default: dr_test_db)
#   BACKUP_DIR            - Backup storage directory
#

set -euo pipefail

# Configuration
DR_TEST_DATABASE="${DR_TEST_DATABASE:-dr_test_db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
SCENARIO="${1:-full_dr}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

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

# Test database restore
test_database_restore() {
    log "Testing database restore..."
    
    # Find most recent backup
    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f | sort -r | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        error "No backup found for restore test"
        return 1
    fi
    
    info "Using backup: $LATEST_BACKUP"
    
    # Create test database
    log "Creating test database: $DR_TEST_DATABASE"
    dropdb "$DR_TEST_DATABASE" 2>/dev/null || true
    createdb "$DR_TEST_DATABASE" || {
        error "Failed to create test database"
        return 1
    }
    
    # Restore backup
    log "Restoring backup to test database..."
    if gunzip -c "$LATEST_BACKUP" | psql "$DR_TEST_DATABASE" > /dev/null 2>&1; then
        log "Backup restored successfully"
    else
        error "Backup restore failed"
        dropdb "$DR_TEST_DATABASE" 2>/dev/null || true
        return 1
    fi
    
    # Verify restore
    log "Verifying restore..."
    TABLE_COUNT=$(psql "$DR_TEST_DATABASE" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [ "$TABLE_COUNT" -gt 0 ]; then
        log "Restore verification successful: $TABLE_COUNT tables found"
    else
        warn "Restore verification warning: No tables found"
    fi
    
    # Clean up
    dropdb "$DR_TEST_DATABASE" 2>/dev/null || true
    log "Database restore test completed successfully"
    
    return 0
}

# Test backup integrity
test_backup_integrity() {
    log "Testing backup integrity..."
    
    # Find all backups
    BACKUPS=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f)
    
    if [ -z "$BACKUPS" ]; then
        error "No backups found"
        return 1
    fi
    
    BACKUP_COUNT=0
    VALID_COUNT=0
    
    for backup in $BACKUPS; do
        BACKUP_COUNT=$((BACKUP_COUNT + 1))
        info "Checking: $(basename $backup)"
        
        # Check if backup is valid gzip
        if gzip -t "$backup" 2>/dev/null; then
            VALID_COUNT=$((VALID_COUNT + 1))
            log "  ✓ Valid backup"
        else
            error "  ✗ Invalid backup: $backup"
        fi
    done
    
    log "Backup integrity check: $VALID_COUNT/$BACKUP_COUNT backups valid"
    
    if [ "$VALID_COUNT" -eq "$BACKUP_COUNT" ]; then
        return 0
    else
        return 1
    fi
}

# Test application connectivity
test_application_connectivity() {
    log "Testing application connectivity..."
    
    # Check if application is running
    API_URL="${API_URL:-http://localhost:3001}"
    
    if curl -f -s "$API_URL/health" > /dev/null 2>&1; then
        log "Application is accessible"
        return 0
    else
        warn "Application is not accessible"
        return 1
    fi
}

# Test database connectivity
test_database_connectivity() {
    log "Testing database connectivity..."
    
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        log "Database is accessible"
        return 0
    else
        error "Database is not accessible"
        return 1
    fi
}

# Full DR test
full_dr_test() {
    log "Starting full DR test..."
    
    TEST_RESULTS=()
    
    # Test 1: Backup integrity
    if test_backup_integrity; then
        TEST_RESULTS+=("✓ Backup integrity: PASSED")
    else
        TEST_RESULTS+=("✗ Backup integrity: FAILED")
    fi
    
    # Test 2: Database restore
    if test_database_restore; then
        TEST_RESULTS+=("✓ Database restore: PASSED")
    else
        TEST_RESULTS+=("✗ Database restore: FAILED")
    fi
    
    # Test 3: Database connectivity
    if test_database_connectivity; then
        TEST_RESULTS+=("✓ Database connectivity: PASSED")
    else
        TEST_RESULTS+=("✗ Database connectivity: FAILED")
    fi
    
    # Test 4: Application connectivity
    if test_application_connectivity; then
        TEST_RESULTS+=("✓ Application connectivity: PASSED")
    else
        TEST_RESULTS+=("✗ Application connectivity: FAILED")
    fi
    
    # Print results
    log "DR Test Results:"
    for result in "${TEST_RESULTS[@]}"; do
        echo "  $result"
    done
    
    # Check if all tests passed
    FAILED_COUNT=$(echo "${TEST_RESULTS[@]}" | grep -c "FAILED" || true)
    
    if [ "$FAILED_COUNT" -eq 0 ]; then
        log "All DR tests passed!"
        return 0
    else
        error "$FAILED_COUNT test(s) failed"
        return 1
    fi
}

# Main execution
case "$SCENARIO" in
    database_corruption)
        log "Testing database corruption recovery scenario"
        test_database_restore
        ;;
    data_deletion)
        log "Testing data deletion recovery scenario"
        test_database_restore
        ;;
    application_failure)
        log "Testing application failure recovery scenario"
        test_application_connectivity
        ;;
    full_dr)
        full_dr_test
        ;;
    *)
        error "Unknown scenario: $SCENARIO"
        echo "Available scenarios: database_corruption, data_deletion, application_failure, full_dr"
        exit 1
        ;;
esac

exit $?
