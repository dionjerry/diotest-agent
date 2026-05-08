-- CreateEnum
CREATE TYPE "RepositoryProvider" AS ENUM ('GITHUB', 'GITLAB');

-- CreateTable
CREATE TABLE "RepositoryConnection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "RepositoryProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "namespace" TEXT,
    "repositoryName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "repositoryUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "installationId" TEXT,
    "providerUser" TEXT,
    "webhookId" TEXT,
    "webhookStatus" TEXT NOT NULL DEFAULT 'pending',
    "webhookUrl" TEXT,
    "webhookLastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RepositoryConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryConnection_projectId_key" ON "RepositoryConnection"("projectId");

-- AddForeignKey
ALTER TABLE "RepositoryConnection" ADD CONSTRAINT "RepositoryConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration from legacy GitHub-only connections
INSERT INTO "RepositoryConnection" (
  "id",
  "projectId",
  "provider",
  "externalId",
  "owner",
  "namespace",
  "repositoryName",
  "fullName",
  "repositoryUrl",
  "defaultBranch",
  "installationId",
  "providerUser",
  "webhookStatus",
  "createdAt",
  "updatedAt"
)
SELECT
  gc."id",
  gc."projectId",
  'GITHUB'::"RepositoryProvider",
  COALESCE(gc."installationId", gc."repositoryOwner" || '/' || gc."repositoryName"),
  gc."repositoryOwner",
  gc."repositoryOwner",
  gc."repositoryName",
  gc."repositoryOwner" || '/' || gc."repositoryName",
  'https://github.com/' || gc."repositoryOwner" || '/' || gc."repositoryName",
  gc."defaultBranch",
  gc."installationId",
  NULL,
  gc."webhookStatus",
  gc."createdAt",
  gc."updatedAt"
FROM "GithubConnection" gc
ON CONFLICT ("projectId") DO NOTHING;
