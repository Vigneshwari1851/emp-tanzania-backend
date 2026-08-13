-- CreateTable
CREATE TABLE `pay_cycles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `frequency` VARCHAR(191) NOT NULL DEFAULT 'Monthly',
    `pay_day` VARCHAR(191) NOT NULL DEFAULT 'Last Day',
    `attendance_start_day` INTEGER NOT NULL DEFAULT 1,
    `attendance_end_day` INTEGER NOT NULL DEFAULT 30,
    `cutoff_day` INTEGER NOT NULL DEFAULT 25,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
