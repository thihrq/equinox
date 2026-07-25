import { isSyntheticFallbackAllowed, resolveSyntheticFallbackContext } from './syntheticFallbackPolicy';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const originalEnv = { ...process.env };

// production / validated runtime -> fallback impossible, regardless of readyState.
assert(
  isSyntheticFallbackAllowed({ nodeEnv: 'production', runtimeMode: 'mongo', localDevExplicitlyEnabled: false, testFixtureMode: false }) === false,
  'production + mongo runtime must never allow synthetic fallback.',
);
assert(
  isSyntheticFallbackAllowed({ nodeEnv: 'production', runtimeMode: 'mongo', localDevExplicitlyEnabled: true, testFixtureMode: false }) === false,
  'production must deny synthetic fallback even if localDevExplicitlyEnabled is (incorrectly) true -- nodeEnv gate is mandatory.',
);

// runtime mode=validated (mapped here as any non-local-dev mode, e.g. 'shadow') -> impossible.
assert(
  isSyntheticFallbackAllowed({ nodeEnv: 'development', runtimeMode: 'shadow', localDevExplicitlyEnabled: true, testFixtureMode: false }) === false,
  'shadow runtime mode must never allow synthetic fallback, even in development with the flag set.',
);
assert(
  isSyntheticFallbackAllowed({ nodeEnv: 'development', runtimeMode: 'mongo', localDevExplicitlyEnabled: true, testFixtureMode: false }) === false,
  'mongo runtime mode must never allow synthetic fallback (a transient disconnect in mongo mode must fail closed, not silently serve synthetic data).',
);

// runtime mode=canary/serve are not literal dataMode values today; policy treats any string other
// than 'local-dev' as non-eligible -- covered generically here.
assert(
  isSyntheticFallbackAllowed({ nodeEnv: 'development', runtimeMode: 'canary', localDevExplicitlyEnabled: true, testFixtureMode: false }) === false,
  'canary runtime mode must never allow synthetic fallback.',
);
assert(
  isSyntheticFallbackAllowed({ nodeEnv: 'development', runtimeMode: 'serve', localDevExplicitlyEnabled: true, testFixtureMode: false }) === false,
  'serve runtime mode must never allow synthetic fallback.',
);

// local dev + explicit flag -> allowed.
assert(
  isSyntheticFallbackAllowed({ nodeEnv: 'development', runtimeMode: 'local-dev', localDevExplicitlyEnabled: true, testFixtureMode: false }) === true,
  'development + local-dev + explicit flag must allow synthetic fallback.',
);

// local dev WITHOUT explicit flag -> denied (flag is mandatory, not implied by NODE_ENV alone).
assert(
  isSyntheticFallbackAllowed({ nodeEnv: 'development', runtimeMode: 'local-dev', localDevExplicitlyEnabled: false, testFixtureMode: false }) === false,
  'development + local-dev without the explicit flag must deny synthetic fallback.',
);

// test + fixture -> allowed regardless of other fields.
assert(
  isSyntheticFallbackAllowed({ nodeEnv: 'test', runtimeMode: 'mongo', localDevExplicitlyEnabled: false, testFixtureMode: true }) === true,
  'testFixtureMode=true must always allow synthetic fallback, independent of nodeEnv/runtimeMode.',
);

// resolveSyntheticFallbackContext(): real process.env wiring, mode mapping.
process.env.NODE_ENV = 'test';
delete process.env.EQUINOX_DATA_MODE;
delete process.env.EQUINOX_ALLOW_SYNTHETIC_FALLBACK;
let context = resolveSyntheticFallbackContext();
assert(context.runtimeMode === 'local-dev', 'resolveSyntheticFallbackContext must map filesystem dataMode to runtimeMode=local-dev.');
assert(context.testFixtureMode === true, 'resolveSyntheticFallbackContext must set testFixtureMode=true when NODE_ENV=test.');

process.env.NODE_ENV = 'development';
process.env.EQUINOX_DATA_MODE = 'mongo';
context = resolveSyntheticFallbackContext();
assert(context.runtimeMode === 'mongo', 'resolveSyntheticFallbackContext must pass through non-filesystem dataMode as runtimeMode.');
assert(isSyntheticFallbackAllowed(context) === false, 'real mongo-mode context must deny synthetic fallback even mid-development.');

process.env.NODE_ENV = 'development';
process.env.EQUINOX_DATA_MODE = 'filesystem';
process.env.EQUINOX_ALLOW_SYNTHETIC_FALLBACK = 'true';
context = resolveSyntheticFallbackContext();
assert(isSyntheticFallbackAllowed(context) === true, 'real local-dev context with explicit flag must allow synthetic fallback.');

process.env = originalEnv;
console.log('[Equinox] syntheticFallbackPolicy test passed.');
