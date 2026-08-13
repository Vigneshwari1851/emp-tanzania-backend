async function main() {
  try {
    const res = await fetch('http://localhost:5000/employee-api/employees?limit=1000');
    const json = await res.json();
    console.log('FULL JSON RESPONSE:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error fetching employees:', err.message);
  }
}

main();
