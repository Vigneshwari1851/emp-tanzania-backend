import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';
import { JobFilters } from './job.entity';

export class JobRepository {
  /**
   * Find jobs with pagination and filters
   */
  async findMany(filters: JobFilters) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {
      ...(filters.status && { status: filters.status }),
      ...(filters.department && { department: { contains: filters.department } }),
      ...(filters.location && { location: { contains: filters.location } }),
      ...(filters.search && {
        OR: [
          { title: { contains: filters.search } },
          { description: { contains: filters.search } },
          { job_summary: { contains: filters.search } }
        ]
      })
    };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        take: limit,
        skip: skip,
        orderBy: { created_at: 'desc' },
        include: {
          applications: {
            include: {
              candidate: true
            }
          }
        }
      }),
      prisma.job.count({ where })
    ]);

    return { jobs, total, page, limit };
  }

  /**
   * Find a specific job by job_id
   */
  async findById(job_id: number) {
    return prisma.job.findUnique({
      where: { id: job_id },
      include: {
        applications: {
          include: {
            candidate: true
          }
        }
      }
    });
  }

  /**
   * Create a new job with all enterprise-level fields
   */
  async create(data: Prisma.JobCreateInput) {
    return prisma.job.create({
      data
    });
  }

  /**
   * Update an existing job
   */
  async update(job_id: number, data: Prisma.JobUpdateInput) {
    return prisma.job.update({
      where: { id: job_id },
      data
    });
  }

  /**
   * Delete a job
   */
  async delete(job_id: number) {
    return prisma.job.delete({
      where: { id: job_id }
    });
  }
}
