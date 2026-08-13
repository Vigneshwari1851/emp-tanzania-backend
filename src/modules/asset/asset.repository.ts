// ─── Asset Repository ─────────────────────────────────────────────────────
// Data access layer for the Asset module. No business logic here.
// All database queries are tenant-scoped.

import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';

export interface AssetFilters {
  organizationId: number;
  status?: string;
  categoryId?: number;
  locationId?: number;
  search?: string;
  page: number;
  limit: number;
}

export class AssetRepository {
  async findMany(filters: AssetFilters) {
    const where: Prisma.AssetWhereInput = {
      organization_id: filters.organizationId,
      is_deleted: false,
      ...(filters.status && { status: filters.status }),
      ...(filters.categoryId && { category_id: filters.categoryId }),
      ...(filters.locationId && { location_id: filters.locationId }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search } },
          { serial_number: { contains: filters.search } },
          { asset_tag: { contains: filters.search } },
        ],
      }),
    };

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        take: filters.limit,
        skip: (filters.page - 1) * filters.limit,
        orderBy: { created_at: 'desc' },
        include: { 
          category: true, 
          location: true,
          assignments: {
            where: { status: 'ACTIVE' },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                  status: true,
                  details: {
                    select: {
                      first_name: true,
                      last_name: true,
                      employee_id: true,
                      phone: true,
                      gender: true,
                      date_of_birth: true,
                      blood_group: true,
                      base_salary: true,
                      start_date: true,
                      work_location: true,
                      probation_period: true,
                      employment_type: true,
                      address: true,
                      city: true,
                      state: true,
                      country: true,
                      bank_name: true,
                      account_number: true,
                      ifsc_code: true,
                      pan_number: true,
                      aadhaar_number: true,
                      shift_id: true,
                      department: { select: { department_name: true } },
                      designation: { select: { designation_name: true } },
                      role: { select: { role_name: true } },
                      team: { select: { team_name: true } },
                      payroll_group: { select: { name: true } },
                      user_types: { select: { name: true } },
                      reporting_manager: { select: { username: true } }
                    }
                  }
                }
              }
            }
          }
        },
      }),
      prisma.asset.count({ where }),
    ]);

    return { assets, total };
  }

  async findById(id: number, organizationId: number) {
    return prisma.asset.findFirst({
      where: { id, organization_id: organizationId, is_deleted: false },
      include: {
        category: true,
        location: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                details: {
                  select: {
                    first_name: true,
                    last_name: true,
                    employee_id: true,
                    start_date: true,
                    work_location: true,
                    department: {
                      select: {
                        department_name: true,
                        branches: {
                          select: {
                            branch_name: true,
                          },
                        },
                      },
                    },
                    team: {
                      select: {
                        team_name: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { issue_date: 'desc' },
        },
        history: {
          orderBy: { created_at: 'desc' },
          include: {
            changed_by: {
              select: {
                id: true,
                username: true,
                email: true,
                details: {
                  select: {
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
          take: 20,
        },
        documents: {
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  async create(data: Prisma.AssetCreateInput) {
    return prisma.asset.create({ data });
  }

  async update(id: number, organizationId: number, data: Prisma.AssetUpdateInput) {
    return prisma.asset.update({
      where: { id, organization_id: organizationId },
      data,
    });
  }

  async softDelete(id: number, organizationId: number) {
    return prisma.asset.update({
      where: { id, organization_id: organizationId },
      data: { is_deleted: true },
    });
  }

  async findBySerialNumber(serialNumber: string, organizationId: number) {
    return prisma.asset.findFirst({
      where: { serial_number: serialNumber, organization_id: organizationId, is_deleted: false },
    });
  }

  // ─── Category Queries ─────────────────────────────────────────────────
  async findCategories(organizationId: number) {
    return prisma.assetCategory.findMany({
      where: { organization_id: organizationId, is_deleted: false },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(data: Prisma.AssetCategoryCreateInput) {
    return prisma.assetCategory.create({ data });
  }

  // ─── Location Queries ─────────────────────────────────────────────────
  async findLocations(organizationId: number) {
    return prisma.assetLocation.findMany({
      where: { organization_id: organizationId, is_deleted: false },
      orderBy: { name: 'asc' },
    });
  }

  async createLocation(data: Prisma.AssetLocationCreateInput) {
    return prisma.assetLocation.create({ data });
  }

  // ─── History ──────────────────────────────────────────────────────────
  async createHistory(data: Prisma.AssetHistoryCreateInput) {
    return prisma.assetHistory.create({ data });
  }

  async findHistoryByAssetId(assetId: number, organizationId: number, limit = 50) {
    return prisma.assetHistory.findMany({
      where: { asset_id: assetId, organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      include: {
        changed_by: {
          select: {
            id: true,
            username: true,
            email: true,
            details: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      take: limit,
    });
  }
}
