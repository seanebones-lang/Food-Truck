-- CreateTable
CREATE TABLE "cost_entries" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_cost_category" ON "cost_entries"("category");

-- CreateIndex
CREATE INDEX "idx_cost_service" ON "cost_entries"("service");

-- CreateIndex
CREATE INDEX "idx_cost_date" ON "cost_entries"("date");

-- CreateIndex
CREATE INDEX "idx_cost_category_date" ON "cost_entries"("category", "date");
