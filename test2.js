const questions = [
  { id: 132, parent_question_id: null },
  { id: 133, parent_question_id: 132 },
  { id: 134, parent_question_id: 133 }
];
const mapped = questions.map(q => ({
  id: q.id,
  parent_question_id: q.parent_question_id ?? undefined
}));
const savedRules = [];
for (const q of mapped) {
  if (!q.parent_question_id) continue;
  const parentQ = mapped.find((mq) => mq.id === q.parent_question_id);
  if (!parentQ) continue;
  savedRules.push({ fromId: String(parentQ.id), toId: String(q.id) });
}
console.log("RULES:", savedRules);
