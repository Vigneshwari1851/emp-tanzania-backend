import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`organization_config\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`organization_id\` INT NOT NULL,
      \`primary_color\` VARCHAR(191) DEFAULT '#3B82F6',
      \`secondary_color\` VARCHAR(191) DEFAULT '#1E40AF',
      \`custom_domain\` VARCHAR(191) NULL,
      \`sso_provider\` VARCHAR(191) DEFAULT 'local',
      \`billing_contact\` VARCHAR(191) NULL,
      \`finance_contact\` VARCHAR(191) NULL,
      \`technical_contact\` VARCHAR(191) NULL,
      \`legal_contact\` VARCHAR(191) NULL,
      \`theme\` VARCHAR(191) DEFAULT 'light',
      \`language\` VARCHAR(191) DEFAULT 'en-IN',
      \`date_format\` VARCHAR(191) DEFAULT 'DD/MM/YYYY',
      \`week_start_day\` VARCHAR(191) DEFAULT 'monday',
      \`default_landing_page\` VARCHAR(191) DEFAULT 'dashboard',
      \`email_notifications\` BOOLEAN NOT NULL DEFAULT true,
      \`sms_notifications\` BOOLEAN NOT NULL DEFAULT false,
      \`in_app_notifications\` BOOLEAN NOT NULL DEFAULT true,
      \`webhooks_enabled\` BOOLEAN NOT NULL DEFAULT false,
      \`notification_frequency\` VARCHAR(191) DEFAULT 'daily',
      \`maintenance_day\` VARCHAR(191) DEFAULT 'Saturday',
      \`maintenance_start\` VARCHAR(191) DEFAULT '02:00',
      \`maintenance_end\` VARCHAR(191) DEFAULT '06:00',
      \`backup_frequency\` VARCHAR(191) DEFAULT 'daily',
      \`backup_retention_days\` INT DEFAULT 30,
      \`rpo_minutes\` INT DEFAULT 60,
      \`rto_minutes\` INT DEFAULT 240,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`organization_config_organization_id_key\`(\`organization_id\`),
      CONSTRAINT \`organization_config_organization_id_fkey\` FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  console.log('✅ organization_config table created successfully');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
