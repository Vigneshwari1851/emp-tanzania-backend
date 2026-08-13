import 'dotenv/config';

async function testLms() {
  const baseURL = 'http://localhost:5000/employee-api';
  try {
    const loginRes = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@gmail.com', password: '12345678' })
    });
    const loginData = await loginRes.json() as any;
    if (!loginRes.ok) {
        console.log('Login failed:', loginData);
        return;
    }
    const token = loginData.data.token;
    console.log('Token obtained.');

    console.log('Testing GET /lms/courses/5 ...');
    const res = await fetch(`${baseURL}/lms/courses/5`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    try {
        console.log('Data:', JSON.stringify(JSON.parse(text), null, 2));
    } catch {
        console.log('Raw Response:', text);
    }
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}
testLms();
