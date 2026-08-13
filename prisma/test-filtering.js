const { employeeService } = require('../src/modules/employees/employee.service');

async function main() {
  const result = await employeeService.getAll({ limit: 1000 });
  const employees = result.data;
  console.log('Got employees:', employees.length);

  const searchTerm = "";
  const filters = {
    department: [],
    role: [],
    location: [],
    status: [],
  };

  const filtered = employees.filter((emp) => {
      // 1. Normalize Search Term
      const searchStr = searchTerm.toLowerCase().trim();
      
      // 2. Normalize Employee Data for Comparison
      const firstName = (emp.details?.first_name ?? "").toLowerCase();
      const lastName = (emp.details?.last_name ?? "").toLowerCase();
      const fullName = `${firstName} ${lastName}`;
      const empEmail = (emp.email ?? "").toLowerCase();
      const empDept = (emp.details?.department?.department_name ?? "").toLowerCase();
      const empRole = (emp.details?.role?.name || emp.details?.role?.role_name || emp.details?.job_role || "Associate").toLowerCase();
      const empLoc = (emp.details?.work_location || "Remote").toLowerCase();
      const empStatus = (emp.details?.is_draft ? "Draft" : emp.status ? "Active" : "Inactive").toLowerCase();

      // 0. Exclude Super Admin from the list
      if (empRole === 'super_admin' || empRole === 'super admin') return false;

      // 3. Search Filter (matches name, email, or department) - Always a prerequisite
      const isSearchActive = searchStr.length > 0;
      const matchesSearch = !isSearchActive || 
                          fullName.includes(searchStr) || 
                          empEmail.includes(searchStr) || 
                          empDept.includes(searchStr);
      
      if (!matchesSearch) return false;

      // 4. Normalize Active Filters
      const filterDepts = filters.department.map(v => v.toLowerCase().trim());
      const filterRoles = filters.role.map(v => v.toLowerCase().trim());
      const filterLocs = filters.location.map(v => v.toLowerCase().trim());
      const filterStatuses = filters.status.map(v => v.toLowerCase().trim());

      const hasDeptFilter = filterDepts.length > 0;
      const hasRoleFilter = filterRoles.length > 0;
      const hasLocFilter = filterLocs.length > 0;
      const hasStatusFilter = filterStatuses.length > 0;

      // 5. AND-based Category Filtering (OR within categories)
      // Employee must match ALL categories that have at least one selection
      const matchesDept = !hasDeptFilter || filterDepts.includes(empDept);
      const matchesRole = !hasRoleFilter || filterRoles.includes(empRole);
      const matchesLoc = !hasLocFilter || filterLocs.includes(empLoc);
      
      // For status, handle multiple possible matches (e.g. "Active" vs specific states)
      const matchesStatus = !hasStatusFilter || filterStatuses.includes(empStatus);

      const keep = matchesDept && matchesRole && matchesLoc && matchesStatus;
      console.log(`Emp: ${fullName}, empRole: ${empRole}, keep: ${keep}`);
      return keep;
  });

  console.log('Filtered count:', filtered.length);
}

main().catch(console.error);
