const ENV_VAR_NAME = 'EQUINOX_ACTIVE_V2_CANARY_SUBJECT_ALLOWLIST';

/**
 * Lista de subjects autorizados a usar o canário interno (comma-separated na
 * env var). Assim como a seed de canário, mudanças nesta lista devem ser
 * registradas no changelog (`--reason` no CLI de gerenciamento) — mas a
 * lista em si não é segredo, por isso não exige um store dedicado com
 * concorrência otimista como o breaker/canary config.
 */
export function loadActiveV2InternalCanaryAllowlist(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = env[ENV_VAR_NAME] ?? '';
  return new Set(
    raw
      .split(',')
      .map(subject => subject.trim())
      .filter(subject => subject.length > 0)
  );
}

export function isActiveV2CanarySubjectAllowlisted(subject: string, allowlist: ReadonlySet<string>): boolean {
  return allowlist.has(subject);
}
