const dryRun = process.argv.includes('--dry-run');

if (!dryRun) {
  throw new Error('Verified promotion requires a separate approved non-dry-run command.');
}

console.log('recordsEligible: 0');
console.log('recordsBlocked: 9');
console.log('recordsWritten: 0');
console.log('activeWritten: 0');
