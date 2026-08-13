async function main() {
  try {
    console.log('Logging in to send OTP...');
    const loginRes = await fetch('http://localhost:5000/employee-api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'superadmin@gmail.com',
        password: '12345678'
      })
    });
    const loginData = await loginRes.json() as any;
    const token = loginData.data?.token || 'token';

    console.log('Verifying OTP with default 123456...');
    const verifyRes = await fetch('http://localhost:5000/employee-api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'superadmin@gmail.com',
        otp: '123456'
      })
    });
    const verifyData = await verifyRes.json() as any;
    const jwtToken = verifyData.data?.token;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    };

    console.log('Testing GET /roles/permissions/all...');
    const allRes = await fetch('http://localhost:5000/employee-api/roles/permissions/all', {
      headers
    });
    console.log('All Status:', allRes.status);
    const allData = await allRes.json() as any;
    console.log('All Data Count:', allData.data?.length);
    console.log('First 2 all permissions:', JSON.stringify(allData.data?.slice(0, 2), null, 2));

    console.log('Testing GET /roles/2/permissions...');
    const res = await fetch('http://localhost:5000/employee-api/roles/2/permissions', {
      headers
    });
    console.log('Role Permissions Status:', res.status);
    const resData = await res.json() as any;
    console.log('Role Permissions Count:', resData.data?.length);
    console.log('First 2 role permissions:', JSON.stringify(resData.data?.slice(0, 2), null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();
