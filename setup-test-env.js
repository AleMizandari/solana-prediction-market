#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Setting up test environment...\n');

try {
  // Change to the project directory
  process.chdir(__dirname);
  
  console.log('1. Building the program...');
  execSync('anchor build', { stdio: 'inherit' });
  
  console.log('\n2. Deploying the program...');
  execSync('anchor deploy', { stdio: 'inherit' });
  
  console.log('\n✅ Test environment setup complete!');
  console.log('\nNext steps:');
  console.log('- Make sure solana-test-validator is running');
  console.log('- Run: node run-tests.js');
  
} catch (error) {
  console.error('\n❌ Setup failed:');
  console.error(error.message);
  console.log('\nMake sure you have:');
  console.log('1. Solana CLI installed');
  console.log('2. Anchor CLI installed');
  console.log('3. solana-test-validator running in another terminal');
  process.exit(1);
}
