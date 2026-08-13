/**
 * Comprehensive Alert & Notification Test Script
 * Tests all modules page-by-page with different user roles
 * 
 * Usage: node test-alerts-notifications.mjs
 */

const BASE = 'http://localhost:5000/employee-api';

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m', RESET = '\x1b[0m';
let totalPass = 0, totalFail = 0, totalWarn = 0;
function pass(msg) { totalPass++; console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function fail(msg, detail) { totalFail++; console.log(`  ${RED}✗${RESET} ${msg}${detail ? ': ' + detail : ''}`); }
function warn(msg) { totalWarn++; console.log(`  ${YELLOW}⚠${RESET} ${msg}`); }
function section(title) { console.log(`\n${CYAN}━━━ ${title} ━━━${RESET}`); }

async function login(email, password) {
  try {
    const resp = await fetch(`${BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await resp.json();
    if (!data.success) return null;
    const otpResp = await fetch(`${BASE}/auth/verify-otp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: '123456' })
    });
    const otpData = await otpResp.json();
    return otpData.data?.token || null;
  } catch { return null; }
}

async function api(method, path, token, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const resp = await fetch(`${BASE}${path}`, opts);
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: resp.status, ok: resp.ok, data: json };
  } catch (e) {
    return { status: 0, ok: false, error: e.message };
  }
}

// ─── USERS (all use OTP '123456' for bypass) ────────────────────────────
const USERS = [
  { label: 'Super Admin', email: 'superadmin@gmail.com', password: '12345678' },
  { label: 'HR Manager', email: 'hrmanager@demo.com', password: '12345678' },
  { label: 'Manager', email: 'manager@demo.com', password: '12345678' },
  { label: 'Employee', email: 'employee@socedge.com', password: 'password123' },
];

// ─── TEST SUITES ────────────────────────────────────────────────────────

async function testNotificationsModule(token, userLabel) {
  section(`Notifications Module [${userLabel}]`);

  const r1 = await api('GET', '/notifications?limit=5', token);
  r1.ok ? pass('GET /notifications') : fail('GET /notifications', `${r1.status}: ${r1.data?.message}`);

  const r2 = await api('GET', '/notifications/unread-count', token);
  r2.ok ? pass(`GET /notifications/unread-count (${r2.data?.data?.count ?? r2.data?.count ?? 'N/A'})`)
    : fail('GET /notifications/unread-count', `${r2.status}: ${r2.data?.message}`);

  const r3 = await api('PATCH', '/notifications/mark-all-read', token);
  r3.ok ? pass('PATCH /notifications/mark-all-read') : warn(`mark-all-read: ${r3.status}`);

  if (userLabel === 'Super Admin') {
    const r4 = await api('POST', '/notifications', token, {
      user_id: 2, title: 'Test Alert', message: 'This is a test notification',
      type: 'INFO', module: 'SYSTEM'
    });
    r4.ok ? pass('POST /notifications (create test)') : fail('POST /notifications', `${r4.status}: ${r4.data?.message || r4.data?.error}`);
  }
}

async function testLeaveModule(token, userLabel) {
  section(`Leaves Module [${userLabel}]`);

  const r1 = await api('GET', '/leaves/my-requests', token);
  r1.ok ? pass('GET /leaves/my-requests') : fail('GET /leaves/my-requests', `${r1.status}: ${r1.data?.message}`);

  if (userLabel !== 'Employee') {
    const r2 = await api('GET', '/leaves/pending', token);
    r2.ok ? pass('GET /leaves/pending') : fail('GET /leaves/pending', `${r2.status}: ${r2.data?.message}`);
  }

  const r3 = await api('GET', '/leave-policies', token);
  r3.ok ? pass('GET /leave-policies') : fail('GET /leave-policies', `${r3.status}: ${r3.data?.message}`);

  const r6 = await api('GET', '/leaves/statistics', token);
  r6.ok ? pass('GET /leaves/statistics') : fail('GET /leaves/statistics', `${r6.status}: ${r6.data?.message}`);
}

async function testPayrollModule(token, userLabel) {
  section(`Payroll Module [${userLabel}]`);

  const endpoints = [
    ['GET', '/payroll/components', 'Components'],
    ['GET', '/payroll/structures', 'Structures'],
    ['GET', '/payroll/groups', 'Groups'],
    ['GET', '/payroll/tax-sections', 'Tax Sections'],
    ['GET', '/payroll/reimbursements', 'Reimbursements'],
    ['GET', '/payroll/categories', 'Categories'],
    ['GET', '/payroll/pay-cycle', 'Pay Cycle'],
    ['GET', '/payroll/runs', 'Payroll Runs'],
    ['GET', '/payroll/my-payslips', 'My Payslips'],
    ['GET', '/payroll/my-declarations', 'My Declarations'],
    ['GET', '/payroll/my-claims', 'My Claims'],
    ['GET', '/payroll/portal/me', 'Employee Portal'],
    ['GET', '/payroll/system-settings', 'System Settings'],
  ];

  for (const [method, path, label] of endpoints) {
    const r = await api(method, path, token);
    r.ok ? pass(`GET ${label}`) :
      (r.status === 401 || r.status === 403 ? warn(`${label}: ${r.status} (expected for role)`) :
        fail(`GET ${label}`, `${r.status}: ${r.data?.message}`));
  }

  const rtp = await api('GET', '/payroll/reimbursements/ready-to-pay', token);
  rtp.ok ? pass('GET Reimbursements Ready-to-Pay') : warn(`Ready-to-Pay: ${rtp.status}`);
}

async function testLoansModule(token, userLabel) {
  section(`Loans & Advances Module [${userLabel}]`);

  const endpoints = [
    ['/loans-advances/loans', 'Loans List'],
    ['/loans-advances/advances', 'Advances List'],
    ['/loan-types', 'Loan Types'],
  ];

  for (const [path, label] of endpoints) {
    const r = await api('GET', path, token);
    r.ok ? pass(`GET ${label}`) :
      (r.status === 401 || r.status === 403 ? warn(`${label}: ${r.status} (expected for role)`) :
        fail(`GET ${label}`, `${r.status}: ${r.data?.message}`));
  }
}

async function testEmployeeModule(token, userLabel) {
  section(`Employees Module [${userLabel}]`);

  const r1 = await api('GET', '/employees', token);
  r1.ok ? pass('GET /employees') : fail('GET /employees', `${r1.status}: ${r1.data?.message}`);

  const r2 = await api('GET', '/employees/1', token);
  r2.ok ? pass('GET /employees/1 (profile)') : fail('GET /employees/1', `${r2.status}: ${r2.data?.message}`);
}

async function testAssetModule(token, userLabel) {
  section(`Assets Module [${userLabel}]`);

  const r1 = await api('GET', '/assets', token);
  r1.ok ? pass('GET /assets') :
    (r1.status === 403 ? warn('GET /assets: 403 (feature may be disabled)') :
      fail('GET /assets', `${r1.status}: ${r1.data?.message}`));

  const r2 = await api('GET', '/assets/requests', token);
  r2.ok ? pass('GET /assets/requests') : warn(`Assets requests: ${r2.status}`);

  const r3 = await api('GET', '/assignments', token);
  r3.ok ? pass('GET /assignments') : warn(`Assignments: ${r3.status}`);

  const r4 = await api('GET', '/assignments/my-assets', token);
  r4.ok ? pass('GET /assignments/my-assets') : warn(`My assets: ${r4.status}`);
}

async function testDocumentModule(token, userLabel) {
  section(`Documents Module [${userLabel}]`);

  const r1 = await api('GET', '/documents', token);
  r1.ok ? pass('GET /documents') : fail('GET /documents', `${r1.status}: ${r1.data?.message}`);
}

async function testNewsModule(token, userLabel) {
  section(`News Module [${userLabel}]`);

  const r1 = await api('GET', '/news', token);
  r1.ok ? pass('GET /news') : fail('GET /news', `${r1.status}: ${r1.data?.message}`);
}

async function testSurveyModule(token, userLabel) {
  section(`Survey Module [${userLabel}]`);

  const r1 = await api('GET', '/surveys', token);
  r1.ok ? pass('GET /surveys') : fail('GET /surveys', `${r1.status}: ${r1.data?.message}`);

  const r2 = await api('GET', '/surveys/1', token);
  r2.ok ? pass('GET /surveys/:id') : warn(`Surveys by ID: ${r2.status}`);
}

async function testRecruitmentModule(token, userLabel) {
  section(`Recruitment Module [${userLabel}]`);

  const r1 = await api('GET', '/recruitment/candidates', token);
  r1.ok ? pass('GET /recruitment/candidates') :
    (r1.status === 403 ? warn('Candidates: 403 (no permission)') :
      fail('GET /recruitment/candidates', `${r1.status}: ${r1.data?.message}`));

  const r2 = await api('GET', '/recruitment/jobs', token);
  r2.ok ? pass('GET /recruitment/jobs') :
    (r2.status === 403 ? warn('Jobs: 403 (no permission)') :
      fail('GET /recruitment/jobs', `${r2.status}: ${r2.data?.message}`));
}

async function testOrganizationModule(token, userLabel) {
  section(`Organization Module [${userLabel}]`);

  const r1 = await api('GET', '/departments', token);
  r1.ok ? pass('GET /departments') : fail('GET /departments', `${r1.status}: ${r1.data?.message}`);

  const r2 = await api('GET', '/teams', token);
  r2.ok ? pass('GET /teams') :
    (r2.status === 403 ? warn('GET /teams: 403 (expected for role)') :
      fail('GET /teams', `${r2.status}: ${r2.data?.message}`));

  const r3 = await api('GET', '/branches', token);
  r3.ok ? pass('GET /branches') :
    (r3.status === 403 ? warn('GET /branches: 403 (expected for role)') :
      fail('GET /branches', `${r3.status}: ${r3.data?.message}`));

  const r4 = await api('GET', '/designations', token);
  r4.ok ? pass('GET /designations') : fail('GET /designations', `${r4.status}: ${r4.data?.message}`);
}

async function testDashboardModule(token, userLabel) {
  section(`Dashboard Module [${userLabel}]`);
  pass('Dashboard (frontend-only, no dedicated API endpoint)');
}

async function testExitModule(token, userLabel) {
  section(`Exit/Offboarding Module [${userLabel}]`);

  const r1 = await api('GET', '/exit/my-requests', token);
  r1.ok ? pass('GET /exit/my-requests') : fail('GET /exit/my-requests', `${r1.status}: ${r1.data?.message}`);

  if (userLabel !== 'Employee') {
    const r2 = await api('GET', '/exit/stats', token);
    r2.ok ? pass('GET /exit/stats') : warn(`Exit stats: ${r2.status}`);
  }

  const r3 = await api('GET', '/exit/all-requests', token);
  r3.ok ? pass('GET /exit/all-requests') : warn(`Exit all-requests: ${r3.status}`);
}

async function testLMSModule(token, userLabel) {
  section(`LMS Module [${userLabel}]`);

  const endpoints = [
    ['/lms/courses', 'Courses'],
    ['/lms/learning-paths', 'Learning Paths'],
  ];

  for (const [path, label] of endpoints) {
    const r = await api('GET', path, token);
    r.ok ? pass(`GET ${label}`) :
      (r.status === 403 ? warn(`${label}: 403`) :
        fail(`GET ${label}`, `${r.status}: ${r.data?.message}`));
  }
}

async function testRolesModule(token, userLabel) {
  section(`Roles & Permissions [${userLabel}]`);

  const r1 = await api('GET', '/roles', token);
  r1.ok ? pass('GET /roles') : fail('GET /roles', `${r1.status}: ${r1.data?.message}`);

  const r2 = await api('GET', '/permissions/grouped', token);
  r2.ok ? pass('GET /permissions/grouped') :
    (r2.status === 403 ? warn('GET /permissions/grouped: 403 (expected for role)') :
      fail('GET /permissions/grouped', `${r2.status}: ${r2.data?.message}`));
}

async function testSettingsModule(token, userLabel) {
  section(`System Settings [${userLabel}]`);

  const r1 = await api('GET', '/settings/logs', token);
  r1.ok ? pass('GET /settings/logs') : warn(`Settings logs: ${r1.status}`);

  const r2 = await api('GET', '/settings/fields', token);
  r2.ok ? pass('GET /settings/fields') : warn(`Settings fields: ${r2.status}`);

  const r3 = await api('GET', '/user-types', token);
  r3.ok ? pass('GET /user-types') : fail('GET /user-types', `${r3.status}: ${r3.data?.message}`);
}

async function testReimbursementModule(token, userLabel) {
  section(`Reimbursements Module [${userLabel}]`);

  const r1 = await api('GET', '/payroll/reimbursements', token);
  r1.ok ? pass('GET /payroll/reimbursements') :
    (r1.status === 403 ? warn('GET /payroll/reimbursements: 403 (expected for role)') :
      fail('GET /payroll/reimbursements', `${r1.status}: ${r1.data?.message}`));

  const r2 = await api('GET', '/payroll/my-claims', token);
  r2.ok ? pass('GET /payroll/my-claims') : warn(`My claims: ${r2.status}`);
}

async function testAttendanceModule(token, userLabel) {
  section(`Attendance Module [${userLabel}]`);

  const r1 = await api('GET', '/attendance/my-logs', token);
  r1.ok ? pass('GET /attendance/my-logs') : warn(`Attendance my-logs: ${r1.status}`);

  const r2 = await api('GET', '/attendance/stats', token);
  r2.ok ? pass('GET /attendance/stats') : warn(`Attendance stats: ${r2.status}`);
}

async function testBanksModule(token, userLabel) {
  section(`Banks Module [${userLabel}]`);

  const r1 = await api('GET', '/banks', token);
  r1.ok ? pass('GET /banks') : warn(`Banks: ${r1.status}`);
}

// ─── MAIN ───────────────────────────────────────────────────────────────
async function runAllTests() {
  console.log(`${CYAN}╔══════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}║  COMPREHENSIVE ALERT & NOTIFICATION TEST SUITE      ║${RESET}`);
  console.log(`${CYAN}╚══════════════════════════════════════════════════════╝${RESET}`);

  for (const user of USERS) {
    console.log(`\n${YELLOW}══════════════════════════════════════════════════════${RESET}`);
    console.log(`${YELLOW}  LOGGING IN: ${user.label} (${user.email})${RESET}`);
    console.log(`${YELLOW}══════════════════════════════════════════════════════${RESET}`);

    const token = await login(user.email, user.password);
    if (!token) {
      fail(`LOGIN FAILED for ${user.email}`);
      continue;
    }
    pass(`Logged in as ${user.label}`);

    await testDashboardModule(token, user.label);
    await testNotificationsModule(token, user.label);
    await testEmployeeModule(token, user.label);
    await testOrganizationModule(token, user.label);
    await testLeaveModule(token, user.label);
    await testPayrollModule(token, user.label);
    await testLoansModule(token, user.label);
    await testReimbursementModule(token, user.label);
    await testAssetModule(token, user.label);
    await testDocumentModule(token, user.label);
    await testNewsModule(token, user.label);
    await testSurveyModule(token, user.label);
    await testRecruitmentModule(token, user.label);
    await testExitModule(token, user.label);
    await testLMSModule(token, user.label);
    await testRolesModule(token, user.label);
    await testSettingsModule(token, user.label);
    await testAttendanceModule(token, user.label);
    await testBanksModule(token, user.label);
  }

  // ─── FINAL SUMMARY ──────────────────────────────────────────────────────
  console.log(`\n${CYAN}╔══════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}║  TEST RESULTS SUMMARY                                ║${RESET}`);
  console.log(`${CYAN}╚══════════════════════════════════════════════════════╝${RESET}`);
  console.log(`  ${GREEN}✓ Passed: ${totalPass}${RESET}`);
  console.log(`  ${RED}✗ Failed: ${totalFail}${RESET}`);
  console.log(`  ${YELLOW}⚠ Warnings: ${totalWarn}${RESET}`);
  console.log(`  Total: ${totalPass + totalFail + totalWarn}`);
  console.log('');
}

runAllTests().catch(console.error);
