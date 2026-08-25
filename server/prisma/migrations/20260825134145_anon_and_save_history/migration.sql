-- CreateTable
CREATE TABLE "SaveHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaveHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SaveData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 2,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SaveData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SaveData" ("data", "id", "updatedAt", "userId") SELECT "data", "id", "updatedAt", "userId" FROM "SaveData";
DROP TABLE "SaveData";
ALTER TABLE "new_SaveData" RENAME TO "SaveData";
CREATE UNIQUE INDEX "SaveData_userId_key" ON "SaveData"("userId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("createdAt", "id", "passwordHash", "username") SELECT "createdAt", "id", "passwordHash", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SaveHistory_userId_createdAt_idx" ON "SaveHistory"("userId", "createdAt");
