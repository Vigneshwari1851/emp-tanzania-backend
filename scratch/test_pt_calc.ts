import { StatutoryEngine } from '../src/modules/payroll/statutory.engine';

async function test() {
  const gross = 30000;
  
  const states = ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat'];
  
  console.log(`--- Testing PT Slabs for Gross Salary: ${gross} ---`);
  for (const state of states) {
    const res = await StatutoryEngine.calculatePT(gross, state);
    console.log(`State: ${state} => PT Amount: ${res}`);
  }
}

test()
  .catch(console.error);
