ALTER TABLE "monsters"
    DROP COLUMN "description",
    ADD COLUMN "skill" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "personality" TEXT NOT NULL DEFAULT '';
