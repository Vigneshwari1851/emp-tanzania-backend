async function main() {
  try {
    const resLeaves = await fetch('http://localhost:5000/employee-api/leaves/history').then(r => r.json());
    console.log('LEAVES HTTP RESPONSE KEYS:', Object.keys(resLeaves));
    console.log('LEAVES DATA TYPE:', typeof resLeaves.data, Array.isArray(resLeaves.data) ? 'Array' : 'Object');
    if (resLeaves.data) {
      console.log('LEAVES DATA KEYS:', Object.keys(resLeaves.data));
      if (Array.isArray(resLeaves.data.data)) {
        console.log('LEAVES DATA.DATA IS ARRAY, LENGTH:', resLeaves.data.data.length);
      }
      console.log('LEAVES DATA PREVIEW:', JSON.stringify(resLeaves.data).substring(0, 200));
    }
  } catch (err) {
    console.error('Leaves fetch failed:', err.message);
  }

  try {
    const resExits = await fetch('http://localhost:5000/employee-api/exit/all-requests').then(r => r.json());
    console.log('EXITS HTTP RESPONSE KEYS:', Object.keys(resExits));
    console.log('EXITS DATA TYPE:', typeof resExits.data, Array.isArray(resExits.data) ? 'Array' : 'Object');
    if (resExits.data) {
      console.log('EXITS DATA PREVIEW:', JSON.stringify(resExits.data).substring(0, 200));
    }
  } catch (err) {
    console.error('Exits fetch failed:', err.message);
  }
}

main();
