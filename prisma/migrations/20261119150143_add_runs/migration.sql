-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "tool_calls" JSONB NOT NULL DEFAULT '[]',
    "output" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runs_ticket_id_created_at_idx" ON "runs"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
