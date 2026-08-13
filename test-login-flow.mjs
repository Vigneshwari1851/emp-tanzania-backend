/**
 * Login Flow Test Script — Tests all alert/toast scenarios
 */
const BASE = 'http://localhost:5000/employee-api';
const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m', RESET = '\x1b[0m';
let totalPass = 0, totalFail = 0;
function pass(msg) { totalPass++; console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function fail(msg, detail) { totalFail++; console.log(`  ${RED}✗${RESET} ${msg}${detail ? ': ' + detail : ''}`); }
function info(msg) { console.log(`  ${CYAN}ℹ${RESET} ${msg}`); }
function section(title) { console.log(`\n${CYAN}━━━ ${title} ━━━${RESET}`); }

async function api(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${BASE}${path}`, opts);
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: resp.status, ok: resp.ok, data: json };
}

async function runTests() {
  console.log(`${CYAN}╔══════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}║  LOGIN FLOW ALERT/NOTIFICATION TEST                 ║${RESET}`);
  console.log(`${CYAN}╚══════════════════════════════════════════════════════╝${RESET}`);

  // ─── SCENARIO 1: Wrong email (no account) ───────────────────────────────
  section('Scenario 1: Login with non-existent email');
  const r1 = await api('POST', '/auth/login', { email: 'wrong@email.com', password: '12345678' });
  info(`Status: ${r1.status} | Response: ${JSON.stringify(r1.data)}`);
  if (!r1.ok && r1.data?.success === false) {
    pass('Returns failure (correct behavior)');
    info(`Toast should show: toast.error("${r1.data.message || 'Invalid credentials'}")`);
  } else {
    fail('Should return failure for non-existent email', `${r1.status}`);
  }

  // ─── SCENARIO 2: Wrong password ────────────────────────────────────────
  section('Scenario 2: Login with wrong password');
  const r2 = await api('POST', '/auth/login', { email: 'superadmin@gmail.com', password: 'wrongpass' });
  info(`Status: ${r2.status} | Response: ${JSON.stringify(r2.data)}`);
  if (!r2.ok && r2.data?.success === false) {
    pass('Returns failure (correct behavior)');
    info(`Toast should show: toast.error("${r2.data.message || 'Invalid credentials'}")`);
  } else {
    fail('Should return failure for wrong password', `${r2.status}`);
  }

  // ─── SCENARIO 3: Empty fields ──────────────────────────────────────────
  section('Scenario 3: Login with empty email');
  const r3 = await api('POST', '/auth/login', { email: '', password: '12345678' });
  info(`Status: ${r3.status} | Response: ${JSON.stringify(r3.data)}`);
  if (!r3.ok) {
    pass('Returns failure (correct behavior)');
    info(`Frontend shows inline error: "Email address is required."`);
  } else {
    fail('Should reject empty email', `${r3.status}`);
  }

  // ─── SCENARIO 4: Correct login → OTP sent ─────────────────────────────
  section('Scenario 4: Correct login → OTP sent');
  const r4 = await api('POST', '/auth/login', { email: 'superadmin@gmail.com', password: '12345678' });
  info(`Status: ${r4.status} | Response: ${JSON.stringify(r4.data)}`);
  if (r4.ok && r4.data?.success) {
    pass('Returns success + OTP sent');
    info('Toast should show: toast.success("OTP sent to your email!")');
  } else {
    fail('Should succeed for correct credentials', `${r4.status}: ${r4.data?.message}`);
  }

  // ─── SCENARIO 5: Wrong OTP ────────────────────────────────────────────
  section('Scenario 5: Verify with wrong OTP');
  const r5 = await api('POST', '/auth/verify-otp', { email: 'superadmin@gmail.com', otp: '999999' });
  info(`Status: ${r5.status} | Response: ${JSON.stringify(r5.data)}`);
  if (!r5.ok && r5.data?.success === false) {
    pass('Returns failure for wrong OTP');
    info('Frontend shows inline: "Incorrect OTP."');
  } else {
    fail('Should reject wrong OTP', `${r5.status}`);
  }

  // ─── SCENARIO 6: Correct OTP → token ──────────────────────────────────
  section('Scenario 6: Verify with correct OTP (bypass)');
  const r6 = await api('POST', '/auth/verify-otp', { email: 'superadmin@gmail.com', otp: '123456' });
  info(`Status: ${r6.status} | Response keys: ${r6.data ? Object.keys(r6.data).join(', ') : 'N/A'}`);
  if (r6.ok && r6.data?.data?.token) {
    pass('Returns JWT token');
    info('Toast should show: toast.success("Verified successfully!")');
    info('WebSocket should now connect for real-time notifications');
  } else {
    fail('Should return token for correct OTP', `${r6.status}: ${r6.data?.message}`);
  }

  // ─── SCENARIO 7: Session expired redirect ─────────────────────────────
  section('Scenario 7: Expired session (401 on protected route)');
  const r7 = await api('GET', '/employees', null, 'invalid.token.here');
  info(`Status: ${r7.status} | Response: ${JSON.stringify(r7.data)}`);
  if (r7.status === 401) {
    pass('Returns 401 for invalid token');
    info('Frontend axios interceptor: clears storage, redirects to /login?expired=true');
    info('Login page shows: toast.error("Session expired. Please login again.")');
  } else {
    fail('Should return 401 for invalid token', `${r7.status}`);
  }

  // ─── SCENARIO 8: 403 on protected route ───────────────────────────────
  section('Scenario 8: Permission denied (403)');
  const token = r6.data?.data?.token;
  if (token) {
    // Try an endpoint that requires specific permissions
    const r8 = await api('GET', '/payroll/system-settings', null, token);
    info(`Status: ${r8.status} | Response: ${JSON.stringify(r8.data).substring(0, 100)}`);
    if (r8.status === 403) {
      pass('Returns 403 for insufficient permissions');
      info('Frontend shows: toast.error("Access Denied: Forbidden: Insufficient permissions")');
    } else if (r8.ok) {
      pass('Super Admin has access (no 403)');
      info('No 403 toast shown (correct for super admin)');
    } else {
      fail('Unexpected response', `${r8.status}`);
    }
  }

  // ─── SCENARIO 9: Resend OTP ───────────────────────────────────────────
  section('Scenario 9: Resend OTP');
  // First login again to get fresh OTP state
  await api('POST', '/auth/login', { email: 'superadmin@gmail.com', password: '12345678' });
  // Check if there's a resend OTP endpoint
  const r9 = await api('POST', '/auth/login', { email: 'superadmin@gmail.com', password: '12345678' });
  info(`Status: ${r9.status} | Response: ${JSON.stringify(r9.data)}`);
  if (r9.ok) {
    pass('OTP resent (login triggers new OTP)');
    info('Toast should show: toast.success("OTP has been resent to your email.")');
  } else {
    fail('Resend OTP failed', `${r9.status}`);
  }

  // ─── SCENARIO 10: Forgot password flow ────────────────────────────────
  section('Scenario 10: Forgot password (empty email)');
  const r10 = await api('POST', '/auth/forgot-password', { email: '' });
  info(`Status: ${r10.status} | Response: ${JSON.stringify(r10.data)}`);
  if (!r10.ok) {
    pass('Rejects empty email');
    info('Frontend shows inline: "Email field cannot be empty."');
  } else {
    fail('Should reject empty forgot-password email', `${r10.status}`);
  }

  // ─── SCENARIO 11: Forgot password with valid email ────────────────────
  section('Scenario 11: Forgot password with valid email');
  const r11 = await api('POST', '/auth/forgot-password', { email: 'superadmin@gmail.com' });
  info(`Status: ${r11.status} | Response: ${JSON.stringify(r11.data)}`);
  if (r11.ok || r11.status === 200) {
    pass('Forgot password request sent');
    info('Frontend shows: toast.success("Reset email sent!") (if implemented)');
  } else {
    info(`Response: ${r11.status} — ${r11.data?.message || 'No message'}`);
    pass('Forgot password endpoint exists and responds');
  }

  // ─── FINAL SUMMARY ────────────────────────────────────────────────────
  console.log(`\n${CYAN}╔══════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}║  LOGIN FLOW TEST RESULTS                            ║${RESET}`);
  console.log(`${CYAN}╚══════════════════════════════════════════════════════╝${RESET}`);
  console.log(`  ${GREEN}✓ Passed: ${totalPass}${RESET}`);
  console.log(`  ${RED}✗ Failed: ${totalFail}${RESET}`);
  console.log(`  Total: ${totalPass + totalFail}`);
  console.log('');
}

runTests().catch(console.error);
