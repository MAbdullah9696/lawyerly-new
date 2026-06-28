-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('citizen', 'lawyer', 'admin');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'suspended', 'banned', 'pending');

-- CreateEnum
CREATE TYPE "province" AS ENUM ('Punjab', 'Sindh', 'KPK', 'Balochistan', 'AJK', 'GB', 'Federal');

-- CreateEnum
CREATE TYPE "experience_band" AS ENUM ('1-5', '6-10', '11-20', '20+');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('pending', 'verified', 'rejected', 'suspended', 'banned');

-- CreateEnum
CREATE TYPE "availability_status" AS ENUM ('online', 'busy', 'offline');

-- CreateEnum
CREATE TYPE "lawyer_doc_type" AS ENUM ('bar_council_cert', 'cnic_front', 'cnic_back', 'law_degree', 'profile_photo');

-- CreateEnum
CREATE TYPE "lawyer_doc_status" AS ENUM ('submitted', 'verified', 'issue_found');

-- CreateEnum
CREATE TYPE "chat_sender" AS ENUM ('user', 'ai');

-- CreateEnum
CREATE TYPE "feedback_rating" AS ENUM ('up', 'down');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('uploaded', 'processing', 'analysis_complete', 'processing_failed', 'low_confidence');

-- CreateEnum
CREATE TYPE "case_type" AS ENUM ('Civil', 'Criminal', 'Family', 'Property', 'Corporate', 'Constitutional', 'Other');

-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "consultation_status" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('sent', 'delivered', 'read');

-- CreateEnum
CREATE TYPE "report_type" AS ENUM ('conversation', 'profile', 'review');

-- CreateEnum
CREATE TYPE "report_priority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "txn_status" AS ENUM ('paid', 'pending');

-- CreateEnum
CREATE TYPE "payout_method_type" AS ENUM ('bank', 'easypaisa', 'jazzcash');

-- CreateEnum
CREATE TYPE "payout_status" AS ENUM ('requested', 'processing', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('super_admin', 'moderator', 'analyst');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "user_role" NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "profile_photo_url" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'pending',
    "province" "province",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),
    "deactivated_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "full_legal_name" TEXT NOT NULL,
    "cnic_encrypted" TEXT NOT NULL,
    "cnic_last4" CHAR(4),
    "bar_council_number" TEXT NOT NULL,
    "province" "province" NOT NULL,
    "city" TEXT NOT NULL,
    "years_experience_band" "experience_band" NOT NULL,
    "practice_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consultation_fee_pkr" INTEGER NOT NULL,
    "bio" TEXT NOT NULL,
    "verification_status" "verification_status" NOT NULL DEFAULT 'pending',
    "show_win_loss_stats" BOOLEAN NOT NULL DEFAULT false,
    "availability" "availability_status" NOT NULL DEFAULT 'offline',
    "max_active_consultations" INTEGER NOT NULL DEFAULT 10,
    "auto_decline_when_offline" BOOLEAN NOT NULL DEFAULT false,
    "rating_avg" DECIMAL(2,1) NOT NULL DEFAULT 0.0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "wl_total" INTEGER NOT NULL DEFAULT 0,
    "wl_won" INTEGER NOT NULL DEFAULT 0,
    "wl_lost" INTEGER NOT NULL DEFAULT 0,
    "wl_ongoing" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lawyer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lawyer_profile_id" UUID NOT NULL,
    "doc_type" "lawyer_doc_type" NOT NULL,
    "file_url" TEXT NOT NULL,
    "status" "lawyer_doc_status" NOT NULL DEFAULT 'submitted',
    "issue_note" TEXT,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lawyer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "sender" "chat_sender" NOT NULL,
    "text" TEXT NOT NULL,
    "citations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feedback" "feedback_rating",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'uploaded',
    "upload_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_analyses" (
    "document_id" UUID NOT NULL,
    "case_type" "case_type",
    "summary" TEXT,
    "entities" JSONB NOT NULL DEFAULT '[]',
    "overall_confidence" DECIMAL(4,3),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_analyses_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "consultation_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "lawyer_id" UUID NOT NULL,
    "case_type" "case_type" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'pending',
    "decline_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "consultation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "lawyer_id" UUID NOT NULL,
    "request_id" UUID,
    "status" "consultation_status" NOT NULL DEFAULT 'active',
    "case_type" "case_type" NOT NULL,
    "case_notes" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "text" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "delivery_status" "delivery_status" NOT NULL DEFAULT 'sent',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,
    "lawyer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "text" TEXT,
    "case_type" "case_type" NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "removal_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID NOT NULL,
    "reported_party_id" UUID NOT NULL,
    "type" "report_type" NOT NULL,
    "reason_category" TEXT NOT NULL,
    "reason_text" TEXT NOT NULL,
    "priority" "report_priority" NOT NULL DEFAULT 'low',
    "status" "report_status" NOT NULL DEFAULT 'open',
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,
    "lawyer_id" UUID NOT NULL,
    "fee_pkr" INTEGER NOT NULL,
    "platform_fee_percent" DECIMAL(5,2) NOT NULL,
    "net_earned_pkr" INTEGER NOT NULL,
    "status" "txn_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lawyer_id" UUID NOT NULL,
    "type" "payout_method_type" NOT NULL,
    "details" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lawyer_id" UUID NOT NULL,
    "amount_pkr" INTEGER NOT NULL,
    "method_id" UUID,
    "status" "payout_status" NOT NULL DEFAULT 'requested',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "admin_role" NOT NULL,
    "two_factor_secret" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_username" CITEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "target_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" BOOLEAN NOT NULL DEFAULT true,
    "practice_areas" JSONB NOT NULL DEFAULT '[]',
    "chatbot_disclaimer_text" TEXT NOT NULL,
    "platform_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "email_templates" JSONB NOT NULL DEFAULT '{}',
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_areas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "practice_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "rotated_from" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device" TEXT,
    "browser" TEXT,
    "ip" INET,
    "city" TEXT,
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT,
    "ip" INET NOT NULL,
    "successful" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_profiles_user_id_key" ON "lawyer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "idx_lawyer_documents_profile" ON "lawyer_documents"("lawyer_profile_id");

-- CreateIndex
CREATE INDEX "idx_chat_sessions_user" ON "chat_sessions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_chat_messages_session" ON "chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_documents_user" ON "documents"("user_id", "upload_date" DESC);

-- CreateIndex
CREATE INDEX "idx_requests_lawyer_status" ON "consultation_requests"("lawyer_id", "status");

-- CreateIndex
CREATE INDEX "idx_requests_user_status" ON "consultation_requests"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_request_id_key" ON "consultations"("request_id");

-- CreateIndex
CREATE INDEX "idx_consultations_user" ON "consultations"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_consultations_lawyer" ON "consultations"("lawyer_id", "status");

-- CreateIndex
CREATE INDEX "idx_messages_consultation" ON "messages"("consultation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_consultation_id_key" ON "reviews"("consultation_id");

-- CreateIndex
CREATE INDEX "idx_reports_status_priority" ON "reports"("status", "priority");

-- CreateIndex
CREATE INDEX "idx_notifications_user_unread" ON "notifications"("user_id", "read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_transactions_lawyer" ON "transactions"("lawyer_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_accounts_username_key" ON "admin_accounts"("username");

-- CreateIndex
CREATE INDEX "idx_audit_logs_username" ON "audit_logs"("admin_username", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "practice_areas_name_key" ON "practice_areas"("name");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_sessions_user" ON "sessions"("user_id", "last_active_at" DESC);

-- CreateIndex
CREATE INDEX "idx_login_attempts_email_ip" ON "login_attempts"("email", "ip", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "lawyer_profiles" ADD CONSTRAINT "lawyer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_documents" ADD CONSTRAINT "lawyer_documents_lawyer_profile_id_fkey" FOREIGN KEY ("lawyer_profile_id") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_analyses" ADD CONSTRAINT "document_analyses_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "consultation_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_party_id_fkey" FOREIGN KEY ("reported_party_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_methods" ADD CONSTRAINT "payout_methods_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "payout_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_rotated_from_fkey" FOREIGN KEY ("rotated_from") REFERENCES "refresh_tokens"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Hand-written additions (not expressible in the Prisma schema).
-- ============================================================================

-- CHECK constraints (CLAUDE.md §4 approved DDL)
ALTER TABLE "lawyer_profiles"
  ADD CONSTRAINT "chk_lawyer_fee_nonneg" CHECK ("consultation_fee_pkr" >= 0),
  ADD CONSTRAINT "chk_lawyer_bio_min" CHECK (char_length("bio") >= 200),
  ADD CONSTRAINT "chk_lawyer_max_active" CHECK ("max_active_consultations" BETWEEN 1 AND 50),
  ADD CONSTRAINT "chk_lawyer_rating_range" CHECK ("rating_avg" BETWEEN 0 AND 5);

ALTER TABLE "document_analyses"
  ADD CONSTRAINT "chk_analysis_confidence" CHECK ("overall_confidence" BETWEEN 0 AND 1);

ALTER TABLE "consultation_requests"
  ADD CONSTRAINT "chk_request_desc_len" CHECK (char_length("description") <= 500);

ALTER TABLE "reviews"
  ADD CONSTRAINT "chk_review_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "chk_review_text_len" CHECK ("text" IS NULL OR char_length("text") <= 500);

ALTER TABLE "transactions"
  ADD CONSTRAINT "chk_txn_fee_nonneg" CHECK ("fee_pkr" >= 0),
  ADD CONSTRAINT "chk_txn_net_nonneg" CHECK ("net_earned_pkr" >= 0);

ALTER TABLE "payouts"
  ADD CONSTRAINT "chk_payout_amount_nonneg" CHECK ("amount_pkr" >= 0);

-- Singleton guard for system_config (only one row, id = TRUE)
ALTER TABLE "system_config"
  ADD CONSTRAINT "chk_system_config_singleton" CHECK ("id" = TRUE);

-- Partial UNIQUE indexes
-- Bar Council number unique among VERIFIED lawyers only (§14)
CREATE UNIQUE INDEX "uq_bar_council_verified"
  ON "lawyer_profiles" ("bar_council_number")
  WHERE "verification_status" = 'verified';

-- At most one default payout method per lawyer (§10.6)
CREATE UNIQUE INDEX "uq_default_payout_per_lawyer"
  ON "payout_methods" ("lawyer_id")
  WHERE "is_default" = TRUE;

-- Append-only audit log (§12.9): block UPDATE and DELETE for everyone.
CREATE OR REPLACE FUNCTION "audit_logs_block_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_audit_logs_no_update"
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_block_mutation"();

CREATE TRIGGER "trg_audit_logs_no_delete"
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_block_mutation"();
