declare const process: { env: Record<string, string | undefined> };

function isTrue(value: string | undefined): boolean { return value === 'true'; }

export function getChampionsSourceFlags(env = process.env) {
  return {
    officialWebImport: isTrue(env.EQUINOX_ENABLE_CHAMPIONS_OFFICIAL_WEB_IMPORT),
    mechanicsImport: isTrue(env.EQUINOX_ENABLE_CHAMPIONS_MECHANICS_IMPORT),
    curationAgents: isTrue(env.EQUINOX_ENABLE_CHAMPIONS_CURATION_AGENTS),
    regulationId: env.EQUINOX_CHAMPIONS_REGULATION_ID ?? 'M-B',
    networkReads: isTrue(env.EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS),
    databaseWrites: isTrue(env.EQUINOX_ALLOW_DATABASE_WRITES),
  };
}

export function assertOfficialWebImportAllowed(env = process.env): void {
  const flags = getChampionsSourceFlags(env);
  if (!env.EQUINOX_CHAMPIONS_REGULATION_ID) throw new Error('CHAMPIONS_REGULATION_ID_MISSING');
  if (flags.regulationId !== 'M-B') throw new Error('CHAMPIONS_REGULATION_ID_MISMATCH');
  if (!flags.officialWebImport) throw new Error('CHAMPIONS_OFFICIAL_WEB_IMPORT_DISABLED');
  if (!flags.networkReads) throw new Error('CHAMPIONS_NETWORK_READS_DISABLED');
  if (flags.databaseWrites) throw new Error('DATABASE_WRITES_MUST_BE_DISABLED');
}

export function assertMechanicsImportAllowed(env = process.env): void {
  const flags = getChampionsSourceFlags(env);
  if (!env.EQUINOX_CHAMPIONS_REGULATION_ID) throw new Error('CHAMPIONS_REGULATION_ID_MISSING');
  if (flags.regulationId !== 'M-B') throw new Error('CHAMPIONS_REGULATION_ID_MISMATCH');
  if (!flags.mechanicsImport) throw new Error('CHAMPIONS_MECHANICS_IMPORT_DISABLED');
  if (!flags.networkReads) throw new Error('CHAMPIONS_NETWORK_READS_DISABLED');
  if (flags.databaseWrites) throw new Error('DATABASE_WRITES_MUST_BE_DISABLED');
}
