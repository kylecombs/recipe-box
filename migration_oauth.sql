-- Add OAuth support migration

-- Make password optional for OAuth users
ALTER TABLE `User` MODIFY COLUMN `password` VARCHAR(191);

-- Create OAuthAccount table
CREATE TABLE `OAuthAccount` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerUserId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT,
    `refreshToken` TEXT,
    `tokenExpiry` DATETIME(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    UNIQUE KEY `OAuthAccount_provider_providerUserId_key` (`provider`, `providerUserId`),
    INDEX `OAuthAccount_userId_idx` (`userId`),
    CONSTRAINT `OAuthAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;