-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "videoPath" TEXT NOT NULL,
    "duration" REAL NOT NULL DEFAULT 0,
    "thumbnailPath" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "folder" TEXT,
    "filePath" TEXT NOT NULL,
    "duration" REAL NOT NULL DEFAULT 0,
    "thumbnailPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdMarker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "timestamp" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "winnerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdMarker_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarkerAd" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "markerId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MarkerAd_markerId_fkey" FOREIGN KEY ("markerId") REFERENCES "AdMarker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarkerAd_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MarkerAd_markerId_adId_key" ON "MarkerAd"("markerId", "adId");
