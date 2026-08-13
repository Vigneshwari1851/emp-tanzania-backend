import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    // Update Org 1 (id: 1) slug to socedge.com
    const org1 = await prisma.organization.update({
        where: { id: 1 },
        data: { slug: 'socedge.com' }
    });
    console.log("Updated Org 1:", org1.entity_name, "slug:", org1.slug);

    // Update Org 2 (id: 2) slug to testcorp.com if exists
    try {
        const org2 = await prisma.organization.update({
            where: { id: 2 },
            data: { slug: 'testcorp.com' }
        });
        console.log("Updated Org 2:", org2.entity_name, "slug:", org2.slug);
    } catch (e: any) {
        console.log("Org 2 not updated:", e.message);
    }
}
main().finally(() => prisma.$disconnect());
