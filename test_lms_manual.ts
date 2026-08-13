import jwt from 'jsonwebtoken';
import 'dotenv/config';

const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
const token = jwt.sign({ 
    id: 1, 
    email: 'superadmin@gmail.com', 
    orgId: 1, 
    roles: ['super admin'], 
    permissions: [] 
}, secret);

async function test() {
    console.log('Testing GET /lms/courses/5 with manual token...');
    const res = await fetch('http://localhost:5000/employee-api/lms/courses/5', {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
}
test();
