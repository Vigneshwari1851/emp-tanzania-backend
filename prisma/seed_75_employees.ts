import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const indianFirstNamesM = [
  'Aarav', 'Amit', 'Arjun', 'Aditya', 'Abhinav', 'Balaji', 'Chandran', 'Deepak', 'Dinesh', 'Gaurav', 
  'Hari', 'Ishaan', 'Jay', 'Karthik', 'Kunal', 'Manish', 'Manoj', 'Nikhil', 'Pranav', 'Rahul', 
  'Rajesh', 'Rohan', 'Sanjay', 'Sandeep', 'Suresh', 'Sameer', 'Tarun', 'Uday', 'Vikram', 'Vijay', 
  'Vivek', 'Yash', 'Vignesh', 'Ramesh', 'Venkat', 'Anand', 'Kiran', 'Sunil', 'Rakesh', 'Harish', 
  'Nitin', 'Srikanth', 'Devendra', 'Kalyan', 'Krishna', 'Madhav', 'Pavan', 'Raman', 'Shankar', 'Srinivas'
];

const indianFirstNamesF = [
  'Ananya', 'Sneha', 'Pooja', 'Priyanka', 'Divya', 'Aditi', 'Neha', 'Ritu', 'Meera', 'Shreya', 
  'Kavita', 'Priya', 'Swati', 'Deepa', 'Geetha', 'Lakshmi', 'Radha', 'Swetha', 'Kausalya', 'Amrutha', 
  'Deepika', 'Harini', 'Nithya', 'Shruti', 'Preethi', 'Archana', 'Sandhya', 'Anjali', 'Bhavana', 'Chitra', 
  'Gayatri', 'Indira', 'Jyothi', 'Kavya', 'Malini', 'Nisha', 'Parvathi', 'Rupa', 'Sarada', 'Uma'
];

const indianLastNames = [
  'Sharma', 'Verma', 'Patel', 'Mehta', 'Sen', 'Das', 'Nair', 'Reddy', 'Iyer', 'Rao', 
  'Joshi', 'Kulkarni', 'Bhat', 'Hegde', 'Singh', 'Kumar', 'Gupta', 'Saxena', 'Mishra', 'Trivedi', 
  'Menon', 'Pillai', 'Choudhury', 'Banerjee', 'Mukherjee', 'Chatterjee', 'Bose', 'Roy', 'Dutta', 'Saini',
  'Gowda', 'Shetty', 'Pillay', 'Deshmukh', 'Kadam', 'Shinde', 'Jadhav', 'Naidu', 'Chowdary', 'Murthy'
];

const cities = [
  { city: 'Bangalore', state: 'Karnataka', zip: '560001' },
  { city: 'Chennai', state: 'Tamil Nadu', zip: '600001' },
  { city: 'Hyderabad', state: 'Telangana', zip: '500001' },
  { city: 'Mumbai', state: 'Maharashtra', zip: '400001' },
  { city: 'Pune', state: 'Maharashtra', zip: '411001' },
  { city: 'Delhi', state: 'Delhi', zip: '110001' },
  { city: 'Coimbatore', state: 'Tamil Nadu', zip: '641001' }
];

const banks = [
  { name: 'HDFC Bank', ifsc: 'HDFC0000123' },
  { name: 'ICICI Bank', ifsc: 'ICIC0000456' },
  { name: 'State Bank of India', ifsc: 'SBIN0000789' },
  { name: 'Axis Bank', ifsc: 'UTIB0000999' },
  { name: 'Federal Bank', ifsc: 'FDRL0000888' },
  { name: 'Canara Bank', ifsc: 'CNRB0000222' }
];

// Helper to generate secondary address
function generateSecondaryAddress() {
  const cityObj = getRandomItem(cities);
  return {
    address: `${Math.floor(Math.random() * 100) + 1}, Secondary Road, ${cityObj.city}`,
    city: cityObj.city,
    state: cityObj.state,
    zip: cityObj.zip,
    country: 'India',
  };
}

// Helper to generate emergency contact info
function generateEmergencyContact() {
  const phone = generatePhoneNumber();
  const name = getRandomItem(indianFirstNamesM.concat(indianFirstNamesF));
  return {
    emergency_contact: `${name} ${Math.floor(Math.random() * 1000)}`,
    emergency_relationship: getRandomItem(['Spouse', 'Parent', 'Sibling', 'Friend']),
    emergency_phone: phone,
    emergency_email: `${name.toLowerCase()}${Math.floor(Math.random() * 100)}@example.com`,
  };
}

// Helper to get random item
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate random phone number
function generatePhoneNumber(): string {
  const digits = '6789';
  let phone = '+91 ' + getRandomItem(digits.split(''));
  for (let i = 0; i < 9; i++) {
    phone += Math.floor(Math.random() * 10);
  }
  return phone;
}

// Generate random account number
function generateAccountNumber(): string {
  let acc = '';
  for (let i = 0; i < 12; i++) {
    acc += Math.floor(Math.random() * 10);
  }
  return acc;
}

async function main() {
  console.log('Starting seed script for 75 Indian employees...');

  // 1. Fetch existing data for validation and mapping
  const existingUsers = await prisma.user.findMany({ select: { email: true, username: true } });
  const existingEmpDetails = await prisma.userDetail.findMany({ select: { employee_id: true } });

  const emailsUsed = new Set(existingUsers.map(u => u.email.toLowerCase()));
  const usernamesUsed = new Set(existingUsers.map(u => u.username?.toLowerCase() || ''));
  const empIdsUsed = new Set(existingEmpDetails.map(d => d.employee_id?.toLowerCase() || ''));

  // 2. Hash password
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Setup lists of attributes
  let employeeIdCounter = 100;

  // Let's create or get a reference to the organization
  const org = await prisma.organization.findFirst();
  const orgId = org ? org.id : 1;

  console.log(`Using organization ID: ${orgId}`);

  // Look up departments
  const depts = await prisma.department.findMany();
  const deptEngineering = depts.find(d => d.department_name.toLowerCase() === 'engineering')?.id || depts[0]?.id || 1;
  const deptSales = depts.find(d => d.department_name.toLowerCase() === 'sales')?.id || depts[0]?.id || 1;
  const deptHR = depts.find(d => d.department_name.toLowerCase() === 'hr')?.id || depts[0]?.id || 1;
  const deptFinance = depts.find(d => d.department_name.toLowerCase() === 'finance')?.id || depts[0]?.id || 1;
  const deptMarketing = depts.find(d => d.department_name.toLowerCase() === 'marketing')?.id || depts[0]?.id || 1;
  const deptOperations = depts.find(d => d.department_name.toLowerCase() === 'operations' || d.department_name.toLowerCase() === 'administration')?.id || depts[0]?.id || 1;

  // Look up designations
  const desigs = await prisma.designation.findMany();
  const desigSoftwareEngineer = desigs.find(d => d.designation_name.toLowerCase() === 'software engineer')?.id || desigs[0]?.id || 1;
  const desigSeniorEngineer = desigs.find(d => d.designation_name.toLowerCase() === 'senior engineer' || d.designation_name.toLowerCase().includes('senior'))?.id || desigs[0]?.id || 1;
  const desigEngManager = desigs.find(d => d.designation_name.toLowerCase() === 'engineering manager')?.id || desigs[0]?.id || 1;
  const desigFinanceManager = desigs.find(d => d.designation_name.toLowerCase() === 'finance manager')?.id || desigs[0]?.id || 1;
  const desigHRManager = desigs.find(d => d.designation_name.toLowerCase() === 'hr manager')?.id || desigs[0]?.id || 1;
  const desigSalesExecutive = desigs.find(d => d.designation_name.toLowerCase() === 'sales executive')?.id || desigs[0]?.id || 1;
  const desigOperationsExecutive = desigs.find(d => d.designation_name.toLowerCase().includes('operations') || d.designation_name.toLowerCase().includes('executive'))?.id || desigs[0]?.id || 1;
  const desigOperationsManager = desigs.find(d => d.designation_name.toLowerCase().includes('manager'))?.id || desigs[0]?.id || 1;
  const desigHRExecutive = desigs.find(d => d.designation_name.toLowerCase() === 'hr executive' || d.designation_name.toLowerCase().includes('hr'))?.id || desigs[0]?.id || 1;
  const desigAccountant = desigs.find(d => d.designation_name.toLowerCase() === 'accountant' || d.designation_name.toLowerCase().includes('finance'))?.id || desigs[0]?.id || 1;
  const desigMarketingExecutive = desigs.find(d => d.designation_name.toLowerCase() === 'marketing executive' || d.designation_name.toLowerCase().includes('marketing'))?.id || desigs[0]?.id || 1;
  const desigCEO = desigs.find(d => d.designation_name.toLowerCase().includes('chief executive') || d.designation_name.toLowerCase() === 'ceo')?.id || desigs[0]?.id || 1;
  const desigCTO = desigs.find(d => d.designation_name.toLowerCase().includes('chief technology') || d.designation_name.toLowerCase() === 'cto')?.id || desigs[0]?.id || 1;

  // Look up roles
  const roles = await prisma.role.findMany();
  const roleAdmin = roles.find(r => r.role_name.toLowerCase().includes('admin'))?.id || roles[0]?.id || 1;
  const roleManager = roles.find(r => r.role_name.toLowerCase().includes('manager'))?.id || roles[0]?.id || 1;
  const roleUser = roles.find(r => r.role_name.toLowerCase().includes('user') || r.role_name.toLowerCase().includes('employee'))?.id || roles[0]?.id || 1;

  // Look up user types
  const utypes = await prisma.user_types.findMany();
  const utManager = utypes.find(u => u.system_key === 'MANAGER')?.id || utypes[0]?.id || 1;
  const utEmployee = utypes.find(u => u.system_key === 'EMPLOYEE')?.id || utypes[0]?.id || 1;
  const utContractor = utypes.find(u => u.system_key === 'CONTRACTOR')?.id || utypes[0]?.id || 1;
  const utIntern = utypes.find(u => u.system_key === 'INTERN')?.id || utypes[0]?.id || 1;

  let createdCount = 0;

  for (let i = 0; i < 75; i++) {
    // Determine Gender & Name
    const isMale = Math.random() > 0.45;
    const firstName = getRandomItem(isMale ? indianFirstNamesM : indianFirstNamesF);
    const lastName = getRandomItem(indianLastNames);
    const fullName = `${firstName} ${lastName}`;

    // Make unique email
    let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@socedge.com`;
    let suffix = 1;
    while (emailsUsed.has(email.toLowerCase())) {
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@socedge.com`;
      suffix++;
    }
    emailsUsed.add(email.toLowerCase());

    // Make unique username
    let username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
    suffix = 1;
    while (usernamesUsed.has(username.toLowerCase())) {
      username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}${suffix}`;
      suffix++;
    }
    usernamesUsed.add(username.toLowerCase());

    // Make unique employee ID
    let employeeId = `EMP${employeeIdCounter}`;
    while (empIdsUsed.has(employeeId.toLowerCase())) {
      employeeIdCounter++;
      employeeId = `EMP${employeeIdCounter}`;
    }
    empIdsUsed.add(employeeId.toLowerCase());
    employeeIdCounter++;

    // Determine role, department, designation, and user type
    let departmentId = deptEngineering;
    let roleId = roleUser;
    let designationId = desigSoftwareEngineer;
    let userTypeId = utEmployee;
    let employmentType = 'Full-time';
    let baseSalary = 50000;

    // Distribute Roles and Departments
    if (i === 0) {
      // 1 CEO
      departmentId = deptOperations;
      roleId = roleAdmin;
      designationId = desigCEO;
      userTypeId = utManager;
      baseSalary = 350000;
    } else if (i === 1) {
      // 1 CTO
      departmentId = deptEngineering;
      roleId = roleManager;
      designationId = desigCTO;
      userTypeId = utManager;
      baseSalary = 280000;
    } else if (i >= 2 && i <= 7) {
      // Department Managers
      userTypeId = utManager;
      roleId = roleManager;
      employmentType = 'Full-time';
      baseSalary = 150000 + Math.floor(Math.random() * 50000);

      switch (i) {
        case 2: // Engineering Manager
          departmentId = deptEngineering;
          designationId = desigEngManager;
          break;
        case 3: // Sales Manager
          departmentId = deptSales;
          designationId = desigOperationsManager;
          break;
        case 4: // HR Manager
          departmentId = deptHR;
          designationId = desigHRManager;
          break;
        case 5: // Finance Manager
          departmentId = deptFinance;
          designationId = desigFinanceManager;
          break;
        case 6: // Marketing Manager
          departmentId = deptMarketing;
          designationId = desigMarketingExecutive;
          break;
        case 7: // Operations Manager
          departmentId = deptOperations;
          designationId = desigOperationsManager;
          break;
      }
    } else {
      // Normal employees
      const deptRoll = Math.random();
      if (deptRoll < 0.40) {
        // Engineering (40%)
        departmentId = deptEngineering;
        designationId = Math.random() > 0.3 ? desigSoftwareEngineer : desigSeniorEngineer;
        roleId = roleUser;
        userTypeId = Math.random() > 0.15 ? utEmployee : utIntern;
        baseSalary = userTypeId === utIntern ? 25000 : (designationId === desigSeniorEngineer ? 110000 : 70000) + Math.floor(Math.random() * 20000);
      } else if (deptRoll < 0.55) {
        // Sales (15%)
        departmentId = deptSales;
        designationId = desigSalesExecutive;
        roleId = roleUser;
        userTypeId = utEmployee;
        baseSalary = 45000 + Math.floor(Math.random() * 15000);
      } else if (deptRoll < 0.70) {
        // Human Resources (15%)
        departmentId = deptHR;
        designationId = desigHRExecutive;
        roleId = roleUser;
        userTypeId = utEmployee;
        baseSalary = 40000 + Math.floor(Math.random() * 15000);
      } else if (deptRoll < 0.80) {
        // Finance (10%)
        departmentId = deptFinance;
        designationId = desigAccountant;
        roleId = roleUser;
        userTypeId = utEmployee;
        baseSalary = 50000 + Math.floor(Math.random() * 20000);
      } else if (deptRoll < 0.90) {
        // Marketing (10%)
        departmentId = deptMarketing;
        designationId = desigMarketingExecutive;
        roleId = roleUser;
        userTypeId = utEmployee;
        baseSalary = 40000 + Math.floor(Math.random() * 15000);
      } else {
        // Operations (10%)
        departmentId = deptOperations;
        designationId = desigOperationsExecutive;
        roleId = roleUser;
        userTypeId = Math.random() > 0.2 ? utEmployee : utContractor;
        baseSalary = 35000 + Math.floor(Math.random() * 15000);
      }
    }

    // Set other attributes
    const cityObj = getRandomItem(cities);
    const bankObj = getRandomItem(banks);
    const gender = isMale ? 'Male' : 'Female';
    const maritalStatus = Math.random() > 0.5 ? 'Single' : 'Married';
    const phone = generatePhoneNumber();
    const accNum = generateAccountNumber();

    // Start date in past
    const yearsAgo = 1 + Math.floor(Math.random() * 3);
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - yearsAgo);
    startDate.setMonth(Math.floor(Math.random() * 12));
    startDate.setDate(Math.floor(Math.random() * 28) + 1);

    // Date of Birth (22-45 years old)
    const dob = new Date(startDate);
    dob.setFullYear(dob.getFullYear() - (21 + Math.floor(Math.random() * 20)));

    const address = `${Math.floor(Math.random() * 100) + 1}, Main Road, near Metro Station`;

    // Create User record and UserDetail in database
    try {
      const user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          status: true,
          details: {
            create: {
              first_name: firstName,
              last_name: lastName,
              employee_id: employeeId,
              department_id: departmentId,
              role_id: roleId,
              designation_id: designationId,
              user_type_id: userTypeId,
              employment_type: employmentType,
              start_date: startDate,
              work_location: cityObj.city,
              base_salary: baseSalary,
              currency: 'INR',
              salary_frequency: 'Monthly',
              bank_name: bankObj.name,
              account_number: accNum,
              ifsc_code: bankObj.ifsc,
              phone: phone,
              gender: gender,
              marital_status: maritalStatus,
              date_of_birth: dob,
              nationality: 'Indian',
              address: address,
              city: cityObj.city,
              state: cityObj.state,
              zip: cityObj.zip,
              country: 'India',
              // secondary address fields
              secondary_address: generateSecondaryAddress().address,
              secondary_city: generateSecondaryAddress().city,
              secondary_state: generateSecondaryAddress().state,
              secondary_zip: generateSecondaryAddress().zip,
              secondary_country: generateSecondaryAddress().country,
              // emergency contact fields
              emergency_contact: generateEmergencyContact().emergency_contact,
              emergency_relationship: generateEmergencyContact().emergency_relationship,
              emergency_phone: generateEmergencyContact().emergency_phone,
              emergency_email: generateEmergencyContact().emergency_email,
              secondary_phone: phone,
              secondary_email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@secondary.com`,
              blood_group: getRandomItem(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
              // JSON placeholder fields
              compensation_breakdown: {},
              family_members: {},
              education: {},
              employment_history: {},
              skills: [],
              certifications: [],
              languages: [],
              is_draft: false
            }
          }
        }
      });

      // Link User to Role in user_roles
      await prisma.userRole.create({
        data: {
          user_id: user.id,
          role_id: roleId
        }
      });

      createdCount++;
    } catch (err) {
      console.error(`Failed to seed employee ${fullName}:`, err);
    }
  }

  console.log(`Seeding complete. Successfully seeded ${createdCount} employees!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
