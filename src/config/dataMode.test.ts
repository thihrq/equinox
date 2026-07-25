import { requiresMongoConnection, resolveDataMode } from './dataMode';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const originalEnv = { ...process.env };

process.env.NODE_ENV = 'test';
delete process.env.EQUINOX_DATA_MODE;
assert(resolveDataMode() === 'filesystem', 'resolveDataMode must default to filesystem outside production.');
assert(requiresMongoConnection() === false, 'requiresMongoConnection must be false for the default (missing) mode outside production.');

process.env.NODE_ENV = 'production';
delete process.env.EQUINOX_DATA_MODE;
let productionBlocked = false;
try {
  resolveDataMode();
} catch (error) {
  productionBlocked = String(error).includes('EQUINOX_DATA_MODE must be explicitly configured');
}
assert(productionBlocked, 'resolveDataMode must require explicit production mode.');

process.env.NODE_ENV = 'production';
process.env.EQUINOX_DATA_MODE = 'mongo';
assert(resolveDataMode() === 'mongo', 'resolveDataMode must accept mongo in production.');
assert(requiresMongoConnection() === true, 'requiresMongoConnection must be true in production with mongo mode.');

process.env.NODE_ENV = 'test';
process.env.EQUINOX_DATA_MODE = 'not-a-real-mode';
assert(resolveDataMode() === 'filesystem', 'resolveDataMode must fall back to filesystem for an invalid configured mode outside production.');
assert(requiresMongoConnection() === false, 'requiresMongoConnection must be false when the invalid mode falls back to filesystem.');

for (const mode of ['filesystem', 'mongo', 'shadow'] as const) {
  process.env.NODE_ENV = 'test';
  process.env.EQUINOX_DATA_MODE = mode;
  assert(resolveDataMode() === mode, `resolveDataMode must accept ${mode}.`);
  assert(requiresMongoConnection() === (mode !== 'filesystem'), `requiresMongoConnection must match ${mode}.`);

  // Gate de consistencia: requiresMongoConnection() nunca pode divergir do modo
  // efetivamente resolvido por resolveDataMode() no mesmo ambiente.
  const resolved = resolveDataMode();
  assert(requiresMongoConnection() === (resolved !== 'filesystem'), `requiresMongoConnection must stay consistent with resolveDataMode() for ${mode}.`);
}

process.env = originalEnv;
console.log('[Equinox] dataMode test passed.');
