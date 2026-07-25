import { isReferenceBootstrapEnabled, isReferenceOfflineEnabled } from './ReferenceFlags';

if (!isReferenceBootstrapEnabled({ EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS: 'true', EQUINOX_CHAMPIONS_REFERENCE_BOOTSTRAP: 'true' })) throw new Error('bootstrap flags should enable bootstrap');
if (isReferenceBootstrapEnabled({ EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS: 'false', EQUINOX_CHAMPIONS_REFERENCE_BOOTSTRAP: 'false' })) throw new Error('disabled flags should block bootstrap');
if (!isReferenceOfflineEnabled({ EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS: 'false', EQUINOX_CHAMPIONS_REFERENCE_BOOTSTRAP: 'false' })) throw new Error('offline flags should enable offline mode');
console.log(JSON.stringify({ valid: true, flags: 'reference-conformance', mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
