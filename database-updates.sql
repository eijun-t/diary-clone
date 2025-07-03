-- Allow null values for mood column in diaries table
ALTER TABLE diaries ALTER COLUMN mood DROP NOT NULL;