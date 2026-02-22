-- CreateTable
CREATE TABLE "DocumentView" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "rawImageId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentView_staffId_idx" ON "DocumentView"("staffId");

-- CreateIndex
CREATE INDEX "DocumentView_rawImageId_idx" ON "DocumentView"("rawImageId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentView_staffId_rawImageId_key" ON "DocumentView"("staffId", "rawImageId");

-- AddForeignKey
ALTER TABLE "DocumentView" ADD CONSTRAINT "DocumentView_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentView" ADD CONSTRAINT "DocumentView_rawImageId_fkey" FOREIGN KEY ("rawImageId") REFERENCES "RawImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
