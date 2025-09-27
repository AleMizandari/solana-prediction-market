#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Sports Prediction Market Tests...\n');

try {
  // Change to the project directory
  process.chdir(__dirname);
  
  // Run the tests using npm
  console.log('Running tests...');
  execSync('npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts', { 
    stdio: 'inherit',
    cwd: __dirname
  });
  
  console.log('\n✅ All tests completed successfully!');
} catch (error) {
  console.error('\n❌ Test execution failed:');
  console.error(error.message);
  process.exit(1);
}
