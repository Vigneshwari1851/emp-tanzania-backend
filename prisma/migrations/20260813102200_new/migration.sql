-- AlterTable
ALTER TABLE `exit_assets` ADD COLUMN `condition` VARCHAR(191) NULL,
    ADD COLUMN `return_date` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `exit_requests` ADD COLUMN `kt_assignee_id` INTEGER NULL,
    ADD COLUMN `kt_completion_date` DATETIME(3) NULL,
    ADD COLUMN `kt_description` TEXT NULL,
    ADD COLUMN `kt_remarks` TEXT NULL,
    ADD COLUMN `kt_status` VARCHAR(191) NULL,
    ADD COLUMN `kt_verified_by_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `leave_policies` ADD COLUMN `document_url` TEXT NULL,
    ADD COLUMN `requires_document` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `leave_requests` ADD COLUMN `attachment_url` TEXT NULL;

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `enable_shifts` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `session_token` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `login_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_active_at` DATETIME(3) NULL,

    UNIQUE INDEX `login_sessions_token_key`(`token`),
    INDEX `login_sessions_user_id_idx`(`user_id`),
    INDEX `login_sessions_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_change_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `requested_changes` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_MANAGER',
    `manager_id` INTEGER NULL,
    `manager_status` VARCHAR(191) NULL,
    `manager_note` TEXT NULL,
    `manager_actioned_at` DATETIME(3) NULL,
    `hr_id` INTEGER NULL,
    `hr_status` VARCHAR(191) NULL,
    `hr_note` TEXT NULL,
    `hr_actioned_at` DATETIME(3) NULL,
    `applied_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_change_requests_user_id_idx`(`user_id`),
    INDEX `employee_change_requests_status_idx`(`status`),
    INDEX `employee_change_requests_manager_id_idx`(`manager_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `message` TEXT NOT NULL,
    `category` VARCHAR(191) NULL DEFAULT 'general',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `feedback_user_id_idx`(`user_id`),
    INDEX `feedback_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `exit_requests_kt_assignee_id_fkey` ON `exit_requests`(`kt_assignee_id`);

-- CreateIndex
CREATE INDEX `exit_requests_kt_verified_by_id_fkey` ON `exit_requests`(`kt_verified_by_id`);

-- AddForeignKey
ALTER TABLE `login_sessions` ADD CONSTRAINT `login_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_change_requests` ADD CONSTRAINT `employee_change_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_requests` ADD CONSTRAINT `exit_requests_kt_assignee_id_fkey` FOREIGN KEY (`kt_assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_requests` ADD CONSTRAINT `exit_requests_kt_verified_by_id_fkey` FOREIGN KEY (`kt_verified_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
