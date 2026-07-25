export interface FreshnessFinding {
  sourceId: string;
  message: string;
  blocking: boolean;
}

export function validateChampionsSourceFreshness(
  sources: Array<{ sourceId: string; retrievedAt: string }>,
  referenceDate: string,
  maxAgeDays = 30,
): FreshnessFinding[] {
  const reference = Date.parse(referenceDate);
  const findings: FreshnessFinding[] = [];

  for (const source of sources) {
    const retrieved = Date.parse(source.retrievedAt);
    if (!Number.isFinite(retrieved)) {
      findings.push({ sourceId: source.sourceId, message: 'invalid retrievedAt', blocking: true });
      continue;
    }
    const ageDays = (reference - retrieved) / 86_400_000;
    if (ageDays < 0 || ageDays > maxAgeDays) {
      findings.push({ sourceId: source.sourceId, message: `source age outside ${maxAgeDays} day window`, blocking: true });
    }
  }

  return findings;
}
