// Evaluation pipeline for Aetherium Sage
// Run with: node Sage_Server/eval.js

require('dotenv').config();
const axios = require('axios');

// --- Dataset: 5+ test samples ---
const testCases = [
  {
    description: 'Simple inventory check',
    history: [],
    user_input: 'I check my satchel.',
    expected: 'satchel',
  },
  {
    description: 'First step on the path',
    history: [],
    user_input: 'I step onto the path and look around.',
    expected: 'forest',
  },
  {
    description: 'Ask about lore',
    history: [],
    user_input: 'What is the legend of the Whispering Falls?',
    expected: 'Whispering Falls',
  },
  {
    description: 'Interact with an NPC',
    history: [
      { role: 'user', text: 'I approach the old man by the fire.' },
      { role: 'model', text: 'The old man looks up, his eyes twinkling.' }
    ],
    user_input: 'I ask him about the path ahead.',
    expected: 'path',
  },
  {
    description: 'Chain of thought reasoning',
    history: [],
    user_input: 'I try to decipher the ancient runes.',
    expected: 'runes',
    chain_of_thought: true
  }
];

// --- Judge prompt ---
// The judge prompt should:
// - Compare the model's output to the expected result
// - Consider relevance, narrative style, and accuracy
// - Be strict about key details, but allow for creative language
const JUDGE_PROMPT = (output, expected, user_input) => `
You are an impartial evaluator for a text-based RPG AI. The user input was: "${user_input}".
The model responded with: "${output}".
The expected key detail or theme is: "${expected}".

Does the model's response address the user's input, include the expected detail, and maintain a narrative, descriptive style? Reply with PASS or FAIL and a brief justification.
`;

// --- Evaluation function ---
async function evaluateTestCase(testCase) {
  const { history, user_input, expected, chain_of_thought } = testCase;
  // Call the Sage server
  const res = await axios.post('http://localhost:3000/aetherium-turn', {
    history,
    user_input,
    chain_of_thought
  });
  const modelOutput = res.data.sage;

  // Use Gemini as a judge (or print for manual review)
  // Here, we simulate judge with a simple string check for demo
  const judgePrompt = JUDGE_PROMPT(modelOutput, expected, user_input);
  const pass = modelOutput && modelOutput.toLowerCase().includes(expected.toLowerCase());
  return {
    description: testCase.description,
    user_input,
    expected,
    modelOutput,
    pass,
    judgePrompt,
  };
}

// --- Run all test cases ---
(async () => {
  console.log('Running evaluation pipeline...');
  let passCount = 0;
  for (const testCase of testCases) {
    const result = await evaluateTestCase(testCase);
    console.log(`\nTest: ${result.description}`);
    console.log(`User input: ${result.user_input}`);
    console.log(`Expected: ${result.expected}`);
    console.log(`Model output: ${result.modelOutput}`);
    console.log(`Judge prompt: ${result.judgePrompt}`);
    console.log(`Result: ${result.pass ? 'PASS' : 'FAIL'}`);
    if (result.pass) passCount++;
  }
  console.log(`\n${passCount}/${testCases.length} tests passed.`);
})();
