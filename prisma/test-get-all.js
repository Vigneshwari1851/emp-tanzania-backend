const { employeeService } = require('../src/modules/employees/employee.service');

async function main() {
  const result = await employeeService.getAll({ limit: 1000 });
  console.log('Result length:', result.data.length);
  console.log('Sample detail:', JSON.stringify(result.data[0], null, 2));
}

main().catch(console.error);
