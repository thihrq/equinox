import { assertActiveStagingHomologationConfig, readActiveStagingHomologationConfig } from '../equinox/competitive/active-staging/ActiveStagingHomologationConfig';

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }

const originalEnv = { ...process.env };
process.env.EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION = 'false';
process.env.EQUINOX_ACTIVE_STAGING_COLLECTION = 'pokemonsets_v2_staging';
process.env.EQUINOX_ACTIVE_STAGING_READ_ONLY = 'true';
process.env.EQUINOX_DATA_MODE = 'mongo';
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'false';
let disabledBlocked = false;
try { assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig()); } catch (error) { disabledBlocked = String(error).includes('EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION=true is required'); }
assert(disabledBlocked, 'disabled homologation flag must block execution');
process.env.EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION = 'true';
process.env.EQUINOX_ACTIVE_STAGING_COLLECTION = 'pokemonsets';
let productionBlocked = false;
try { assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig()); } catch (error) { productionBlocked = String(error).includes('pokemonsets_v2_staging'); }
assert(productionBlocked, 'production collection must be blocked');
process.env.EQUINOX_ACTIVE_STAGING_COLLECTION = 'pokemonsets_v2_staging';
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'true';
let writesBlocked = false;
try { assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig()); } catch (error) { writesBlocked = String(error).includes('EQUINOX_ALLOW_DATABASE_WRITES=false is required'); }
assert(writesBlocked, 'writes enabled must be blocked');
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'false';
const config = assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig());
assert(config.enabled === true, 'enabled must be true');
assert(config.collectionName === 'pokemonsets_v2_staging', 'collection must be staging');
assert(config.readOnly === true, 'readOnly must be true');
process.env = originalEnv;
console.log('[Equinox] Active staging homologation config validation passed.');
