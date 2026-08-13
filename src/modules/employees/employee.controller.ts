import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../utils/response.util';
import { employeeService } from './employee.service';
import { exportService } from '../../shared/utils/export.service';
import { AppError } from '../../middlewares/error.middleware';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { auditService } from '../audit/audit.service';

function _audit(req: any, action: string, entityId: string | number, newValue?: any, oldValue?: any) {
    auditService.log({
        module: 'EMPLOYEE',
        action,
        entityId: entityId.toString(),
        actorId: req.user?.id || 0,
        newValue,
        oldValue,
        ipAddress: req.ip
    }).catch(() => { });
}

export const createEmployee = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const orgId = authReq.user?.orgId ?? undefined;
        const employee = await employeeService.create(req.body, req.files as any, orgId);
        if (req.body.bulk_upload) {
            _audit(req, 'EMPLOYEE_IMPORTED', employee.id, { email: employee.email, status: employee.status });
        }
        _audit(req, 'EMPLOYEE_CREATED', employee.id, { email: employee.email, status: employee.status });
        sendResponse(res, 201, true, 'Employee created successfully', employee);
    } catch (error) {
        next(error);
    }
};

export const getAllEmployees = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters = req.query as any;
        const authReq = req as AuthRequest;
        filters.orgId = authReq.user?.orgId || null;
        const employees = await employeeService.getAll(filters);
        sendResponse(res, 200, true, 'Employees fetched successfully', employees);
    } catch (error) {
        next(error);
    }
};

export const getEmployeeById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const orgId = authReq.user?.orgId ?? undefined;
        const employee = await employeeService.getById(Number(req.params.id), orgId);
        sendResponse(res, 200, true, 'Employee fetched successfully', employee);
    } catch (error) {
        next(error);
    }
};

export const updateEmployee = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const orgId = authReq.user?.orgId ?? undefined;
        const employee = await employeeService.update(Number(req.params.id), req.body, req.files as any, orgId);
        _audit(req, 'EMPLOYEE_UPDATED', req.params.id as string, { updatedFields: Object.keys(req.body) });
        sendResponse(res, 200, true, 'Employee updated successfully', employee);
    } catch (error) {
        next(error);
    }
};

export const deleteEmployee = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const orgId = authReq.user?.orgId ?? undefined;
        await employeeService.delete(Number(req.params.id), orgId);
        _audit(req, 'EMPLOYEE_DELETED', req.params.id as string);
        sendResponse(res, 200, true, 'Employee deleted successfully');
    } catch (error) {
        next(error);
    }
};

import fs from 'fs';
import path from 'path';

export const exportEmployees = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters = req.query as any;
        const format = filters.format ? String(filters.format).toLowerCase() : 'csv';
        const authReq = req as AuthRequest;
        const orgId = authReq.user?.orgId ?? undefined;

        const result = await employeeService.getAll({ ...filters, orgId, page: 1, limit: 1000000 });
        const employees = result.data.map((emp: any) => ({
            'Employee ID': emp.details?.employee_id || '',
            'Employee Name': `${emp.details?.first_name || ''} ${emp.details?.last_name || ''}`.trim(),
            'Department': emp.details?.department?.department_name || '',
            'Job Title / Designation': emp.details?.role?.role_name || emp.roles?.[0]?.role?.role_name || '',
            'Employment Type': emp.details?.employment_type || '',
            'Joining Date': emp.details?.start_date ? new Date(emp.details.start_date).toISOString().split('T')[0] : '',
            'Work Location / Branch': emp.details?.work_location || '',
            'Reporting Manager': emp.details?.reporting_manager?.username || '',
            'Employee Status': emp.status ? 'Active' : 'Inactive',
            'Email Address': emp.email || '',
            'Phone Number': emp.details?.phone || '',
            'Address': emp.details?.address || '',
            'Date of Birth': emp.details?.date_of_birth ? new Date(emp.details.date_of_birth).toISOString().split('T')[0] : '',
            'Gender': emp.details?.gender || ''
        }));

        let buffer: Buffer;
        let ext: string;

        switch (format) {
            case 'excel':
                buffer = await exportService.generateExcel(employees);
                ext = 'xlsx';
                break;
            case 'pdf':
                buffer = await exportService.generatePDF(employees);
                ext = 'pdf';
                break;
            case 'csv':
            default:
                buffer = await exportService.generateCSV(employees);
                ext = 'csv';
                break;
        }

        _audit(req, 'EMPLOYEE_EXPORTED', 'bulk', { format, count: employees.length });
        result.data.forEach((emp: any) => {
            _audit(req, 'EMPLOYEE_EXPORTED', emp.id, { format });
        });

        res.setHeader('Content-Type', 'application/octet-stream');
        const timestamp = Date.now();
        const filename = `employees_export_${timestamp}.${ext}`;
        const exportDir = path.join(__dirname, '../../../public/exports');

        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        const filePath = path.join(exportDir, filename);
        fs.writeFileSync(filePath, buffer);

        const fileUrl = `${req.protocol}://${req.get('host')}/public/exports/${filename}`;

        return sendResponse(res, 200, true, 'Export successfully generated', { url: fileUrl });
    } catch (error) {
        next(error);
    }
};

export const logExportAudit = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { employeeIds, format } = req.body;
        if (Array.isArray(employeeIds)) {
            _audit(req, 'EMPLOYEE_EXPORTED', 'bulk', { format, count: employeeIds.length });
            employeeIds.forEach((id: number | string) => {
                _audit(req, 'EMPLOYEE_EXPORTED', id, { format });
            });
        }
        return sendResponse(res, 200, true, 'Export audit logged successfully');
    } catch (error) {
        next(error);
    }
};

export const generateEmployeeId = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const nextId = await employeeService.generateNextEmployeeId();
        sendResponse(res, 200, true, 'Employee ID generated successfully', { employee_id: nextId });
    } catch (error) {
        next(error);
    }
};

export const getEmployeesByTeamId = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const employees = await employeeService.getByTeamId(Number(req.params.id));
        sendResponse(res, 200, true, 'Team employees fetched successfully', employees);
    } catch (error) {
        next(error);
    }
};

export const checkDuplicate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, phone } = req.query as { email?: string; phone?: string };
        const result = await employeeService.checkDuplicate(email, phone);
        sendResponse(res, 200, true, 'Duplicate check completed', result);
    } catch (error) {
        next(error);
    }
};

export const getCelebrations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthRequest;
        const orgId = authReq.user?.orgId ?? undefined;
        const celebrations = await employeeService.getCelebrations(orgId);
        sendResponse(res, 200, true, 'Celebrations fetched successfully', celebrations);
    } catch (error) {
        next(error);
    }
};

