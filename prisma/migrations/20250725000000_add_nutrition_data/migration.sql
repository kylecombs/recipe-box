-- CreateTable
CREATE TABLE `RecipeNutrition` (
    `id` VARCHAR(191) NOT NULL,
    `recipeId` VARCHAR(191) NOT NULL,
    `servings` INTEGER NOT NULL,
    `totalCalories` DOUBLE NOT NULL,
    `totalProtein` DOUBLE NOT NULL,
    `totalCarbs` DOUBLE NOT NULL,
    `totalFat` DOUBLE NOT NULL,
    `totalFiber` DOUBLE NOT NULL,
    `totalSugar` DOUBLE NOT NULL,
    `totalSodium` DOUBLE NOT NULL,
    `totalCholesterol` DOUBLE NOT NULL,
    `totalVitaminC` DOUBLE NOT NULL,
    `totalCalcium` DOUBLE NOT NULL,
    `totalIron` DOUBLE NOT NULL,
    `perServingCalories` DOUBLE NOT NULL,
    `perServingProtein` DOUBLE NOT NULL,
    `perServingCarbs` DOUBLE NOT NULL,
    `perServingFat` DOUBLE NOT NULL,
    `perServingFiber` DOUBLE NOT NULL,
    `perServingSugar` DOUBLE NOT NULL,
    `perServingSodium` DOUBLE NOT NULL,
    `perServingCholesterol` DOUBLE NOT NULL,
    `perServingVitaminC` DOUBLE NOT NULL,
    `perServingCalcium` DOUBLE NOT NULL,
    `perServingIron` DOUBLE NOT NULL,
    `analyzedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confidence` DOUBLE NOT NULL DEFAULT 0.8,

    UNIQUE INDEX `RecipeNutrition_recipeId_key`(`recipeId`),
    INDEX `RecipeNutrition_recipeId_fkey`(`recipeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RecipeNutrition` ADD CONSTRAINT `RecipeNutrition_recipeId_fkey` FOREIGN KEY (`recipeId`) REFERENCES `Recipe`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;