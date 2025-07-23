-- AlterTable
ALTER TABLE `Ingredient` ADD COLUMN `original` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable  
ALTER TABLE `Recipe` ADD COLUMN `instructions` TEXT NULL;

-- Update existing ingredients to have original text from name
UPDATE `Ingredient` SET `original` = `name` WHERE `original` = '';