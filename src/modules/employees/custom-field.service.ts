import prisma from '../../shared/prisma/client';

export class CustomFieldService {
    async createField(data: { module: string, label: string, type: string, options?: any, required?: boolean }) {
        return await (prisma as any).customField.create({
            data
        });
    }

    async listFields(module?: string) {
        const where = module ? { module } : {};
        return await (prisma as any).customField.findMany({
            where,
            orderBy: { created_at: 'desc' }
        });
    }

    async getById(id: number) {
        return await (prisma as any).customField.findUnique({
            where: { id }
        });
    }

    async updateField(id: number, data: { label?: string, type?: string, options?: any, required?: boolean, status?: boolean }) {
        return await (prisma as any).customField.update({
            where: { id },
            data
        });
    }

    async deleteField(id: number) {
        return await (prisma as any).customField.delete({
            where: { id }
        });
    }
}
