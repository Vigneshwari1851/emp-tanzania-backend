import { employeeService } from './src/modules/employees/employee.service';
import { exportService } from './src/shared/utils/export.service';
import fs from 'fs';

async function generate() {
    const result = await employeeService.getAll({ page: 1, limit: 1000000 });
    const employees = result.data.map((emp: any) => ({
        id: emp.id,
        email: emp.email,
        username: emp.username,
        status: emp.status ? 'Active' : 'Inactive',
        first_name: emp.details?.first_name || '',
        last_name: emp.details?.last_name || '',
        job_role: emp.details?.job_role || '',
        department: emp.details?.department?.department_name || '',
        work_location: emp.details?.work_location || '',
        phone: emp.details?.phone || '',
        address: emp.details?.address || '',
        start_date: emp.details?.start_date ? new Date(emp.details.start_date).toISOString().split('T')[0] : '',
        reporting_manager: emp.details?.reporting_manager?.username || '',
        created_at: emp.created_at
    }));

    const buffer = await exportService.generateCSV(employees);
    fs.writeFileSync('C:\\Users\\Asus\\.gemini\\antigravity\\brain\\8f4ded21-b6e1-4cba-870c-e15df184691b\\employees_export.csv', buffer);
    console.log("Export File Generated");
    process.exit(0);
}
generate().catch(e => { console.error(e); process.exit(1); });
