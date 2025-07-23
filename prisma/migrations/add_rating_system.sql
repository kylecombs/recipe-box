-- Add rating tables for recipes and meal plans

-- Create RecipeRating table
CREATE TABLE RecipeRating (
    id VARCHAR(191) NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    userId VARCHAR(191) NOT NULL,
    recipeId VARCHAR(191) NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,
    
    PRIMARY KEY (id),
    UNIQUE(userId, recipeId),
    INDEX RecipeRating_recipeId_fkey (recipeId),
    INDEX RecipeRating_userId_fkey (userId),
    
    FOREIGN KEY (recipeId) REFERENCES Recipe(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create MealPlanRating table
CREATE TABLE MealPlanRating (
    id VARCHAR(191) NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    userId VARCHAR(191) NOT NULL,
    mealPlanId VARCHAR(191) NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,
    
    PRIMARY KEY (id),
    UNIQUE(userId, mealPlanId),
    INDEX MealPlanRating_mealPlanId_fkey (mealPlanId),
    INDEX MealPlanRating_userId_fkey (userId),
    
    FOREIGN KEY (mealPlanId) REFERENCES MealPlan(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
);