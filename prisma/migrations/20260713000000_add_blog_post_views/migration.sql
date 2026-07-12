-- CreateTable
CREATE TABLE "BlogPostView" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogPostView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlogPostView_postId_idx" ON "BlogPostView"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostView_postId_visitorId_key" ON "BlogPostView"("postId", "visitorId");

-- AddForeignKey
ALTER TABLE "BlogPostView" ADD CONSTRAINT "BlogPostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
