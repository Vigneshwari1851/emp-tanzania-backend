import prisma from '../../shared/prisma/client';
import { AppError } from '../../middlewares/error.middleware';

export class AttendanceService {
  /** Returns UTC start and end of the current UTC calendar day */
  private getTodayUTCRange() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));   // e.g. 2026-03-19T00:00:00Z
    const endOfDay   = new Date(Date.UTC(y, m, d, 23, 59, 59, 999)); // e.g. 2026-03-19T23:59:59Z
    return { startOfDay, endOfDay };
  }

  async checkIn(userId: number, data: { location?: string; remarks?: string }) {
    const { startOfDay, endOfDay } = this.getTodayUTCRange();

    // Range query avoids exact-match issues with Prisma/MySQL date conversion
    const existingLog = await prisma.attendance.findFirst({
      where: {
        user_id: userId,
        date: { gte: startOfDay, lte: endOfDay }
      }
    });

    if (existingLog && existingLog.check_in) {
      throw new AppError('Already checked in for today', 400);
    }

    // 1. Fetch user's shift information
    const userDetail = await prisma.userDetail.findUnique({
      where: { user_id: userId },
      select: { shift_id: true, department: { select: { branches: { select: { organization_id: true } } } } }
    });

    let status = 'PRESENT';
    if (userDetail?.shift_id) {
      // 2. Fetch organization shifts using user's orgId
      const orgId = userDetail.department?.branches?.organization_id || 1;
      const org = await prisma.organization.findFirst({
        where: { id: orgId }
      });

      if (org && org.shifts) {
        const shifts = org.shifts as any[];
        const userShift = shifts.find(s => s.id === userDetail.shift_id);

        if (userShift && userShift.startTime) {
          // 3. Calculate if Late
          const [shiftHours, shiftMinutes] = userShift.startTime.split(':').map(Number);
          const now = new Date();
          
          // Create a Date object for today at shift start time
          const shiftStartTime = new Date();
          shiftStartTime.setHours(shiftHours, shiftMinutes, 0, 0);

          // 15-minute grace period
          const gracePeriodMs = 15 * 60 * 1000;
          if (now.getTime() > shiftStartTime.getTime() + gracePeriodMs) {
            status = 'LATE';
          }
        }
      }
    }

    if (existingLog) {
      return await prisma.attendance.update({
        where: { id: existingLog.id },
        data: {
          check_in: new Date(),
          location: data.location,
          remarks: data.remarks,
          status: status
        }
      });
    }

    // upsert handles rare race-condition duplicates
    return await prisma.attendance.upsert({
      where: {
        user_id_date: { user_id: userId, date: startOfDay }
      },
      update: {
        check_in: new Date(),
        location: data.location,
        remarks: data.remarks,
        status: status
      },
      create: {
        user_id: userId,
        date: startOfDay,
        check_in: new Date(),
        location: data.location,
        remarks: data.remarks,
        status: status
      }
    });
  }

  async checkOut(userId: number, data: { remarks?: string }) {
    const { startOfDay, endOfDay } = this.getTodayUTCRange();

    const log = await prisma.attendance.findFirst({
      where: {
        user_id: userId,
        date: { gte: startOfDay, lte: endOfDay }
      }
    });

    if (!log || !log.check_in) {
      throw new AppError('Check-in record not found for today', 400);
    }

    if (log.check_out) {
      throw new AppError('Already checked out for today', 400);
    }

    const checkOutTime = new Date();
    const workHours = (checkOutTime.getTime() - log.check_in.getTime()) / (1000 * 60 * 60);

    return await prisma.attendance.update({
      where: { id: log.id },
      data: {
        check_out: checkOutTime,
        work_hours: parseFloat(workHours.toFixed(2)),
        remarks: data.remarks ? `${log.remarks || ''}\nCheckout: ${data.remarks}` : log.remarks
      }
    });
  }



  async getMyLogs(userId: number, filters: { startDate?: string; endDate?: string; status?: string } = {}) {
    const where: any = { user_id: userId };
    
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setUTCHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (filters.status && filters.status.toUpperCase() !== 'ALL') {
      where.status = filters.status.toUpperCase();
    }

    return await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      take: filters.startDate || filters.endDate ? undefined : 30
    });
  }

  async getTeamLogs(filters: { department_id?: number; date?: string; startDate?: string; endDate?: string; status?: string; orgId?: number }) {
    const where: any = {};
    if (filters.orgId) {
      where.user = { details: { department: { branches: { organization_id: filters.orgId } } } };
    }
    
    if (filters.department_id) {
      if (where.user) {
        where.user.details.department_id = filters.department_id;
      } else {
        where.user = { details: { department_id: filters.department_id } };
      }
    }
    
    if (filters.date) {
      where.date = new Date(filters.date);
    } else if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setUTCHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (filters.status && filters.status.toUpperCase() !== 'ALL') {
      where.status = filters.status.toUpperCase();
    }

    return await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            details: { select: { first_name: true, last_name: true, employee_id: true } }
          }
        }
      },
      orderBy: { date: 'desc' }
    });
  }

  async getDashboardStats(orgId?: number) {
    // Use same UTC range pattern as checkIn/checkOut to match stored dates
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const endOfDay   = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

    const dateFilter = { gte: startOfDay, lte: endOfDay };
    const orgFilter = orgId ? { user: { details: { department: { branches: { organization_id: orgId } } } } } : {};
    const orgUserFilter = orgId ? { details: { department: { branches: { organization_id: orgId } } } } : {};

    const totalEmployees = await prisma.user.count({ where: { is_deleted: false, ...orgUserFilter } });

    const [presentToday, lateToday, halfDayToday, checkedInToday] = await Promise.all([
      prisma.attendance.count({ where: { date: dateFilter, status: 'PRESENT', ...orgFilter } }),
      prisma.attendance.count({ where: { date: dateFilter, status: 'LATE', ...orgFilter } }),
      prisma.attendance.count({ where: { date: dateFilter, status: { in: ['HALF_DAY', 'HALFDAY'] }, ...orgFilter } }),
      prisma.attendance.count({ where: { date: dateFilter, ...orgFilter } })
    ]);

    // Absent = employees who have no attendance record at all today
    const absentToday = Math.max(0, totalEmployees - checkedInToday);

    return {
      totalEmployees,
      presentToday,
      lateToday,
      halfDayToday,
      absentToday
    };
  }
}

export const attendanceService = new AttendanceService();
