/*
  Warnings:

  - You are about to alter the column `criteria` on the `payroll_groups` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Json`.
  - You are about to drop the `teammember` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,name]` on the table `payment_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,name]` on the table `payroll_groups` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,role_name]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,name]` on the table `salary_components` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,name]` on the table `salary_structures` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,section]` on the table `tax_sections` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `teammember` DROP FOREIGN KEY `TeamMember_team_id_fkey`;

-- DropForeignKey
ALTER TABLE `teammember` DROP FOREIGN KEY `TeamMember_user_id_fkey`;

-- DropIndex
DROP INDEX `payment_categories_name_key` ON `payment_categories`;

-- DropIndex
DROP INDEX `payroll_groups_name_key` ON `payroll_groups`;

-- DropIndex
DROP INDEX `reimbursement_types_type_key` ON `reimbursement_types`;

-- DropIndex
DROP INDEX `roles_role_name_key` ON `roles`;

-- DropIndex
DROP INDEX `salary_components_name_key` ON `salary_components`;

-- DropIndex
DROP INDEX `salary_structures_name_key` ON `salary_structures`;

-- DropIndex
DROP INDEX `tax_sections_section_key` ON `tax_sections`;

-- AlterTable
ALTER TABLE `department` ADD COLUMN `cost_center` VARCHAR(191) NULL,
    MODIFY `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `fixed_break_time` INTEGER NULL DEFAULT 60,
    ADD COLUMN `fixed_end_time` VARCHAR(191) NULL,
    ADD COLUMN `fixed_start_time` VARCHAR(191) NULL,
    ADD COLUMN `flex_core_end_time` VARCHAR(191) NULL DEFAULT '16:00',
    ADD COLUMN `flex_core_start_time` VARCHAR(191) NULL DEFAULT '11:00',
    ADD COLUMN `flex_max_hours` INTEGER NULL DEFAULT 12,
    ADD COLUMN `flex_max_login_time` VARCHAR(191) NULL DEFAULT '11:00',
    ADD COLUMN `flex_min_login_time` VARCHAR(191) NULL DEFAULT '07:00',
    ADD COLUMN `flex_required_hours` INTEGER NULL DEFAULT 8,
    ADD COLUMN `schedule_type` VARCHAR(191) NULL DEFAULT 'fixed',
    ADD COLUMN `shifts` JSON NULL,
    ADD COLUMN `slug` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `pay_cycles` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `organization_id` INTEGER NULL,
    MODIFY `frequency` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    MODIFY `pay_day` VARCHAR(191) NOT NULL DEFAULT 'last',
    MODIFY `attendance_start_day` VARCHAR(191) NULL,
    MODIFY `attendance_end_day` VARCHAR(191) NULL,
    MODIFY `cutoff_day` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `payment_categories` ADD COLUMN `organization_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `payroll_groups` ADD COLUMN `organization_id` INTEGER NULL,
    ADD COLUMN `payment_category_id` INTEGER NULL,
    MODIFY `criteria` JSON NULL;

-- AlterTable
ALTER TABLE `reimbursement_types` ADD COLUMN `branch_id` INTEGER NULL,
    ADD COLUMN `department_id` INTEGER NULL,
    ADD COLUMN `organization_id` INTEGER NULL,
    ADD COLUMN `payroll_group_id` INTEGER NULL,
    ADD COLUMN `role_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `roles` ADD COLUMN `organization_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `salary_components` ADD COLUMN `is_default` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `organization_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `salary_structures` ADD COLUMN `organization_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `tax_sections` ADD COLUMN `organization_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `team` MODIFY `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `user_details` ADD COLUMN `absence_status` VARCHAR(191) NULL,
    ADD COLUMN `designation_id` INTEGER NULL,
    ADD COLUMN `esi_number` VARCHAR(191) NULL,
    ADD COLUMN `exit_date` DATETIME(3) NULL,
    ADD COLUMN `is_draft` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_nri` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_senior_citizen` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `joining_date` DATETIME(3) NULL,
    ADD COLUMN `payroll_group_id` INTEGER NULL,
    ADD COLUMN `pf_uan` VARCHAR(191) NULL,
    ADD COLUMN `shift_id` VARCHAR(191) NULL,
    ADD COLUMN `sub_status` VARCHAR(191) NULL,
    ADD COLUMN `tax_regime` VARCHAR(191) NULL DEFAULT 'New',
    ADD COLUMN `tax_regime_changed_at` DATETIME(3) NULL,
    ADD COLUMN `team_id` INTEGER NULL,
    ADD COLUMN `user_type_id` INTEGER NULL,
    ADD COLUMN `verification_statuses` JSON NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lockout_until` DATETIME(3) NULL;

-- DropTable
DROP TABLE `teammember`;

-- CreateTable
CREATE TABLE `organization_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `primary_color` VARCHAR(191) NULL DEFAULT '#3B82F6',
    `secondary_color` VARCHAR(191) NULL DEFAULT '#1E40AF',
    `custom_domain` VARCHAR(191) NULL,
    `sso_provider` VARCHAR(191) NULL DEFAULT 'local',
    `mfa_policy` VARCHAR(191) NULL DEFAULT 'email_otp',
    `mfa_required_admins` BOOLEAN NOT NULL DEFAULT true,
    `billing_contact` VARCHAR(191) NULL,
    `finance_contact` VARCHAR(191) NULL,
    `technical_contact` VARCHAR(191) NULL,
    `legal_contact` VARCHAR(191) NULL,
    `theme` VARCHAR(191) NULL DEFAULT 'light',
    `language` VARCHAR(191) NULL DEFAULT 'en-IN',
    `date_format` VARCHAR(191) NULL DEFAULT 'DD/MM/YYYY',
    `week_start_day` VARCHAR(191) NULL DEFAULT 'monday',
    `default_landing_page` VARCHAR(191) NULL DEFAULT 'dashboard',
    `email_notifications` BOOLEAN NOT NULL DEFAULT true,
    `sms_notifications` BOOLEAN NOT NULL DEFAULT false,
    `in_app_notifications` BOOLEAN NOT NULL DEFAULT true,
    `webhooks_enabled` BOOLEAN NOT NULL DEFAULT false,
    `notification_frequency` VARCHAR(191) NULL DEFAULT 'daily',
    `maintenance_day` VARCHAR(191) NULL DEFAULT 'Saturday',
    `maintenance_start` VARCHAR(191) NULL DEFAULT '02:00',
    `maintenance_end` VARCHAR(191) NULL DEFAULT '06:00',
    `backup_frequency` VARCHAR(191) NULL DEFAULT 'daily',
    `backup_retention_days` INTEGER NULL DEFAULT 30,
    `rpo_minutes` INTEGER NULL DEFAULT 60,
    `rto_minutes` INTEGER NULL DEFAULT 240,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organization_config_organization_id_key`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_component_changes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salary_component_id` INTEGER NOT NULL,
    `proposed_name` VARCHAR(191) NULL,
    `proposed_type` VARCHAR(191) NULL,
    `proposed_calculation_type` VARCHAR(191) NULL,
    `proposed_value` DECIMAL(15, 2) NULL,
    `proposed_is_taxable` BOOLEAN NULL,
    `proposed_is_statutory` BOOLEAN NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `requested_by` INTEGER NULL,
    `approved_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslips` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `month` VARCHAR(191) NOT NULL,
    `gross_amount` DECIMAL(15, 2) NOT NULL,
    `deduction_amount` DECIMAL(15, 2) NOT NULL,
    `net_amount` DECIMAL(15, 2) NOT NULL,
    `employer_pf` DECIMAL(15, 2) NULL,
    `employer_eps` DECIMAL(15, 2) NULL,
    `employer_esi` DECIMAL(15, 2) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `breakdown` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `organization_id` INTEGER NULL,

    INDEX `payslips_user_id_idx`(`user_id`),
    INDEX `payslips_organization_id_idx`(`organization_id`),
    UNIQUE INDEX `payslips_user_id_month_organization_id_key`(`user_id`, `month`, `organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tax_declarations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `section` VARCHAR(191) NOT NULL,
    `instrument` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `proof_url` VARCHAR(191) NULL,
    `financial_year` VARCHAR(191) NOT NULL,
    `submitted_on` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `organization_id` INTEGER NULL,

    INDEX `tax_declarations_user_id_idx`(`user_id`),
    INDEX `tax_declarations_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_claims` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `description` TEXT NULL,
    `expense_date` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `proof_url` VARCHAR(191) NULL,
    `submitted_on` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `organization_id` INTEGER NULL,
    `payment_status` VARCHAR(191) NULL DEFAULT 'Pending Approval',
    `payment_mode` VARCHAR(191) NULL DEFAULT 'Salary Payroll',
    `payroll_id` INTEGER NULL,
    `payment_date` DATETIME(3) NULL,
    `payment_reference` VARCHAR(191) NULL,
    `paid_by` INTEGER NULL,

    INDEX `expense_claims_user_id_idx`(`user_id`),
    INDEX `expense_claims_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exit_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `reporting_manager_id` INTEGER NULL,
    `exit_type` VARCHAR(191) NOT NULL,
    `notice_date` DATETIME(3) NOT NULL,
    `last_working_day` DATETIME(3) NOT NULL,
    `primary_reason` VARCHAR(191) NOT NULL,
    `explanation` TEXT NULL,
    `notice_waiver` BOOLEAN NOT NULL DEFAULT false,
    `interview_pref` VARCHAR(191) NULL,
    `handover_notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    `acknowledged` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `is_hr_override` BOOLEAN NOT NULL DEFAULT false,
    `negotiated_lwd` DATETIME(3) NULL,
    `notice_period_days` INTEGER NOT NULL DEFAULT 30,
    `progress_percentage` INTEGER NOT NULL DEFAULT 0,
    `rejection_reason` TEXT NULL,
    `sla_deadline` DATETIME(3) NULL,

    INDEX `exit_requests_reporting_manager_id_fkey`(`reporting_manager_id`),
    INDEX `exit_requests_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exit_assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exit_request_id` INTEGER NOT NULL,
    `asset_name` VARCHAR(191) NOT NULL,
    `asset_serial_no` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `return_status` BOOLEAN NOT NULL DEFAULT false,
    `asset_id` INTEGER NULL,
    `assignment_id` INTEGER NULL,

    INDEX `exit_assets_exit_request_id_fkey`(`exit_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exit_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exit_request_id` INTEGER NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `file_type` VARCHAR(191) NULL,

    INDEX `exit_documents_exit_request_id_fkey`(`exit_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exit_workflow_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exit_request_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `comments` TEXT NULL,
    `actor_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exit_workflow_history_actor_id_fkey`(`actor_id`),
    INDEX `exit_workflow_history_exit_request_id_fkey`(`exit_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exit_clearance_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exit_request_id` INTEGER NOT NULL,
    `task_name` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `assigned_to_id` INTEGER NULL,
    `assigned_to_name` VARCHAR(191) NULL,
    `completion_date` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `proof_type` VARCHAR(191) NULL,
    `proof_url` VARCHAR(191) NULL,
    `sla_deadline` DATETIME(3) NULL,

    INDEX `exit_clearance_tasks_exit_request_id_fkey`(`exit_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exit_interview_responses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exit_request_id` INTEGER NOT NULL,
    `data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `exit_interview_responses_exit_request_id_key`(`exit_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exit_settlements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exit_request_id` INTEGER NOT NULL,
    `total_earnings` DECIMAL(15, 2) NOT NULL,
    `total_deductions` DECIMAL(15, 2) NOT NULL,
    `net_payable` DECIMAL(15, 2) NOT NULL,
    `gratuity` DECIMAL(15, 2) NULL,
    `leave_encashment` DECIMAL(15, 2) NULL,
    `notice_pay` DECIMAL(15, 2) NULL,
    `data` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `exit_settlements_exit_request_id_key`(`exit_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prior_employment_income` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `financial_year` VARCHAR(191) NOT NULL,
    `gross_income` DECIMAL(15, 2) NOT NULL,
    `pf_deducted` DECIMAL(15, 2) NOT NULL,
    `tds_deducted` DECIMAL(15, 2) NOT NULL,
    `pt_deducted` DECIMAL(15, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `prior_employment_income_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `state_professional_tax` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `state` VARCHAR(191) NOT NULL,
    `slabs` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `state_professional_tax_state_key`(`state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_structure_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NULL,
    `salary_structure_id` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `components_data` JSON NOT NULL,
    `effective_from` DATETIME(3) NOT NULL,
    `effective_to` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `salary_structure_history_organization_id_fkey`(`organization_id`),
    INDEX `salary_structure_history_salary_structure_id_fkey`(`salary_structure_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `depreciation_rate` DOUBLE NULL DEFAULT 0,
    `useful_life_years` INTEGER NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `asset_categories_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `location_type` VARCHAR(191) NULL DEFAULT 'OFFICE',
    `address` TEXT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `asset_locations_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category_id` INTEGER NOT NULL,
    `location_id` INTEGER NOT NULL,
    `serial_number` VARCHAR(191) NOT NULL,
    `asset_tag` VARCHAR(191) NULL,
    `barcode` VARCHAR(191) NULL,
    `qr_code` TEXT NULL,
    `manufacturer` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'AVAILABLE',
    `purchase_date` DATETIME(3) NULL,
    `purchase_price` DECIMAL(15, 2) NULL,
    `current_value` DECIMAL(15, 2) NULL,
    `warranty_expiry` DATETIME(3) NULL,
    `depreciation_rate` DOUBLE NULL DEFAULT 0,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `image_url` TEXT NULL,
    `specifications` JSON NULL,
    `asset_code` VARCHAR(191) NULL,

    UNIQUE INDEX `assets_asset_code_key`(`asset_code`),
    INDEX `assets_organization_id_idx`(`organization_id`),
    INDEX `assets_status_idx`(`status`),
    INDEX `assets_asset_tag_idx`(`asset_tag`),
    INDEX `assets_category_id_fkey`(`category_id`),
    INDEX `assets_location_id_fkey`(`location_id`),
    UNIQUE INDEX `assets_serial_number_organization_id_key`(`serial_number`, `organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `asset_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `assigned_by` INTEGER NULL,
    `issue_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expected_return` DATETIME(3) NULL,
    `return_date` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `asset_assignments_asset_id_idx`(`asset_id`),
    INDEX `asset_assignments_user_id_idx`(`user_id`),
    INDEX `asset_assignments_organization_id_idx`(`organization_id`),
    INDEX `asset_assignments_assigned_by_fkey`(`assigned_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `asset_id` INTEGER NOT NULL,
    `action_type` VARCHAR(191) NOT NULL DEFAULT 'UPDATE',
    `field_changed` VARCHAR(191) NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `changed_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `asset_history_asset_id_idx`(`asset_id`),
    INDEX `asset_history_organization_id_idx`(`organization_id`),
    INDEX `asset_history_changed_by_id_fkey`(`changed_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `asset_id` INTEGER NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `file_url` TEXT NOT NULL,
    `file_type` VARCHAR(191) NULL,
    `file_size` INTEGER NULL,
    `uploaded_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `asset_documents_asset_id_idx`(`asset_id`),
    INDEX `asset_documents_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_tracking_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `asset_id` INTEGER NOT NULL,
    `location_id` INTEGER NULL,
    `location_name` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `source` VARCHAR(191) NULL DEFAULT 'MANUAL',
    `notes` TEXT NULL,
    `tracked_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `asset_tracking_logs_asset_id_idx`(`asset_id`),
    INDEX `asset_tracking_logs_organization_id_idx`(`organization_id`),
    INDEX `asset_tracking_logs_location_id_fkey`(`location_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contact_person` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `sla_terms` TEXT NULL,
    `performance_rating` DOUBLE NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vendors_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `asset_id` INTEGER NOT NULL,
    `vendor_id` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `type` VARCHAR(191) NOT NULL DEFAULT 'CORRECTIVE',
    `estimated_cost` DECIMAL(15, 2) NULL,
    `actual_cost` DECIMAL(15, 2) NULL,
    `scheduled_date` DATETIME(3) NULL,
    `completed_date` DATETIME(3) NULL,
    `created_by` INTEGER NOT NULL,
    `assigned_to` INTEGER NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `work_orders_asset_id_idx`(`asset_id`),
    INDEX `work_orders_organization_id_idx`(`organization_id`),
    INDEX `work_orders_status_idx`(`status`),
    INDEX `work_orders_assigned_to_fkey`(`assigned_to`),
    INDEX `work_orders_created_by_fkey`(`created_by`),
    INDEX `work_orders_vendor_id_fkey`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `procurement_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `vendor_id` INTEGER NULL,
    `order_number` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `total_amount` DECIMAL(15, 2) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `order_date` DATETIME(3) NULL,
    `expected_delivery` DATETIME(3) NULL,
    `actual_delivery` DATETIME(3) NULL,
    `created_by` INTEGER NULL,
    `approved_by` INTEGER NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `procurement_orders_organization_id_idx`(`organization_id`),
    INDEX `procurement_orders_status_idx`(`status`),
    INDEX `procurement_orders_vendor_id_fkey`(`vendor_id`),
    UNIQUE INDEX `procurement_orders_order_number_organization_id_key`(`order_number`, `organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `procurement_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `procurement_order_id` INTEGER NOT NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(15, 2) NULL,
    `total_price` DECIMAL(15, 2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `procurement_items_procurement_order_id_idx`(`procurement_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `file_url` TEXT NOT NULL,
    `file_name` VARCHAR(191) NULL,
    `entity_type` VARCHAR(191) NOT NULL DEFAULT 'ASSET',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `total_rows` INTEGER NULL,
    `processed_rows` INTEGER NULL DEFAULT 0,
    `failed_rows` INTEGER NULL DEFAULT 0,
    `error_log` JSON NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `import_jobs_organization_id_idx`(`organization_id`),
    INDEX `import_jobs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `asset_category_id` INTEGER NULL,
    `specific_asset_id` INTEGER NULL,
    `request_type` VARCHAR(191) NOT NULL DEFAULT 'NEW',
    `sub_category` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `assigned_asset_id` INTEGER NULL,
    `approved_by` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `asset_requests_organization_id_idx`(`organization_id`),
    INDEX `asset_requests_user_id_idx`(`user_id`),
    INDEX `asset_requests_status_idx`(`status`),
    INDEX `asset_requests_approved_by_fkey`(`approved_by`),
    INDEX `asset_requests_asset_category_id_fkey`(`asset_category_id`),
    INDEX `asset_requests_assigned_asset_id_fkey`(`assigned_asset_id`),
    INDEX `asset_requests_specific_asset_id_fkey`(`specific_asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_courses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `instructor_id` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `thumbnail_url` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `duration` VARCHAR(50) NULL,
    `learning_objectives` JSON NULL,
    `level` VARCHAR(191) NOT NULL DEFAULT 'BEGINNER',
    `curriculum_type` VARCHAR(191) NOT NULL DEFAULT 'VIDEO',
    `course_type` VARCHAR(191) NOT NULL DEFAULT 'TECHNICAL',
    `prerequisites` JSON NULL,
    `auto_assign_rules` JSON NULL,

    INDEX `lms_courses_instructor_id_fkey`(`instructor_id`),
    INDEX `lms_courses_organization_id_fkey`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_modules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `course_id` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `description` TEXT NULL,

    INDEX `lms_modules_course_id_fkey`(`course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_contents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `module_id` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content_type` VARCHAR(191) NOT NULL DEFAULT 'TEXT',
    `content_url` TEXT NULL,
    `content_body` LONGTEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `meeting_config` JSON NULL,

    INDEX `lms_contents_module_id_fkey`(`module_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_learning_paths` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `thumbnail_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `auto_assign_rules` JSON NULL,

    INDEX `lms_learning_paths_organization_id_fkey`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_learning_path_courses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `learning_path_id` INTEGER NOT NULL,
    `course_id` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    INDEX `lms_learning_path_courses_course_id_fkey`(`course_id`),
    UNIQUE INDEX `lms_learning_path_courses_learning_path_id_course_id_key`(`learning_path_id`, `course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `course_id` INTEGER NULL,
    `learning_path_id` INTEGER NULL,
    `assigned_by` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ASSIGNED',
    `due_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lms_assignments_course_id_fkey`(`course_id`),
    INDEX `lms_assignments_learning_path_id_fkey`(`learning_path_id`),
    INDEX `lms_assignments_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_progress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `module_id` INTEGER NOT NULL,
    `content_id` INTEGER NOT NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `time_spent` INTEGER NOT NULL DEFAULT 0,
    `completed_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `engagement_data` JSON NULL,

    INDEX `lms_progress_content_id_fkey`(`content_id`),
    INDEX `lms_progress_module_id_fkey`(`module_id`),
    UNIQUE INDEX `lms_progress_user_id_content_id_key`(`user_id`, `content_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_quizzes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `course_id` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `passing_score` INTEGER NOT NULL DEFAULT 70,
    `time_limit` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `max_attempts` INTEGER NOT NULL DEFAULT 0,

    INDEX `lms_quizzes_course_id_fkey`(`course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quiz_id` INTEGER NOT NULL,
    `question_text` TEXT NOT NULL,
    `question_type` VARCHAR(191) NOT NULL DEFAULT 'MCQ',
    `options` JSON NOT NULL,
    `correct_answer` JSON NOT NULL,
    `explanation` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lms_questions_quiz_id_fkey`(`quiz_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_quiz_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `quiz_id` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `attempt_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lms_quiz_attempts_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_certificates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `course_id` INTEGER NOT NULL,
    `certificate_id` VARCHAR(191) NOT NULL,
    `issue_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiry_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lms_certificates_certificate_id_key`(`certificate_id`),
    INDEX `lms_certificates_course_id_fkey`(`course_id`),
    INDEX `lms_certificates_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NULL,
    `designation_name` VARCHAR(191) NOT NULL,
    `designation_code` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `parent_designation_id` INTEGER NULL,
    `secondary_parent_designation_id` INTEGER NULL,
    `secondary_reporting_employee_id` INTEGER NULL,
    `department_id` INTEGER NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Designation_parent_designation_id_idx`(`parent_designation_id`),
    INDEX `Designation_secondary_parent_designation_id_idx`(`secondary_parent_designation_id`),
    INDEX `Designation_secondary_reporting_employee_id_idx`(`secondary_reporting_employee_id`),
    INDEX `Designation_department_id_idx`(`department_id`),
    INDEX `Designation_organization_id_idx`(`organization_id`),
    UNIQUE INDEX `designations_organization_id_designation_code_key`(`organization_id`, `designation_code`),
    UNIQUE INDEX `designations_organization_id_designation_name_key`(`organization_id`, `designation_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `employment_type` VARCHAR(191) NOT NULL,
    `experience_level` VARCHAR(191) NOT NULL,
    `experience_required` VARCHAR(191) NULL,
    `openings_count` INTEGER NOT NULL DEFAULT 1,
    `remote_option` VARCHAR(191) NOT NULL,
    `salary_type` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `min_salary` DECIMAL(15, 2) NULL,
    `max_salary` DECIMAL(15, 2) NULL,
    `salary_period` VARCHAR(191) NULL,
    `job_summary` TEXT NOT NULL,
    `responsibilities` JSON NULL,
    `requirements` JSON NULL,
    `required_skills` JSON NULL,
    `preferred_skills` JSON NULL,
    `benefits` JSON NULL,
    `hiring_manager_id` INTEGER NULL,
    `assigned_recruiter_id` INTEGER NULL,
    `application_deadline` DATETIME(3) NULL,
    `target_start_date` DATETIME(3) NULL,
    `interview_rounds` INTEGER NULL,
    `travel_required` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `jobs_id_idx`(`id`),
    INDEX `jobs_status_idx`(`status`),
    INDEX `jobs_organization_id_fkey`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `candidate_id` INTEGER NOT NULL,
    `job_id` INTEGER NOT NULL,
    `application_id` INTEGER NULL,
    `round_number` INTEGER NOT NULL,
    `type` ENUM('HR', 'TECHNICAL', 'MANAGERIAL', 'FINAL') NOT NULL,
    `scheduled_at` DATETIME(3) NOT NULL,
    `duration_minutes` INTEGER NOT NULL,
    `meeting_link` VARCHAR(191) NULL,
    `status` ENUM('SCHEDULED', 'RESCHEDULE_REQUESTED', 'RESCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FEEDBACK_PENDING', 'PASSED', 'FAILED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'SCHEDULED',
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `interviews_uuid_key`(`uuid`),
    INDEX `interviews_candidate_id_idx`(`candidate_id`),
    INDEX `interviews_job_id_idx`(`job_id`),
    INDEX `interviews_application_id_idx`(`application_id`),
    INDEX `interviews_status_idx`(`status`),
    INDEX `interviews_scheduled_at_idx`(`scheduled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_interviewers` (
    `interview_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` VARCHAR(191) NOT NULL,

    INDEX `interview_interviewers_user_id_fkey`(`user_id`),
    PRIMARY KEY (`interview_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_feedbacks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `interview_id` INTEGER NOT NULL,
    `technical_rating` INTEGER NOT NULL DEFAULT 0,
    `communication_rating` INTEGER NOT NULL DEFAULT 0,
    `problem_solving_rating` INTEGER NOT NULL DEFAULT 0,
    `culture_fit_rating` INTEGER NOT NULL DEFAULT 0,
    `recommendation` ENUM('STRONG_HIRE', 'HIRE', 'NEUTRAL', 'REJECT') NOT NULL,
    `strengths` VARCHAR(191) NULL,
    `weaknesses` VARCHAR(191) NULL,
    `additional_notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `interview_feedbacks_interview_id_key`(`interview_id`),
    INDEX `interview_feedbacks_interview_id_idx`(`interview_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `interview_id` INTEGER NOT NULL,
    `event_type` ENUM('CREATED', 'UPDATED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'FEEDBACK_SUBMITTED') NOT NULL,
    `actor_id` INTEGER NULL,
    `actor_role` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `details` JSON NULL,

    INDEX `interview_events_interview_id_idx`(`interview_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `organization_id` INTEGER NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `joining_date` DATETIME(3) NULL,
    `otp_secret` VARCHAR(191) NULL,
    `otp_attempts` INTEGER NOT NULL DEFAULT 0,
    `policies_accepted` BOOLEAN NOT NULL DEFAULT false,
    `bank_details` JSON NULL,
    `is_draft` BOOLEAN NOT NULL DEFAULT false,
    `experience_history` JSON NULL,
    `education_history` JSON NULL,
    `gender` VARCHAR(191) NULL,
    `dob` DATETIME(3) NULL,
    `address` VARCHAR(191) NULL,
    `experience_years` DECIMAL(5, 2) NULL,
    `current_company` VARCHAR(191) NULL,
    `current_designation` VARCHAR(191) NULL,
    `current_location` VARCHAR(191) NULL,
    `linkedin_url` VARCHAR(191) NULL,
    `portfolio_url` VARCHAR(191) NULL,
    `github_url` VARCHAR(191) NULL,
    `current_ctc` DECIMAL(15, 2) NULL,
    `expected_ctc` DECIMAL(15, 2) NULL,
    `notice_period_days` INTEGER NULL,
    `skills` VARCHAR(191) NULL,
    `resume_url` VARCHAR(191) NULL,
    `source` VARCHAR(191) NULL,
    `highest_degree` VARCHAR(191) NULL,
    `specialization` VARCHAR(191) NULL,
    `university` VARCHAR(191) NULL,
    `graduation_year` INTEGER NULL,
    `gpa_percentage` DECIMAL(5, 2) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `candidates_uuid_key`(`uuid`),
    UNIQUE INDEX `candidates_email_key`(`email`),
    INDEX `candidates_email_idx`(`email`),
    INDEX `candidates_uuid_idx`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `candidate_id` INTEGER NOT NULL,
    `job_id` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'APPLIED',
    `answers` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `candidate_applications_uuid_key`(`uuid`),
    INDEX `candidate_applications_candidate_id_idx`(`candidate_id`),
    INDEX `candidate_applications_job_id_idx`(`job_id`),
    INDEX `candidate_applications_uuid_idx`(`uuid`),
    INDEX `candidate_applications_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offers` (
    `id` VARCHAR(191) NOT NULL,
    `candidate_id` INTEGER NOT NULL,
    `job_id` INTEGER NOT NULL,
    `application_id` INTEGER NOT NULL,
    `recruiter_id` INTEGER NULL,
    `hr_reviewer_id` INTEGER NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'OFFER_SENT', 'OFFER_VIEWED', 'OFFER_NEGOTIATION', 'REVISED', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'OFFER_EXPIRED', 'WITHDRAWN') NOT NULL DEFAULT 'DRAFT',
    `expiry_date` DATETIME(3) NOT NULL,
    `joining_date` DATETIME(3) NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `offers_candidate_id_idx`(`candidate_id`),
    INDEX `offers_job_id_idx`(`job_id`),
    INDEX `offers_application_id_idx`(`application_id`),
    INDEX `offers_status_idx`(`status`),
    INDEX `offers_expiry_date_idx`(`expiry_date`),
    INDEX `offers_hr_reviewer_id_fkey`(`hr_reviewer_id`),
    INDEX `offers_recruiter_id_fkey`(`recruiter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offer_versions` (
    `id` VARCHAR(191) NOT NULL,
    `offer_id` VARCHAR(191) NOT NULL,
    `version_number` INTEGER NOT NULL DEFAULT 1,
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `joining_date` DATETIME(3) NOT NULL,
    `expiry_date` DATETIME(3) NOT NULL,
    `work_location` VARCHAR(191) NOT NULL,
    `work_mode` VARCHAR(191) NOT NULL,
    `probation_period` INTEGER NOT NULL DEFAULT 0,
    `reporting_manager` VARCHAR(191) NOT NULL,
    `notice_clauses` TEXT NULL,
    `confidentiality` TEXT NULL,
    `employment_conds` TEXT NULL,
    `additional_terms` TEXT NULL,

    INDEX `offer_versions_offer_id_idx`(`offer_id`),
    INDEX `offer_versions_created_by_id_fkey`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compensation_components` (
    `id` VARCHAR(191) NOT NULL,
    `offer_version_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `frequency` ENUM('MONTHLY', 'ANNUAL') NOT NULL DEFAULT 'ANNUAL',
    `description` VARCHAR(191) NULL,

    INDEX `compensation_components_offer_version_id_idx`(`offer_version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offer_documents` (
    `id` VARCHAR(191) NOT NULL,
    `offer_version_id` VARCHAR(191) NOT NULL,
    `file_path` TEXT NOT NULL,
    `original_name` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `offer_documents_token_key`(`token`),
    INDEX `offer_documents_offer_version_id_idx`(`offer_version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `negotiations` (
    `id` VARCHAR(191) NOT NULL,
    `offer_id` VARCHAR(191) NOT NULL,
    `requester_role` VARCHAR(191) NOT NULL,
    `comment` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `negotiations_offer_id_idx`(`offer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offer_events` (
    `id` VARCHAR(191) NOT NULL,
    `offer_id` VARCHAR(191) NOT NULL,
    `event_type` VARCHAR(191) NOT NULL,
    `actor_id` INTEGER NULL,
    `actor_role` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `details` JSON NULL,

    INDEX `offer_events_offer_id_idx`(`offer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `candidate_id` INTEGER NOT NULL,
    `document_type` VARCHAR(191) NOT NULL,
    `file_url` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verified_at` DATETIME(3) NULL,

    INDEX `candidate_documents_candidate_id_idx`(`candidate_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actor_id` INTEGER NULL,
    `actor_type` VARCHAR(191) NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `action_type` VARCHAR(191) NOT NULL,
    `previous_state` VARCHAR(191) NULL,
    `new_state` VARCHAR(191) NULL,
    `comments` TEXT NULL,
    `ip_address` VARCHAR(191) NULL,
    `correlation_id` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_events_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_events_actor_id_idx`(`actor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `surveys` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `access` VARCHAR(191) NOT NULL DEFAULT 'private',
    `survey_password` VARCHAR(191) NULL,
    `theme_preset` VARCHAR(191) NULL,
    `theme_config` TEXT NULL,
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `target_department` VARCHAR(191) NULL DEFAULT 'All Departments',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` INTEGER NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `cloned_from_id` VARCHAR(191) NULL,
    `is_clone` BOOLEAN NOT NULL DEFAULT false,

    INDEX `surveys_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `surveyId` VARCHAR(191) NOT NULL,
    `type` ENUM('MULTIPLE_CHOICE', 'SINGLE_CHOICE', 'RATING', 'TEXT', 'YES_NO') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `parent_question_id` INTEGER NULL,
    `trigger_option_id` INTEGER NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,

    INDEX `questions_surveyId_idx`(`surveyId`),
    INDEX `questions_parent_question_id_idx`(`parent_question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `questionId` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,

    INDEX `options_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `survey_responses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `surveyId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,

    INDEX `survey_responses_surveyId_userId_idx`(`surveyId`, `userId`),
    INDEX `survey_responses_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `answers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `responseId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `valueText` TEXT NULL,
    `valueNumber` DOUBLE NULL,
    `selectedOptionId` INTEGER NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,

    INDEX `answers_responseId_idx`(`responseId`),
    INDEX `answers_questionId_idx`(`questionId`),
    INDEX `answers_selectedOptionId_fkey`(`selectedOptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bgv_cases` (
    `id` VARCHAR(191) NOT NULL,
    `application_id` INTEGER NOT NULL,
    `candidate_id` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'BGV_INITIATED',
    `risk_score` INTEGER NOT NULL DEFAULT 0,
    `risk_category` VARCHAR(191) NOT NULL DEFAULT 'LOW',
    `hr_reviewer_id` INTEGER NULL,
    `vendor_ref_id` VARCHAR(191) NULL,
    `sla_due_date` DATETIME(3) NULL,
    `summary` TEXT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bgv_cases_application_id_key`(`application_id`),
    INDEX `bgv_cases_application_id_idx`(`application_id`),
    INDEX `bgv_cases_candidate_id_idx`(`candidate_id`),
    INDEX `bgv_cases_status_idx`(`status`),
    INDEX `bgv_cases_hr_reviewer_id_fkey`(`hr_reviewer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bgv_verifications` (
    `id` VARCHAR(191) NOT NULL,
    `bgv_case_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `verified_by` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bgv_verifications_bgv_case_id_idx`(`bgv_case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bgv_documents` (
    `id` VARCHAR(191) NOT NULL,
    `bgv_case_id` VARCHAR(191) NOT NULL,
    `bgv_verification_id` VARCHAR(191) NULL,
    `document_type` VARCHAR(191) NOT NULL,
    `file_url` TEXT NOT NULL,
    `original_name` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'UPLOADED',
    `rejection_reason` TEXT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bgv_documents_bgv_case_id_idx`(`bgv_case_id`),
    INDEX `bgv_documents_bgv_verification_id_fkey`(`bgv_verification_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bgv_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `bgv_case_id` VARCHAR(191) NOT NULL,
    `reviewer_id` INTEGER NOT NULL,
    `decision` VARCHAR(191) NOT NULL,
    `remarks` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bgv_reviews_bgv_case_id_idx`(`bgv_case_id`),
    INDEX `bgv_reviews_reviewer_id_fkey`(`reviewer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bgv_risk_flags` (
    `id` VARCHAR(191) NOT NULL,
    `bgv_case_id` VARCHAR(191) NOT NULL,
    `rule_name` VARCHAR(191) NOT NULL,
    `score_impact` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bgv_risk_flags_bgv_case_id_idx`(`bgv_case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bgv_audit_events` (
    `id` VARCHAR(191) NOT NULL,
    `bgv_case_id` VARCHAR(191) NOT NULL,
    `actor_id` INTEGER NULL,
    `actor_type` VARCHAR(191) NOT NULL,
    `action_type` VARCHAR(191) NOT NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `reason` TEXT NULL,
    `ip_address` VARCHAR(191) NULL,
    `correlation_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bgv_audit_events_bgv_case_id_idx`(`bgv_case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userDetailId` INTEGER NOT NULL,
    `principalAmount` DECIMAL(15, 2) NOT NULL,
    `monthlyRecovery` DECIMAL(15, 2) NOT NULL,
    `outstandingBalance` DECIMAL(15, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_MANAGER',
    `reason` TEXT NULL,
    `reporting_manager_id` INTEGER NULL,
    `manager_remarks` TEXT NULL,
    `manager_approved_at` DATETIME(3) NULL,
    `hr_approved_by` INTEGER NULL,
    `hr_remarks` TEXT NULL,
    `hr_approved_at` DATETIME(3) NULL,
    `finance_approved_by` INTEGER NULL,
    `finance_remarks` TEXT NULL,
    `finance_approved_at` DATETIME(3) NULL,
    `disbursed_at` DATETIME(3) NULL,
    `disbursement_reference` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `loans_userDetailId_idx`(`userDetailId`),
    INDEX `loans_reporting_manager_id_idx`(`reporting_manager_id`),
    INDEX `loans_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `advances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userDetailId` INTEGER NOT NULL,
    `principalAmount` DECIMAL(15, 2) NOT NULL,
    `monthlyRecovery` DECIMAL(15, 2) NOT NULL,
    `outstandingBalance` DECIMAL(15, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_MANAGER',
    `reason` TEXT NULL,
    `reporting_manager_id` INTEGER NULL,
    `manager_remarks` TEXT NULL,
    `manager_approved_at` DATETIME(3) NULL,
    `hr_approved_by` INTEGER NULL,
    `hr_remarks` TEXT NULL,
    `hr_approved_at` DATETIME(3) NULL,
    `finance_approved_by` INTEGER NULL,
    `finance_remarks` TEXT NULL,
    `finance_approved_at` DATETIME(3) NULL,
    `disbursed_at` DATETIME(3) NULL,
    `disbursement_reference` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `advances_userDetailId_idx`(`userDetailId`),
    INDEX `advances_reporting_manager_id_idx`(`reporting_manager_id`),
    INDEX `advances_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'LOAN',
    `description` TEXT NULL,
    `minAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `maxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `interestRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `repaymentMethod` VARCHAR(191) NOT NULL DEFAULT 'EMI',
    `maxTenure` INTEGER NOT NULL DEFAULT 12,
    `installments` INTEGER NOT NULL DEFAULT 1,
    `requiresDocuments` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `effectiveDate` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `maxApplicationsPerPeriod` INTEGER NULL,
    `period` VARCHAR(191) NOT NULL DEFAULT 'Lifetime',
    `department_id` INTEGER NULL,
    `designation_id` INTEGER NULL,
    `branch_id` INTEGER NULL,
    `role_id` INTEGER NULL,
    `organization_id` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `loan_types_code_key`(`code`),
    INDEX `loan_types_department_id_idx`(`department_id`),
    INDEX `loan_types_designation_id_idx`(`designation_id`),
    INDEX `loan_types_branch_id_idx`(`branch_id`),
    INDEX `loan_types_role_id_idx`(`role_id`),
    INDEX `loan_types_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_eligibility_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loanTypeId` INTEGER NOT NULL,
    `ruleType` VARCHAR(50) NOT NULL,
    `ruleValue` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `loan_eligibility_rules_loanTypeId_idx`(`loanTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_approval_workflows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loanTypeId` INTEGER NOT NULL,
    `stepOrder` INTEGER NOT NULL,
    `roleName` VARCHAR(100) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `loan_approval_workflows_loanTypeId_idx`(`loanTypeId`),
    UNIQUE INDEX `loan_approval_workflows_loanTypeId_stepOrder_key`(`loanTypeId`, `stepOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicationNumber` VARCHAR(30) NOT NULL,
    `userDetailId` INTEGER NOT NULL,
    `loanTypeId` INTEGER NOT NULL,
    `requestedAmount` DECIMAL(15, 2) NOT NULL,
    `approvedAmount` DECIMAL(15, 2) NULL,
    `tenure` INTEGER NOT NULL,
    `monthlyEmi` DECIMAL(15, 2) NULL,
    `interestRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `totalPayable` DECIMAL(15, 2) NULL,
    `outstandingBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `reason` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `currentStep` INTEGER NOT NULL DEFAULT 0,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `loan_applications_applicationNumber_key`(`applicationNumber`),
    INDEX `loan_applications_userDetailId_idx`(`userDetailId`),
    INDEX `loan_applications_loanTypeId_idx`(`loanTypeId`),
    INDEX `loan_applications_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_approvals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicationId` INTEGER NOT NULL,
    `stepOrder` INTEGER NOT NULL,
    `approverId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `remarks` TEXT NULL,
    `actionAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `loan_approvals_applicationId_idx`(`applicationId`),
    INDEX `loan_approvals_approverId_idx`(`approverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_repayment_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicationId` INTEGER NOT NULL,
    `installmentNo` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `principalPortion` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `interestPortion` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `paidAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `paidDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `loan_repayment_schedules_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicationId` INTEGER NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `fileUrl` VARCHAR(500) NOT NULL,
    `fileType` VARCHAR(50) NULL,
    `fileSize` INTEGER NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `loan_documents_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `module` VARCHAR(50) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `actorId` INTEGER NOT NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_module_action_idx`(`module`, `action`),
    INDEX `audit_logs_actorId_idx`(`actorId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NOT NULL,
    `tab` VARCHAR(191) NOT NULL DEFAULT 'all',
    `file_url` VARCHAR(191) NOT NULL,
    `file_type` VARCHAR(191) NULL,
    `file_size` INTEGER NULL,
    `downloads_count` INTEGER NOT NULL DEFAULT 0,
    `views_count` INTEGER NOT NULL DEFAULT 0,
    `is_restricted` BOOLEAN NOT NULL DEFAULT false,
    `tags` JSON NULL,
    `version` VARCHAR(191) NOT NULL DEFAULT '1.0',
    `user_id` INTEGER NULL,
    `uploaded_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `documents_uploaded_by_fkey`(`uploaded_by`),
    INDEX `documents_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `editionId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `editions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `editions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `edition_modules` (
    `editionId` INTEGER NOT NULL,
    `featureModuleId` INTEGER NOT NULL,

    PRIMARY KEY (`editionId`, `featureModuleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_modules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `feature_modules_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_feature_overrides` (
    `tenantId` INTEGER NOT NULL,
    `featureModuleId` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`tenantId`, `featureModuleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `expires_at` DATETIME(3) NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `announcements_created_by_fkey`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_news` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `image_url` VARCHAR(191) NULL,
    `access_type` VARCHAR(191) NOT NULL DEFAULT 'public',
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `company_news_created_by_fkey`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_news_departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_news_id` INTEGER NOT NULL,
    `department_id` INTEGER NOT NULL,

    INDEX `cnd_news_id_idx`(`company_news_id`),
    INDEX `cnd_dept_id_idx`(`department_id`),
    UNIQUE INDEX `cnd_unique_pair`(`company_news_id`, `department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holidays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `year` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'public',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `holidays_name_year_key`(`name`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_type_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_type_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_type_permissions_permission_id_fkey`(`permission_id`),
    UNIQUE INDEX `user_type_permissions_user_type_id_permission_id_key`(`user_type_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organization_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `system_key` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_types_organization_id_idx`(`organization_id`),
    UNIQUE INDEX `user_types_organization_id_name_key`(`organization_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `organizations_slug_key` ON `organizations`(`slug`);

-- CreateIndex
CREATE INDEX `pay_cycles_organization_id_fkey` ON `pay_cycles`(`organization_id`);

-- CreateIndex
CREATE UNIQUE INDEX `payment_categories_organization_id_name_key` ON `payment_categories`(`organization_id`, `name`);

-- CreateIndex
CREATE INDEX `payroll_groups_payment_category_id_fkey` ON `payroll_groups`(`payment_category_id`);

-- CreateIndex
CREATE UNIQUE INDEX `payroll_groups_organization_id_name_key` ON `payroll_groups`(`organization_id`, `name`);

-- CreateIndex
CREATE INDEX `reimbursement_types_branch_id_fkey` ON `reimbursement_types`(`branch_id`);

-- CreateIndex
CREATE INDEX `reimbursement_types_department_id_fkey` ON `reimbursement_types`(`department_id`);

-- CreateIndex
CREATE INDEX `reimbursement_types_organization_id_fkey` ON `reimbursement_types`(`organization_id`);

-- CreateIndex
CREATE INDEX `reimbursement_types_payroll_group_id_fkey` ON `reimbursement_types`(`payroll_group_id`);

-- CreateIndex
CREATE INDEX `reimbursement_types_role_id_fkey` ON `reimbursement_types`(`role_id`);

-- CreateIndex
CREATE INDEX `roles_organization_id_idx` ON `roles`(`organization_id`);

-- CreateIndex
CREATE UNIQUE INDEX `roles_organization_id_role_name_key` ON `roles`(`organization_id`, `role_name`);

-- CreateIndex
CREATE UNIQUE INDEX `salary_components_organization_id_name_key` ON `salary_components`(`organization_id`, `name`);

-- CreateIndex
CREATE UNIQUE INDEX `salary_structures_organization_id_name_key` ON `salary_structures`(`organization_id`, `name`);

-- CreateIndex
CREATE UNIQUE INDEX `tax_sections_organization_id_section_key` ON `tax_sections`(`organization_id`, `section`);

-- CreateIndex
CREATE INDEX `user_details_payroll_group_id_fkey` ON `user_details`(`payroll_group_id`);

-- CreateIndex
CREATE INDEX `user_details_team_id_fkey` ON `user_details`(`team_id`);

-- CreateIndex
CREATE INDEX `user_details_designation_id_fkey` ON `user_details`(`designation_id`);

-- CreateIndex
CREATE INDEX `user_details_user_type_id_fkey` ON `user_details`(`user_type_id`);

-- AddForeignKey
ALTER TABLE `user_details` ADD CONSTRAINT `user_details_designation_id_fkey` FOREIGN KEY (`designation_id`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_details` ADD CONSTRAINT `user_details_payroll_group_id_fkey` FOREIGN KEY (`payroll_group_id`) REFERENCES `payroll_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_details` ADD CONSTRAINT `user_details_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_details` ADD CONSTRAINT `user_details_user_type_id_fkey` FOREIGN KEY (`user_type_id`) REFERENCES `user_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_config` ADD CONSTRAINT `organization_config_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_components` ADD CONSTRAINT `salary_components_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_component_changes` ADD CONSTRAINT `salary_component_changes_salary_component_id_fkey` FOREIGN KEY (`salary_component_id`) REFERENCES `salary_components`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_structures` ADD CONSTRAINT `salary_structures_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_groups` ADD CONSTRAINT `payroll_groups_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_groups` ADD CONSTRAINT `payroll_groups_payment_category_id_fkey` FOREIGN KEY (`payment_category_id`) REFERENCES `payment_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tax_sections` ADD CONSTRAINT `tax_sections_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursement_types` ADD CONSTRAINT `reimbursement_types_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursement_types` ADD CONSTRAINT `reimbursement_types_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursement_types` ADD CONSTRAINT `reimbursement_types_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursement_types` ADD CONSTRAINT `reimbursement_types_payroll_group_id_fkey` FOREIGN KEY (`payroll_group_id`) REFERENCES `payroll_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursement_types` ADD CONSTRAINT `reimbursement_types_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_categories` ADD CONSTRAINT `payment_categories_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pay_cycles` ADD CONSTRAINT `pay_cycles_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tax_declarations` ADD CONSTRAINT `tax_declarations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tax_declarations` ADD CONSTRAINT `tax_declarations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_claims` ADD CONSTRAINT `expense_claims_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_claims` ADD CONSTRAINT `expense_claims_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_requests` ADD CONSTRAINT `exit_requests_reporting_manager_id_fkey` FOREIGN KEY (`reporting_manager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_requests` ADD CONSTRAINT `exit_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_assets` ADD CONSTRAINT `exit_assets_exit_request_id_fkey` FOREIGN KEY (`exit_request_id`) REFERENCES `exit_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_documents` ADD CONSTRAINT `exit_documents_exit_request_id_fkey` FOREIGN KEY (`exit_request_id`) REFERENCES `exit_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_workflow_history` ADD CONSTRAINT `exit_workflow_history_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_workflow_history` ADD CONSTRAINT `exit_workflow_history_exit_request_id_fkey` FOREIGN KEY (`exit_request_id`) REFERENCES `exit_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_clearance_tasks` ADD CONSTRAINT `exit_clearance_tasks_exit_request_id_fkey` FOREIGN KEY (`exit_request_id`) REFERENCES `exit_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_interview_responses` ADD CONSTRAINT `exit_interview_responses_exit_request_id_fkey` FOREIGN KEY (`exit_request_id`) REFERENCES `exit_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_settlements` ADD CONSTRAINT `exit_settlements_exit_request_id_fkey` FOREIGN KEY (`exit_request_id`) REFERENCES `exit_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prior_employment_income` ADD CONSTRAINT `prior_employment_income_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_structure_history` ADD CONSTRAINT `salary_structure_history_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_structure_history` ADD CONSTRAINT `salary_structure_history_salary_structure_id_fkey` FOREIGN KEY (`salary_structure_id`) REFERENCES `salary_structures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_categories` ADD CONSTRAINT `asset_categories_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `asset_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `asset_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_history` ADD CONSTRAINT `asset_history_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_history` ADD CONSTRAINT `asset_history_changed_by_id_fkey` FOREIGN KEY (`changed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_history` ADD CONSTRAINT `asset_history_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_documents` ADD CONSTRAINT `asset_documents_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_documents` ADD CONSTRAINT `asset_documents_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_requests` ADD CONSTRAINT `asset_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_requests` ADD CONSTRAINT `asset_requests_asset_category_id_fkey` FOREIGN KEY (`asset_category_id`) REFERENCES `asset_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_requests` ADD CONSTRAINT `asset_requests_assigned_asset_id_fkey` FOREIGN KEY (`assigned_asset_id`) REFERENCES `assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_requests` ADD CONSTRAINT `asset_requests_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_requests` ADD CONSTRAINT `asset_requests_specific_asset_id_fkey` FOREIGN KEY (`specific_asset_id`) REFERENCES `assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_requests` ADD CONSTRAINT `asset_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_courses` ADD CONSTRAINT `lms_courses_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_courses` ADD CONSTRAINT `lms_courses_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_modules` ADD CONSTRAINT `lms_modules_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `lms_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_contents` ADD CONSTRAINT `lms_contents_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `lms_modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_learning_paths` ADD CONSTRAINT `lms_learning_paths_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_learning_path_courses` ADD CONSTRAINT `lms_learning_path_courses_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `lms_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_learning_path_courses` ADD CONSTRAINT `lms_learning_path_courses_learning_path_id_fkey` FOREIGN KEY (`learning_path_id`) REFERENCES `lms_learning_paths`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_assignments` ADD CONSTRAINT `lms_assignments_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `lms_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_assignments` ADD CONSTRAINT `lms_assignments_learning_path_id_fkey` FOREIGN KEY (`learning_path_id`) REFERENCES `lms_learning_paths`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_assignments` ADD CONSTRAINT `lms_assignments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_progress` ADD CONSTRAINT `lms_progress_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `lms_contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_progress` ADD CONSTRAINT `lms_progress_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `lms_modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_progress` ADD CONSTRAINT `lms_progress_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_quizzes` ADD CONSTRAINT `lms_quizzes_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `lms_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_questions` ADD CONSTRAINT `lms_questions_quiz_id_fkey` FOREIGN KEY (`quiz_id`) REFERENCES `lms_quizzes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_quiz_attempts` ADD CONSTRAINT `lms_quiz_attempts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_certificates` ADD CONSTRAINT `lms_certificates_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `lms_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_certificates` ADD CONSTRAINT `lms_certificates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `Designation_parent_designation_id_fkey` FOREIGN KEY (`parent_designation_id`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_secondary_parent_designation_id_fkey` FOREIGN KEY (`secondary_parent_designation_id`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_secondary_reporting_employee_id_fkey` FOREIGN KEY (`secondary_reporting_employee_id`) REFERENCES `user_details`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interviews` ADD CONSTRAINT `interviews_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `candidate_applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interviews` ADD CONSTRAINT `interviews_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interviews` ADD CONSTRAINT `interviews_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_interviewers` ADD CONSTRAINT `interview_interviewers_interview_id_fkey` FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_interviewers` ADD CONSTRAINT `interview_interviewers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_feedbacks` ADD CONSTRAINT `interview_feedbacks_interview_id_fkey` FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_events` ADD CONSTRAINT `interview_events_interview_id_fkey` FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_applications` ADD CONSTRAINT `candidate_applications_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_applications` ADD CONSTRAINT `candidate_applications_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `candidate_applications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_hr_reviewer_id_fkey` FOREIGN KEY (`hr_reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_recruiter_id_fkey` FOREIGN KEY (`recruiter_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_versions` ADD CONSTRAINT `offer_versions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_versions` ADD CONSTRAINT `offer_versions_offer_id_fkey` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compensation_components` ADD CONSTRAINT `compensation_components_offer_version_id_fkey` FOREIGN KEY (`offer_version_id`) REFERENCES `offer_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_documents` ADD CONSTRAINT `offer_documents_offer_version_id_fkey` FOREIGN KEY (`offer_version_id`) REFERENCES `offer_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `negotiations` ADD CONSTRAINT `negotiations_offer_id_fkey` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_documents` ADD CONSTRAINT `candidate_documents_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `surveys` ADD CONSTRAINT `surveys_cloned_from_id_fkey` FOREIGN KEY (`cloned_from_id`) REFERENCES `surveys`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `surveys` ADD CONSTRAINT `surveys_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `surveys`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_parent_question_id_fkey` FOREIGN KEY (`parent_question_id`) REFERENCES `questions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_trigger_option_id_fkey` FOREIGN KEY (`trigger_option_id`) REFERENCES `options`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `options` ADD CONSTRAINT `options_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_responses` ADD CONSTRAINT `survey_responses_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `surveys`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_responses` ADD CONSTRAINT `survey_responses_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_responseId_fkey` FOREIGN KEY (`responseId`) REFERENCES `survey_responses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_selectedOptionId_fkey` FOREIGN KEY (`selectedOptionId`) REFERENCES `options`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bgv_cases` ADD CONSTRAINT `bgv_cases_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `candidate_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bgv_cases` ADD CONSTRAINT `bgv_cases_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bgv_cases` ADD CONSTRAINT `bgv_cases_hr_reviewer_id_fkey` FOREIGN KEY (`hr_reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bgv_verifications` ADD CONSTRAINT `bgv_verifications_bgv_case_id_fkey` FOREIGN KEY (`bgv_case_id`) REFERENCES `bgv_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bgv_documents` ADD CONSTRAINT `bgv_documents_bgv_case_id_fkey` FOREIGN KEY (`bgv_case_id`) REFERENCES `bgv_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bgv_documents` ADD CONSTRAINT `bgv_documents_bgv_verification_id_fkey` FOREIGN KEY (`bgv_verification_id`) REFERENCES `bgv_verifications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bgv_reviews` ADD CONSTRAINT `bgv_reviews_bgv_case_id_fkey` FOREIGN KEY (`bgv_case_id`) REFERENCES `bgv_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bgv_reviews` ADD CONSTRAINT `bgv_reviews_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bgv_risk_flags` ADD CONSTRAINT `bgv_risk_flags_bgv_case_id_fkey` FOREIGN KEY (`bgv_case_id`) REFERENCES `bgv_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bgv_audit_events` ADD CONSTRAINT `bgv_audit_events_bgv_case_id_fkey` FOREIGN KEY (`bgv_case_id`) REFERENCES `bgv_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_userDetailId_fkey` FOREIGN KEY (`userDetailId`) REFERENCES `user_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_reporting_manager_id_fkey` FOREIGN KEY (`reporting_manager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_hr_approved_by_fkey` FOREIGN KEY (`hr_approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_finance_approved_by_fkey` FOREIGN KEY (`finance_approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advances` ADD CONSTRAINT `advances_userDetailId_fkey` FOREIGN KEY (`userDetailId`) REFERENCES `user_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advances` ADD CONSTRAINT `advances_reporting_manager_id_fkey` FOREIGN KEY (`reporting_manager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advances` ADD CONSTRAINT `advances_hr_approved_by_fkey` FOREIGN KEY (`hr_approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advances` ADD CONSTRAINT `advances_finance_approved_by_fkey` FOREIGN KEY (`finance_approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_types` ADD CONSTRAINT `loan_types_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_types` ADD CONSTRAINT `loan_types_designation_id_fkey` FOREIGN KEY (`designation_id`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_types` ADD CONSTRAINT `loan_types_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_types` ADD CONSTRAINT `loan_types_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_types` ADD CONSTRAINT `loan_types_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_eligibility_rules` ADD CONSTRAINT `loan_eligibility_rules_loanTypeId_fkey` FOREIGN KEY (`loanTypeId`) REFERENCES `loan_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_approval_workflows` ADD CONSTRAINT `loan_approval_workflows_loanTypeId_fkey` FOREIGN KEY (`loanTypeId`) REFERENCES `loan_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_userDetailId_fkey` FOREIGN KEY (`userDetailId`) REFERENCES `user_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_loanTypeId_fkey` FOREIGN KEY (`loanTypeId`) REFERENCES `loan_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_approvals` ADD CONSTRAINT `loan_approvals_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `loan_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_approvals` ADD CONSTRAINT `loan_approvals_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_repayment_schedules` ADD CONSTRAINT `loan_repayment_schedules_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `loan_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_documents` ADD CONSTRAINT `loan_documents_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `loan_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_news` ADD CONSTRAINT `company_news_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_news_departments` ADD CONSTRAINT `company_news_departments_company_news_id_fkey` FOREIGN KEY (`company_news_id`) REFERENCES `company_news`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_news_departments` ADD CONSTRAINT `company_news_departments_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_type_permissions` ADD CONSTRAINT `user_type_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_type_permissions` ADD CONSTRAINT `user_type_permissions_user_type_id_fkey` FOREIGN KEY (`user_type_id`) REFERENCES `user_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_types` ADD CONSTRAINT `user_types_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
