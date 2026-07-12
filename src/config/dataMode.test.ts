import { resolveDataMode } from './dataMode';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const originalEnv = { ...process.env };

process.env.NODE_ENV = 'test';
delete process.env.EQUINOX_DATA_MODE;
assert(resolveDataMode() === 'filesystem', 'resolveDataMode must default to filesystem outside production.');

process.env.NODE_ENV = 'production';
delete process.env.EQUINOX_DATA_MODE;
let productionBlocked = false;
try {
  resolveDataMode();
} catch (error) {
  productionBlocked = String(error).includes('EQUINOX_DATA_MODE must be explicitly configured');
}
assert(productionBlocked, 'resolveDataMode must require explicit production mode.');

for (const mode of ['filesystem', 'mongo', 'shadow'] as const) {
  process.env.NODE_ENV = 'test';
  process.env.EQUINOX_DATA_MODE = mode;
  assert(resolveDataMode() === mode, `resolveDataMode must accept ${mode}.`);
}

process.env = originalEnv;
console.log('[Equinox] dataMode test passed.');
