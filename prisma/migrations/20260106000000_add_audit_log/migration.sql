-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "user_id" TEXT,
    "user_email" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "endpoint" TEXT,
    "method" TEXT,
    "status_code" INTEGER,
    "request_body" JSONB,
    "response_body" JSONB,
    "error_message" TEXT,
    "metadata" JSONB,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_event_type" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "idx_audit_user" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_created" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_severity" ON "audit_logs"("severity");

-- CreateIndex
CREATE INDEX "idx_audit_event_date" ON "audit_logs"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_user_date" ON "audit_logs"("user_id", "created_at");
