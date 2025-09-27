#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Sports Prediction Market Tests with Environment Setup...\n');

try {
  // Change to the project directory
  process.chdir(__dirname);
  
  // Set environment variables for local development
  process.env.ANCHOR_PROVIDER_URL = 'http://127.0.0.1:8899';
  process.env.ANCHOR_WALLET = '~/.config/solana/id.json';
  
  console.log('Environment variables set:');
  console.log('ANCHOR_PROVIDER_URL:', process.env.ANCHOR_PROVIDER_URL);
  console.log('ANCHOR_WALLET:', process.env.ANCHOR_WALLET);
  
  // Run the tests using npm
  console.log('\nRunning tests...');
  execSync('npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts', { 
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });
  
  console.log('\n✅ All tests completed successfully!');
} catch (error) {
  console.error('\n❌ Test execution failed:');
  console.error(error.message);
  console.log('\nMake sure:');
  console.log('1. solana-test-validator is running');
  console.log('2. The program is deployed (run: anchor deploy)');
  process.exit(1);
}
