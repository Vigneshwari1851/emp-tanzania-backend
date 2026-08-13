import prisma from '../../config/prisma';

export class NewsService {
  async create(userId: number, data: {
    title: string;
    content: string;
    image?: string | null;
    access_type: string;
    department_ids?: number[];
    status: string;
  }) {
    const news = await prisma.company_news.create({
      data: {
        title: data.title,
        content: data.content,
        image_url: data.image ?? null,
        access_type: data.access_type,
        status: data.status,
        created_by: userId,
        // @ts-ignore
        updated_at: new Date(),
        departments: data.access_type === 'department' && data.department_ids?.length
          ? {
              create: data.department_ids.map((deptId) => ({
                department_id: deptId,
              })),
            }
          : undefined,
      },
    });

    return this.getById(news.id);
  }

  async update(id: number, data: {
    title: string;
    content: string;
    image?: string | null;
    access_type: string;
    department_ids?: number[];
    status: string;
  }) {
    const existing = await prisma.company_news.findUnique({ where: { id } });
    if (!existing) throw new Error('News item not found');

    await prisma.company_news.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        image_url: data.image ?? null,
        access_type: data.access_type,
        status: data.status,
      },
    });

    if (data.access_type === 'department') {
      await prisma.company_news_departments.deleteMany({
        where: { company_news_id: id },
      });
      if (data.department_ids?.length) {
        await prisma.company_news_departments.createMany({
          data: data.department_ids.map((deptId) => ({
            company_news_id: id,
            department_id: deptId,
          })),
        });
      }
    } else {
      await prisma.company_news_departments.deleteMany({
        where: { company_news_id: id },
      });
    }

    return this.getById(id);
  }

  async list(params?: {
    status?: string;
    access_type?: string;
    department_id?: number;
  }) {
    const where: any = {};

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.access_type) {
      where.access_type = params.access_type;
    }

    if (params?.department_id) {
      where.OR = [
        { access_type: 'public' },
        {
          access_type: 'department',
          departments: {
            some: { department_id: params.department_id },
          },
        },
      ];
    }

    const items = await prisma.company_news.findMany({
      where,
      include: {
        users: {
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
        departments: {
          include: {
            department: {
              select: {
                id: true,
                department_name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return items.map(this.mapToResponse);
  }

  async getById(id: number) {
    const item = await prisma.company_news.findUnique({
      where: { id },
      include: {
        users: {
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
        departments: {
          include: {
            department: {
              select: {
                id: true,
                department_name: true,
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
    const existing = await prisma.company_news.findUnique({ where: { id } });
    if (!existing) throw new Error('News item not found');

    await prisma.company_news_departments.deleteMany({
      where: { company_news_id: id },
    });

    await prisma.company_news.delete({ where: { id } });
  }

  private mapToResponse(item: any) {
    const fullName = item.users?.details
      ? `${item.users.details.first_name ?? ''} ${item.users.details.last_name ?? ''}`.trim()
      : null;

    return {
      id: item.id,
      title: item.title,
      content: item.content,
      image: item.image_url,
      access_type: item.access_type,
      department_ids: item.departments?.map((d: any) => d.department_id) ?? [],
      departments: item.departments?.map((d: any) => ({
        id: d.department.id,
        department_name: d.department.department_name,
      })) ?? [],
      status: item.status,
      created_by: item.created_by,
      author: item.users ? {
        id: item.users.id,
        username: item.users.username,
        full_name: fullName || item.users.username,
      } : undefined,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  }
}

export const newsService = new NewsService();
