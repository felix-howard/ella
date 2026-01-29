-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TaxCaseStatus" AS ENUM ('INTAKE', 'WAITING_DOCS', 'IN_PROGRESS', 'READY_FOR_ENTRY', 'ENTRY_COMPLETE', 'REVIEW', 'FILED');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('FORM_1040', 'FORM_1120S', 'FORM_1065');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('SSN_CARD', 'DRIVER_LICENSE', 'PASSPORT', 'BIRTH_CERTIFICATE', 'ITIN_LETTER', 'W2', 'W2G', 'FORM_1099_INT', 'FORM_1099_DIV', 'FORM_1099_NEC', 'FORM_1099_MISC', 'FORM_1099_K', 'FORM_1099_R', 'FORM_1099_G', 'FORM_1099_SSA', 'FORM_1099_B', 'FORM_1099_S', 'FORM_1099_C', 'FORM_1099_SA', 'FORM_1099_Q', 'SCHEDULE_K1', 'SCHEDULE_K1_1065', 'SCHEDULE_K1_1120S', 'SCHEDULE_K1_1041', 'FORM_1095_A', 'FORM_1095_B', 'FORM_1095_C', 'FORM_5498_SA', 'FORM_1098_T', 'FORM_1098_E', 'FORM_1098', 'FORM_8332', 'BANK_STATEMENT', 'PROFIT_LOSS_STATEMENT', 'BALANCE_SHEET', 'BUSINESS_LICENSE', 'EIN_LETTER', 'ARTICLES_OF_INCORPORATION', 'OPERATING_AGREEMENT', 'PAYROLL_REPORT', 'DEPRECIATION_SCHEDULE', 'VEHICLE_MILEAGE_LOG', 'RECEIPT', 'DAYCARE_RECEIPT', 'CHARITY_RECEIPT', 'MEDICAL_RECEIPT', 'PROPERTY_TAX_STATEMENT', 'ESTIMATED_TAX_PAYMENT', 'PRIOR_YEAR_RETURN', 'IRS_NOTICE', 'CRYPTO_STATEMENT', 'FOREIGN_BANK_STATEMENT', 'FOREIGN_TAX_STATEMENT', 'FBAR_SUPPORT_DOCS', 'FORM_8938', 'CLOSING_DISCLOSURE', 'LEASE_AGREEMENT', 'EV_PURCHASE_AGREEMENT', 'ENERGY_CREDIT_INVOICE', 'FORM_W9_ISSUED', 'MORTGAGE_POINTS_STATEMENT', 'EXTENSION_PAYMENT_PROOF', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RawImageStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'CLASSIFIED', 'LINKED', 'BLURRY', 'UNCLASSIFIED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "DigitalDocStatus" AS ENUM ('PENDING', 'EXTRACTED', 'VERIFIED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('MISSING', 'HAS_RAW', 'HAS_DIGITAL', 'VERIFIED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('VERIFY_DOCS', 'AI_FAILED', 'BLURRY_DETECTED', 'READY_FOR_ENTRY', 'REMINDER_DUE', 'CLIENT_REPLIED');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'PORTAL', 'SYSTEM', 'CALL');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'STAFF', 'CPA');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('VI', 'EN');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('BOOLEAN', 'SELECT', 'NUMBER', 'NUMBER_INPUT', 'CURRENCY', 'TEXT');

-- CreateEnum
CREATE TYPE "MessageTemplateCategory" AS ENUM ('WELCOME', 'REMINDER', 'MISSING', 'BLURRY', 'COMPLETE', 'GENERAL');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocCategory" AS ENUM ('IDENTITY', 'INCOME', 'EXPENSE', 'ASSET', 'EDUCATION', 'HEALTHCARE', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('CLIENT', 'CLIENT_PROFILE', 'TAX_CASE', 'TAX_ENGAGEMENT');

-- CreateEnum
CREATE TYPE "MagicLinkType" AS ENUM ('PORTAL', 'SCHEDULE_C');

-- CreateEnum
CREATE TYPE "ScheduleCStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'STAFF',
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPresence" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "language" "Language" NOT NULL DEFAULT 'VI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "filingStatus" TEXT,
    "hasW2" BOOLEAN NOT NULL DEFAULT false,
    "hasBankAccount" BOOLEAN NOT NULL DEFAULT false,
    "hasInvestments" BOOLEAN NOT NULL DEFAULT false,
    "hasKidsUnder17" BOOLEAN NOT NULL DEFAULT false,
    "numKidsUnder17" INTEGER NOT NULL DEFAULT 0,
    "paysDaycare" BOOLEAN NOT NULL DEFAULT false,
    "hasKids17to24" BOOLEAN NOT NULL DEFAULT false,
    "hasSelfEmployment" BOOLEAN NOT NULL DEFAULT false,
    "hasRentalProperty" BOOLEAN NOT NULL DEFAULT false,
    "businessName" TEXT,
    "ein" TEXT,
    "hasEmployees" BOOLEAN NOT NULL DEFAULT false,
    "hasContractors" BOOLEAN NOT NULL DEFAULT false,
    "has1099K" BOOLEAN NOT NULL DEFAULT false,
    "intakeAnswers" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxEngagement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'DRAFT',
    "filingStatus" TEXT,
    "hasW2" BOOLEAN NOT NULL DEFAULT false,
    "hasBankAccount" BOOLEAN NOT NULL DEFAULT false,
    "hasInvestments" BOOLEAN NOT NULL DEFAULT false,
    "hasKidsUnder17" BOOLEAN NOT NULL DEFAULT false,
    "numKidsUnder17" INTEGER NOT NULL DEFAULT 0,
    "paysDaycare" BOOLEAN NOT NULL DEFAULT false,
    "hasKids17to24" BOOLEAN NOT NULL DEFAULT false,
    "hasSelfEmployment" BOOLEAN NOT NULL DEFAULT false,
    "hasRentalProperty" BOOLEAN NOT NULL DEFAULT false,
    "businessName" TEXT,
    "ein" TEXT,
    "hasEmployees" BOOLEAN NOT NULL DEFAULT false,
    "hasContractors" BOOLEAN NOT NULL DEFAULT false,
    "has1099K" BOOLEAN NOT NULL DEFAULT false,
    "intakeAnswers" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCase" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "taxTypes" "TaxType"[],
    "status" "TaxCaseStatus" NOT NULL DEFAULT 'INTAKE',
    "lastContactAt" TIMESTAMP(3),
    "entryCompletedAt" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "isInReview" BOOLEAN NOT NULL DEFAULT false,
    "isFiled" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawImage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "r2Url" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "RawImageStatus" NOT NULL DEFAULT 'UPLOADED',
    "classifiedType" "DocType",
    "category" "DocCategory",
    "displayName" VARCHAR(255),
    "aiConfidence" DOUBLE PRECISION,
    "blurScore" DOUBLE PRECISION,
    "imageHash" TEXT,
    "imageGroupId" TEXT,
    "reuploadRequested" BOOLEAN NOT NULL DEFAULT false,
    "reuploadRequestedAt" TIMESTAMP(3),
    "reuploadReason" TEXT,
    "reuploadFields" JSONB,
    "checklistItemId" TEXT,
    "uploadedVia" "MessageChannel" NOT NULL DEFAULT 'PORTAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageGroup" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "docType" "DocType" NOT NULL,
    "bestImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalDoc" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "rawImageId" TEXT NOT NULL,
    "docType" "DocType" NOT NULL,
    "status" "DigitalDocStatus" NOT NULL DEFAULT 'PENDING',
    "extractedData" JSONB NOT NULL,
    "aiConfidence" DOUBLE PRECISION,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "fieldVerifications" JSONB,
    "copiedFields" JSONB,
    "entryCompleted" BOOLEAN NOT NULL DEFAULT false,
    "entryCompletedAt" TIMESTAMP(3),
    "checklistItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "docType" "DocType" NOT NULL,
    "labelVi" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "descriptionVi" TEXT,
    "descriptionEn" TEXT,
    "hintVi" TEXT,
    "hintEn" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "condition" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL,
    "expectedCount" INTEGER NOT NULL DEFAULT 1,
    "docTypeLibraryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'MISSING',
    "expectedCount" INTEGER NOT NULL DEFAULT 1,
    "receivedCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isManuallyAdded" BOOLEAN NOT NULL DEFAULT false,
    "addedById" TEXT,
    "addedReason" TEXT,
    "skippedAt" TIMESTAMP(3),
    "skippedById" TEXT,
    "skippedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "content" VARCHAR(5000) NOT NULL,
    "twilioSid" TEXT,
    "twilioStatus" TEXT,
    "attachmentUrls" TEXT[],
    "attachmentR2Keys" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "templateUsed" TEXT,
    "callSid" TEXT,
    "recordingUrl" TEXT,
    "recordingDuration" INTEGER,
    "callStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLink" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" "MagicLinkType" NOT NULL DEFAULT 'PORTAL',
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "ActionType" NOT NULL,
    "priority" "ActionPriority" NOT NULL DEFAULT 'NORMAL',
    "assignedToId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeQuestion" (
    "id" TEXT NOT NULL,
    "taxTypes" "TaxType"[],
    "questionKey" TEXT NOT NULL,
    "labelVi" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "hintVi" TEXT,
    "hintEn" TEXT,
    "fieldType" "FieldType" NOT NULL,
    "options" TEXT,
    "condition" TEXT,
    "section" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocTypeLibrary" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelVi" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "descriptionVi" TEXT,
    "descriptionEn" TEXT,
    "category" TEXT NOT NULL,
    "aliases" TEXT[],
    "keywords" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocTypeLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "category" "MessageTemplateCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "placeholders" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleCExpense" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "status" "ScheduleCStatus" NOT NULL DEFAULT 'DRAFT',
    "businessName" VARCHAR(200),
    "businessDesc" VARCHAR(500),
    "grossReceipts" DECIMAL(12,2),
    "returns" DECIMAL(12,2),
    "costOfGoods" DECIMAL(12,2),
    "otherIncome" DECIMAL(12,2),
    "advertising" DECIMAL(12,2),
    "carExpense" DECIMAL(12,2),
    "commissions" DECIMAL(12,2),
    "contractLabor" DECIMAL(12,2),
    "depletion" DECIMAL(12,2),
    "depreciation" DECIMAL(12,2),
    "employeeBenefits" DECIMAL(12,2),
    "insurance" DECIMAL(12,2),
    "interestMortgage" DECIMAL(12,2),
    "interestOther" DECIMAL(12,2),
    "legalServices" DECIMAL(12,2),
    "officeExpense" DECIMAL(12,2),
    "pensionPlans" DECIMAL(12,2),
    "rentEquipment" DECIMAL(12,2),
    "rentProperty" DECIMAL(12,2),
    "repairs" DECIMAL(12,2),
    "supplies" DECIMAL(12,2),
    "taxesAndLicenses" DECIMAL(12,2),
    "travel" DECIMAL(12,2),
    "meals" DECIMAL(12,2),
    "utilities" DECIMAL(12,2),
    "wages" DECIMAL(12,2),
    "otherExpenses" DECIMAL(12,2),
    "otherExpensesNotes" VARCHAR(1000),
    "vehicleMiles" INTEGER,
    "vehicleCommuteMiles" INTEGER,
    "vehicleOtherMiles" INTEGER,
    "vehicleDateInService" TIMESTAMP(3),
    "vehicleUsedForCommute" BOOLEAN NOT NULL DEFAULT false,
    "vehicleAnotherAvailable" BOOLEAN NOT NULL DEFAULT false,
    "vehicleEvidenceWritten" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionHistory" JSONB NOT NULL DEFAULT '[]',
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleCExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_clerkId_key" ON "Staff"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE INDEX "Staff_clerkId_idx" ON "Staff"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPresence_staffId_key" ON "StaffPresence"("staffId");

-- CreateIndex
CREATE INDEX "StaffPresence_isOnline_idx" ON "StaffPresence"("isOnline");

-- CreateIndex
CREATE UNIQUE INDEX "Client_phone_key" ON "Client"("phone");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_clientId_key" ON "ClientProfile"("clientId");

-- CreateIndex
CREATE INDEX "TaxEngagement_clientId_idx" ON "TaxEngagement"("clientId");

-- CreateIndex
CREATE INDEX "TaxEngagement_taxYear_idx" ON "TaxEngagement"("taxYear");

-- CreateIndex
CREATE INDEX "TaxEngagement_status_idx" ON "TaxEngagement"("status");

-- CreateIndex
CREATE INDEX "TaxEngagement_clientId_status_idx" ON "TaxEngagement"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaxEngagement_clientId_taxYear_key" ON "TaxEngagement"("clientId", "taxYear");

-- CreateIndex
CREATE INDEX "TaxCase_status_idx" ON "TaxCase"("status");

-- CreateIndex
CREATE INDEX "TaxCase_taxYear_idx" ON "TaxCase"("taxYear");

-- CreateIndex
CREATE INDEX "TaxCase_status_taxYear_idx" ON "TaxCase"("status", "taxYear");

-- CreateIndex
CREATE INDEX "TaxCase_clientId_status_idx" ON "TaxCase"("clientId", "status");

-- CreateIndex
CREATE INDEX "TaxCase_lastActivityAt_idx" ON "TaxCase"("lastActivityAt");

-- CreateIndex
CREATE INDEX "TaxCase_isInReview_idx" ON "TaxCase"("isInReview");

-- CreateIndex
CREATE INDEX "TaxCase_isFiled_idx" ON "TaxCase"("isFiled");

-- CreateIndex
CREATE INDEX "TaxCase_engagementId_idx" ON "TaxCase"("engagementId");

-- CreateIndex
CREATE INDEX "TaxCase_engagementId_status_idx" ON "TaxCase"("engagementId", "status");

-- CreateIndex
CREATE INDEX "TaxCase_engagementId_lastActivityAt_idx" ON "TaxCase"("engagementId", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCase_clientId_taxYear_key" ON "TaxCase"("clientId", "taxYear");

-- CreateIndex
CREATE UNIQUE INDEX "RawImage_r2Key_key" ON "RawImage"("r2Key");

-- CreateIndex
CREATE INDEX "RawImage_caseId_idx" ON "RawImage"("caseId");

-- CreateIndex
CREATE INDEX "RawImage_status_idx" ON "RawImage"("status");

-- CreateIndex
CREATE INDEX "RawImage_category_idx" ON "RawImage"("category");

-- CreateIndex
CREATE INDEX "RawImage_imageGroupId_idx" ON "RawImage"("imageGroupId");

-- CreateIndex
CREATE INDEX "RawImage_caseId_classifiedType_idx" ON "RawImage"("caseId", "classifiedType");

-- CreateIndex
CREATE INDEX "RawImage_reuploadRequested_idx" ON "RawImage"("reuploadRequested");

-- CreateIndex
CREATE INDEX "RawImage_caseId_reuploadRequested_idx" ON "RawImage"("caseId", "reuploadRequested");

-- CreateIndex
CREATE INDEX "ImageGroup_caseId_idx" ON "ImageGroup"("caseId");

-- CreateIndex
CREATE INDEX "ImageGroup_caseId_docType_idx" ON "ImageGroup"("caseId", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalDoc_rawImageId_key" ON "DigitalDoc"("rawImageId");

-- CreateIndex
CREATE INDEX "DigitalDoc_caseId_idx" ON "DigitalDoc"("caseId");

-- CreateIndex
CREATE INDEX "DigitalDoc_docType_idx" ON "DigitalDoc"("docType");

-- CreateIndex
CREATE INDEX "DigitalDoc_status_idx" ON "DigitalDoc"("status");

-- CreateIndex
CREATE INDEX "DigitalDoc_entryCompleted_idx" ON "DigitalDoc"("entryCompleted");

-- CreateIndex
CREATE INDEX "DigitalDoc_caseId_entryCompleted_idx" ON "DigitalDoc"("caseId", "entryCompleted");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_taxType_idx" ON "ChecklistTemplate"("taxType");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_category_idx" ON "ChecklistTemplate"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_taxType_docType_key" ON "ChecklistTemplate"("taxType", "docType");

-- CreateIndex
CREATE INDEX "ChecklistItem_caseId_idx" ON "ChecklistItem"("caseId");

-- CreateIndex
CREATE INDEX "ChecklistItem_status_idx" ON "ChecklistItem"("status");

-- CreateIndex
CREATE INDEX "ChecklistItem_caseId_status_idx" ON "ChecklistItem"("caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_caseId_templateId_key" ON "ChecklistItem"("caseId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_caseId_key" ON "Conversation"("caseId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_createdAt_idx" ON "Conversation"("lastMessageAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_twilioSid_key" ON "Message"("twilioSid");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Message_callSid_idx" ON "Message"("callSid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLink_token_key" ON "MagicLink"("token");

-- CreateIndex
CREATE INDEX "MagicLink_token_idx" ON "MagicLink"("token");

-- CreateIndex
CREATE INDEX "MagicLink_caseId_idx" ON "MagicLink"("caseId");

-- CreateIndex
CREATE INDEX "MagicLink_caseId_isActive_createdAt_idx" ON "MagicLink"("caseId", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "MagicLink_type_idx" ON "MagicLink"("type");

-- CreateIndex
CREATE INDEX "MagicLink_caseId_type_isActive_idx" ON "MagicLink"("caseId", "type", "isActive");

-- CreateIndex
CREATE INDEX "Action_caseId_idx" ON "Action"("caseId");

-- CreateIndex
CREATE INDEX "Action_type_idx" ON "Action"("type");

-- CreateIndex
CREATE INDEX "Action_priority_idx" ON "Action"("priority");

-- CreateIndex
CREATE INDEX "Action_isCompleted_idx" ON "Action"("isCompleted");

-- CreateIndex
CREATE INDEX "Action_assignedToId_idx" ON "Action"("assignedToId");

-- CreateIndex
CREATE INDEX "Action_isCompleted_priority_idx" ON "Action"("isCompleted", "priority");

-- CreateIndex
CREATE INDEX "Action_assignedToId_isCompleted_idx" ON "Action"("assignedToId", "isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeQuestion_questionKey_key" ON "IntakeQuestion"("questionKey");

-- CreateIndex
CREATE INDEX "IntakeQuestion_isActive_idx" ON "IntakeQuestion"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DocTypeLibrary_code_key" ON "DocTypeLibrary"("code");

-- CreateIndex
CREATE INDEX "DocTypeLibrary_category_idx" ON "DocTypeLibrary"("category");

-- CreateIndex
CREATE INDEX "DocTypeLibrary_isActive_idx" ON "DocTypeLibrary"("isActive");

-- CreateIndex
CREATE INDEX "MessageTemplate_category_idx" ON "MessageTemplate"("category");

-- CreateIndex
CREATE INDEX "MessageTemplate_isActive_idx" ON "MessageTemplate"("isActive");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_changedById_idx" ON "AuditLog"("changedById");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleCExpense_taxCaseId_key" ON "ScheduleCExpense"("taxCaseId");

-- CreateIndex
CREATE INDEX "ScheduleCExpense_status_idx" ON "ScheduleCExpense"("status");

-- CreateIndex
CREATE INDEX "ScheduleCExpense_taxCaseId_status_idx" ON "ScheduleCExpense"("taxCaseId", "status");

-- AddForeignKey
ALTER TABLE "StaffPresence" ADD CONSTRAINT "StaffPresence_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEngagement" ADD CONSTRAINT "TaxEngagement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCase" ADD CONSTRAINT "TaxCase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCase" ADD CONSTRAINT "TaxCase_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "TaxEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawImage" ADD CONSTRAINT "RawImage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawImage" ADD CONSTRAINT "RawImage_imageGroupId_fkey" FOREIGN KEY ("imageGroupId") REFERENCES "ImageGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawImage" ADD CONSTRAINT "RawImage_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageGroup" ADD CONSTRAINT "ImageGroup_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalDoc" ADD CONSTRAINT "DigitalDoc_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalDoc" ADD CONSTRAINT "DigitalDoc_rawImageId_fkey" FOREIGN KEY ("rawImageId") REFERENCES "RawImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalDoc" ADD CONSTRAINT "DigitalDoc_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_docTypeLibraryId_fkey" FOREIGN KEY ("docTypeLibraryId") REFERENCES "DocTypeLibrary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_skippedById_fkey" FOREIGN KEY ("skippedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleCExpense" ADD CONSTRAINT "ScheduleCExpense_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

