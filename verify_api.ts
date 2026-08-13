async function testApi() {
  const baseURL = 'http://localhost:5000/employee-api';
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@gmail.com', password: '12345678' })
    });
    const loginData = await loginRes.json() as any;
    if (!loginRes.ok) throw new Error(loginData.message || 'Login failed');
    const token = loginData.data.token;
    console.log('Login successful.');

    // 2. Call new API
    // Let's use dept 1 as discovered before
    const deptId = 1; 
    console.log(`Fetching employees for department ${deptId}...`);
    const res = await fetch(`${baseURL}/departments/employees/${deptId}?roleName=user&context=team`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json() as any;
    console.log('API Response Status:', res.status);
    console.log('Success:', data.success);
    console.log('Message:', data.message);
    
    if (data.data) {
        console.log('Employees found:', data.data.length);
        if (data.data.length > 0) {
            console.log('First employee details:');
            const emp = data.data[0];
            console.log(`- ID: ${emp.id}`);
            console.log(`- Name: ${emp.details?.first_name} ${emp.details?.last_name}`);
            console.log(`- Email: ${emp.email}`);
        }
    } else {
        console.log('No data returned.');
    }
  } catch (error: any) {
    console.error('API Test Failed:', error.message);
  }
}

testApi();
