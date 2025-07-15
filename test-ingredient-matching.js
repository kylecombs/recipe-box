// Test script for ingredient matching
// Run with: node test-ingredient-matching.js

const { 
  normalizeIngredientName, 
  getCanonicalIngredientName, 
  areIngredientsEqual, 
  combineQuantities 
} = require('./app/utils/ingredient-matcher.server.ts');

console.log('🧪 Testing Ingredient Matching\n');

// Test cases from user examples
const testCases = [
  {
    name1: "zucchini or summer squash (about 8 ounces each), trimmed and halved lengthwise",
    name2: "zucchini, sliced into 1/4-inch-thick pieces (for larger zucchini, cut in half lengthwise before slicing)",
    shouldMatch: true
  },
  {
    name1: "2 large onions, diced",
    name2: "1 yellow onion, chopped",
    shouldMatch: true
  },
  {
    name1: "fresh parsley, chopped",
    name2: "flat-leaf parsley",
    shouldMatch: true
  },
  {
    name1: "bell pepper, seeded and diced",
    name2: "sweet pepper, cut into strips",
    shouldMatch: true
  },
  {
    name1: "olive oil",
    name2: "extra virgin olive oil",
    shouldMatch: true
  },
  {
    name1: "tomatoes",
    name2: "carrots",
    shouldMatch: false
  }
];

console.log('Testing ingredient normalization:');
testCases.forEach((test, i) => {
  console.log(`\nTest ${i + 1}:`);
  console.log(`Input 1: "${test.name1}"`);
  console.log(`Normalized 1: "${normalizeIngredientName(test.name1)}"`);
  console.log(`Canonical 1: "${getCanonicalIngredientName(test.name1)}"`);
  
  console.log(`Input 2: "${test.name2}"`);
  console.log(`Normalized 2: "${normalizeIngredientName(test.name2)}"`);
  console.log(`Canonical 2: "${getCanonicalIngredientName(test.name2)}"`);
  
  const matches = areIngredientsEqual(test.name1, test.name2);
  const result = matches === test.shouldMatch ? '✅ PASS' : '❌ FAIL';
  console.log(`Should match: ${test.shouldMatch}, Actually matches: ${matches} ${result}`);
});

console.log('\n\nTesting quantity combination:');
const quantityTests = [
  { q1: '2', u1: 'cups', q2: '1', u2: 'cups', expected: '3 cups' },
  { q1: '1/2', u1: 'cup', q2: '1/4', u2: 'cup', expected: '0.75 cup' },
  { q1: '2', u1: 'large', q2: '1', u2: 'pound', expected: '2 large + 1 pound' },
  { q1: null, u1: null, q2: '3', u2: 'cloves', expected: '3 cloves' }
];

quantityTests.forEach((test, i) => {
  const result = combineQuantities(test.q1, test.u1, test.q2, test.u2);
  const combined = result.quantity + (result.unit ? ` ${result.unit}` : '');
  console.log(`\nQuantity Test ${i + 1}:`);
  console.log(`${test.q1} ${test.u1} + ${test.q2} ${test.u2} = ${combined}`);
  console.log(`Expected: ${test.expected}`);
});

console.log('\n🎉 Testing complete!');