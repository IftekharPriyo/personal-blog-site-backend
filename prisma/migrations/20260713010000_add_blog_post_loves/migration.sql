-- CreateTable
CREATE TABLE "BlogPostLove" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogPostLove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlogPostLove_postId_idx" ON "BlogPostLove"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostLove_postId_visitorId_key" ON "BlogPostLove"("postId", "visitorId");

-- AddForeignKey
ALTER TABLE "BlogPostLove" ADD CONSTRAINT "BlogPostLove_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
