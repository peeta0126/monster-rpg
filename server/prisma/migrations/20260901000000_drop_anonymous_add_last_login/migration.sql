-- 「바로 시작」(익명 계정)을 걷어냈다. 모든 계정은 아이디·비밀번호로 만들어지므로
-- isAnonymous 는 항상 false 인 열이 된다. 대신 마지막 로그인 시각을 남긴다 —
-- 세이브 시각만으로는 "들어왔다가 아무것도 안 하고 나간" 사람이 안 보인다.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME
);
INSERT INTO "new_User" ("createdAt", "id", "passwordHash", "username") SELECT "createdAt", "id", "passwordHash", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
