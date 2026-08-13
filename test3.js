async function testUpdate() {
  const payload = {
    title: "Employee Pulse",
    questions: [
      {
        type: "TEXT",
        label: "Q1",
        order: 1,
        required: false
      },
      {
        type: "TEXT",
        label: "Q2",
        order: 2,
        required: false,
        parent_question_id: 1,
        trigger_option_id: null
      }
    ]
  };

  try {
    const res = await fetch('http://localhost:5000/api/surveys/7e83d394-155f-4528-ba2e-4bfaae2f5127', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("RESPONSE:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

testUpdate();
