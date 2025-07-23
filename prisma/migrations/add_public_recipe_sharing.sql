-- Add public recipe sharing functionality

-- Add public recipe fields to Recipe table
ALTER TABLE Recipe 
ADD COLUMN isPublic BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN publishedAt DATETIME(3) NULL,
ADD COLUMN saveCount INT NOT NULL DEFAULT 0;

-- Add indexes for public recipe queries
CREATE INDEX Recipe_isPublic_idx ON Recipe(isPublic);
CREATE INDEX Recipe_saveCount_idx ON Recipe(saveCount);

-- Add field to track if user saved from public recipes
ALTER TABLE UserRecipe 
ADD COLUMN savedFromPublic BOOLEAN NOT NULL DEFAULT FALSE;