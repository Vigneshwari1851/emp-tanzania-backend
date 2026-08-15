import prisma from '../../config/prisma';
import { notificationService } from '../notifications/notification.service';

export class DocumentService {
  async create(userId: number, data: {
    title: string;
    description?: string;
    category: string;
    tab?: string;
    file_url?: string;
    file_type?: string;
    file_size?: number;
    is_restricted?: boolean;
    tags?: string[];
    version?: string;
    user_id?: number;
    target_department?: string;
  }) {
    const doc = await prisma.document.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        file_url: data.file_url ?? '',
        file_type: data.file_type ?? null,
        file_size: data.file_size ?? null,
        tab: data.tab ?? 'all',
        is_restricted: data.is_restricted ?? false,
        tags: data.tags ? (data.tags as any) : null,
        version: data.version ?? '1.0',
        uploaded_by: userId,
        user_id: data.user_id ?? null,
        target_department: data.target_department ?? 'All Departments',
      },
    });

    // Notify targeted department users (or all active users if All Departments)
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { details: { select: { department: { select: { branches: { select: { organization_id: true } } } } } } }
      });
      const orgId = user?.details?.department?.branches?.organization_id;

      const rawDept = data.target_department || "All Departments";
      const depts = rawDept
        .split(",")
        .map((d: string) => d.trim())
        .filter((d: string) => d.length > 0);

      const isTargetingAll = depts.length === 0 || depts.includes("All Departments") || depts.includes("All");

      const departmentWhere: any = {};
      if (orgId) {
        departmentWhere.branches = { organization_id: orgId };
      }
      if (!isTargetingAll) {
        departmentWhere.department_name = depts.length === 1 ? depts[0] : { in: depts };
      }

      const activeUsers = await prisma.user.findMany({ 
        where: { 
          status: true, 
          is_deleted: false,
          ...(Object.keys(departmentWhere).length > 0 ? { details: { department: departmentWhere } } : {})
        } 
      });

      for (const u of activeUsers) {
        await notificationService.create({
          user_id: u.id,
          title: 'New Document Available',
          message: `A new document "${data.title}" has been uploaded in Document Hub.`,
          type: 'INFO',
          related_module: 'document',
          related_id: doc.id,
          metadata: { documentId: doc.id, category: data.category }
        });
      }
    } catch (notifErr) {
      console.error('Failed to dispatch document notifications:', notifErr);
    }

    return this.getById(doc.id);
  }

  async update(id: number, data: {
    title?: string;
    description?: string;
    category?: string;
    tab?: string;
    is_restricted?: boolean;
    tags?: string[];
    version?: string;
    user_id?: number;
  }) {
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) throw new Error('Document not found');

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.is_restricted !== undefined) updateData.is_restricted = data.is_restricted;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.user_id !== undefined) updateData.user_id = data.user_id;

    await prisma.document.update({ where: { id }, data: updateData });

    return this.getById(id);
  }

  async list(params?: {
    category?: string;
    tab?: string;
    is_restricted?: boolean;
    search?: string;
    user_department_name?: string;
    can_manage?: boolean;
  }) {
    const where: any = {};

    if (params?.category) {
      where.category = params.category;
    }

    if (params?.tab) {
      where.tab = params.tab;
    }

    if (params?.is_restricted !== undefined) {
      where.is_restricted = params.is_restricted;
    }

    if (params?.search) {
      where.OR = [
        { title: { contains: params.search } },
        { description: { contains: params.search } },
        { category: { contains: params.search } },
      ];
    }

    // Filter by department if the user is NOT an admin/manager
    if (!params?.can_manage) {
      if (params?.user_department_name) {
        where.OR = [
          { target_department: { contains: 'All Departments' } },
          { target_department: { contains: params.user_department_name } }
        ];
      } else {
        where.target_department = { contains: 'All Departments' };
      }
    }

    const items = await prisma.document.findMany({
      where,
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            details: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return items.map(item => this.mapToResponse(item));
  }

  async getById(id: number) {
    const item = await prisma.document.findUnique({
      where: { id },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            details: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    if (!item) return null;
    return this.mapToResponse(item);
  }

  async delete(id: number) {
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) throw new Error('Document not found');
    await prisma.document.delete({ where: { id } });
  }

  async incrementViews(id: number) {
    await prisma.document.update({
      where: { id },
      data: { views_count: { increment: 1 } },
    });
  }

  async incrementDownloads(id: number) {
    await prisma.document.update({
      where: { id },
      data: { downloads_count: { increment: 1 } },
    });
  }

  private mapToResponse(item: any) {
    const fullName = item.uploader?.details
      ? `${item.uploader.details.first_name ?? ''} ${item.uploader.details.last_name ?? ''}`.trim()
      : null;

    return {
      id: String(item.id),
      title: item.title,
      description: item.description ?? '',
      type: item.file_type?.toUpperCase()?.includes('PDF') ? 'PDF' as const : 'DOC' as const,
      size: item.file_size ? this.formatFileSize(item.file_size) : '0 B',
      category: item.category,
      tab: item.tab ?? 'all',
      access: item.is_restricted ? 'Restricted' as const : 'Public' as const,
      views: item.views_count,
      downloads: item.downloads_count,
      updatedAt: this.formatDate(item.updated_at),
      isNew: this.isNew(item.created_at),
      isUpdated: this.isUpdated(item.updated_at, item.created_at),
      isStarred: false,
      uploaded_by: item.uploaded_by,
      uploader: item.uploader ? {
        id: item.uploader.id,
        username: item.uploader.username,
        full_name: fullName || item.uploader.username,
      } : undefined,
      version: item.version ?? '1.0',
      created_at: item.created_at,
      updated_at: item.updated_at,
      tags: item.tags || [],
      file_url: item.file_url || '',
      target_department: item.target_department || 'All Departments',
    };
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private isNew(createdAt: Date): boolean {
    const daysDiff = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  }

  private isUpdated(updatedAt: Date, createdAt: Date): boolean {
    if (updatedAt.getTime() === createdAt.getTime()) return false;
    const daysDiff = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 3;
  }
}

export const documentService = new DocumentService();
