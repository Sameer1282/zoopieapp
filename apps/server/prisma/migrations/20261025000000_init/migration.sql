-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'BANNED');

-- CreateEnum
CREATE TYPE "ConversationMode" AS ENUM ('VIDEO', 'TEXT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "TerminationReason" AS ENUM ('NORMAL_DISCONNECT', 'PEER_DISCONNECT', 'SKIP', 'REPORT', 'TIMEOUT', 'NETWORK_ERROR');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('INAPPROPRIATE_CONTENT', 'HARASSMENT', 'UNDERAGE_SUSPICION', 'SPAM_OR_BOT', 'HATE_SPEECH', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'DISMISSED', 'ACTION_TAKEN');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('WARNING', 'TEMPORARY_BAN', 'PERMANENT_BAN', 'SESSION_TERMINATION', 'DISMISS');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPERADMIN', 'MODERATOR', 'AUDITOR');

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "fingerprint_hash" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "banned_until" TIMESTAMP(3),
    "ban_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "mode" "ConversationMode" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "termination_reason" "TerminationReason",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" TEXT NOT NULL,
    "blocker_session_id" TEXT NOT NULL,
    "blocked_fingerprint" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abuse_reports" (
    "id" TEXT NOT NULL,
    "reporter_session_id" TEXT NOT NULL,
    "reported_fingerprint" TEXT NOT NULL,
    "conversation_id" TEXT,
    "category" "ReportCategory" NOT NULL,
    "details" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "report_id" TEXT,
    "target_fingerprint" TEXT NOT NULL,
    "action_type" "ModerationActionType" NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'MODERATOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_curated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interest_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_sessions_fingerprint_hash_idx" ON "user_sessions"("fingerprint_hash");

-- CreateIndex
CREATE INDEX "user_sessions_is_banned_banned_until_idx" ON "user_sessions"("is_banned", "banned_until");

-- CreateIndex
CREATE INDEX "user_sessions_created_at_idx" ON "user_sessions"("created_at");

-- CreateIndex
CREATE INDEX "conversations_mode_status_idx" ON "conversations"("mode", "status");

-- CreateIndex
CREATE INDEX "conversations_started_at_idx" ON "conversations"("started_at");

-- CreateIndex
CREATE INDEX "conversation_participants_session_id_idx" ON "conversation_participants"("session_id");

-- CreateIndex
CREATE INDEX "conversation_participants_conversation_id_idx" ON "conversation_participants"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_session_id_key" ON "conversation_participants"("conversation_id", "session_id");

-- CreateIndex
CREATE INDEX "user_blocks_blocked_fingerprint_idx" ON "user_blocks"("blocked_fingerprint");

-- CreateIndex
CREATE INDEX "user_blocks_blocker_session_id_idx" ON "user_blocks"("blocker_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blocker_session_id_blocked_fingerprint_key" ON "user_blocks"("blocker_session_id", "blocked_fingerprint");

-- CreateIndex
CREATE INDEX "abuse_reports_reported_fingerprint_status_idx" ON "abuse_reports"("reported_fingerprint", "status");

-- CreateIndex
CREATE INDEX "abuse_reports_status_created_at_idx" ON "abuse_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "abuse_reports_reporter_session_id_idx" ON "abuse_reports"("reporter_session_id");

-- CreateIndex
CREATE INDEX "moderation_actions_target_fingerprint_idx" ON "moderation_actions"("target_fingerprint");

-- CreateIndex
CREATE INDEX "moderation_actions_admin_id_idx" ON "moderation_actions"("admin_id");

-- CreateIndex
CREATE INDEX "moderation_actions_created_at_idx" ON "moderation_actions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_email_idx" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "interest_tags_name_key" ON "interest_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "interest_tags_slug_key" ON "interest_tags"("slug");

-- CreateIndex
CREATE INDEX "interest_tags_usage_count_idx" ON "interest_tags"("usage_count" DESC);

-- CreateIndex
CREATE INDEX "interest_tags_slug_idx" ON "interest_tags"("slug");

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_session_id_fkey" FOREIGN KEY ("blocker_session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reporter_session_id_fkey" FOREIGN KEY ("reporter_session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "abuse_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

