-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rating" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'new',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_feedback_type" ON "feedback"("type");

-- CreateIndex
CREATE INDEX "idx_feedback_user" ON "feedback"("user_id");

-- CreateIndex
CREATE INDEX "idx_feedback_status" ON "feedback"("status");

-- CreateIndex
CREATE INDEX "idx_feedback_created" ON "feedback"("created_at");

-- CreateIndex
CREATE INDEX "idx_feedback_rating" ON "feedback"("rating");

-- CreateIndex
CREATE INDEX "idx_feedback_type_status" ON "feedback"("type", "status");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
