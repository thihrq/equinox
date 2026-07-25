import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ValidatedCompetitivePackageManifest {
  runId: string;
  packageId: string;
  packageVersion: string;
  policyId: string;
  policyVersion: string;
  formatId: string;
  regulationId: string;
  entryCount: number;
  includedSpeciesCount: number;
  entryDigests: string[];
  packageDigest: string;
}

export interface ValidatedCompetitiveSetEntry {
  candidateId: string;
  pokemonId: string;
  speciesId: string;
  formId?: string;
  itemId: string;
  abilityId: string;
  natureId: string;
  evs: Record<string, number>;
  ivs: Record<string, number>;
  moveIds: [string, string, string, string];
  roles: string[];
  archetypes: string[];
  verdict: 'expert-validated' | string;
  confidence: string;
  candidateDigest: string;
  packageEntryDigest: string;
}

export interface RepositoryHealthStatus {
  initialized: boolean;
  healthy: boolean;
  packageId: string;
  packageDigest: string;
  entryCount: number;
  reviewRequiredCount: number;
  rejectedCount: number;
  errors: string[];
}

export class ValidatedCompetitiveSetRepository {
  private static instance: ValidatedCompetitiveSetRepository | null = null;
  private manifest: ValidatedCompetitivePackageManifest | null = null;
  private entries: ValidatedCompetitiveSetEntry[] = [];
  private entriesByCandidateId: Map<string, ValidatedCompetitiveSetEntry> = new Map();
  private entriesByPokemonId: Map<string, ValidatedCompetitiveSetEntry[]> = new Map();
  private initialized = false;
  private packagePath = '';
  private expectedDigest = 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665';

  public static getInstance(): ValidatedCompetitiveSetRepository {
    if (!ValidatedCompetitiveSetRepository.instance) {
      ValidatedCompetitiveSetRepository.instance = new ValidatedCompetitiveSetRepository();
    }
    return ValidatedCompetitiveSetRepository.instance;
  }

  public initialize(customPackagePath?: string, customExpectedDigest?: string): void {
    const cwd = process.cwd();
    this.packagePath =
      customPackagePath ||
      process.env.EQUINOX_VALIDATED_PACKAGE_PATH ||
      path.join(
        cwd,
        'artifacts',
        'competitive-production-readiness',
        '20260720T231346Z',
        'validated-package'
      );

    if (customExpectedDigest || process.env.EQUINOX_VALIDATED_PACKAGE_EXPECTED_DIGEST) {
      this.expectedDigest =
        customExpectedDigest || process.env.EQUINOX_VALIDATED_PACKAGE_EXPECTED_DIGEST!;
    }

    const manifestPath = path.join(this.packagePath, 'manifest.json');
    const entriesPath = path.join(this.packagePath, 'entries.json');

    if (!fs.existsSync(manifestPath) || !fs.existsSync(entriesPath)) {
      throw new Error(`VALIDATED_PACKAGE_UNAVAILABLE: Pacote não encontrado em ${this.packagePath}`);
    }

    this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const rawEntries = JSON.parse(fs.readFileSync(entriesPath, 'utf-8'));

    if (this.manifest?.packageDigest !== this.expectedDigest) {
      throw new Error(
        `VALIDATED_PACKAGE_DIGEST_MISMATCH: Digest do pacote (${this.manifest?.packageDigest}) diverge do esperado (${this.expectedDigest})`
      );
    }

    if (this.manifest.entryCount !== 102) {
      throw new Error(`VALIDATED_PACKAGE_ENTRY_COUNT_INVALID: Entry count (${this.manifest.entryCount}) deve ser exatamente 102`);
    }

    // Carrega e valida apenas entradas com veredito expert-validated
    this.entries = (rawEntries.entries || rawEntries || []).filter(
      (e: ValidatedCompetitiveSetEntry) => e.verdict === 'expert-validated'
    );

    this.entriesByCandidateId.clear();
    this.entriesByPokemonId.clear();

    for (const entry of this.entries) {
      this.entriesByCandidateId.set(entry.candidateId, entry);

      const normPokemonId = (entry.pokemonId || entry.speciesId).toLowerCase();
      if (!this.entriesByPokemonId.has(normPokemonId)) {
        this.entriesByPokemonId.set(normPokemonId, []);
      }
      this.entriesByPokemonId.get(normPokemonId)!.push(entry);
    }

    this.initialized = true;
  }

  public getManifest(): ValidatedCompetitivePackageManifest | null {
    return this.manifest;
  }

  public getHealth(): RepositoryHealthStatus {
    const errors: string[] = [];
    let healthy = this.initialized;

    if (!this.initialized) {
      errors.push('NOT_INITIALIZED');
    }

    const reviewRequiredCount = this.entries.filter(e => e.verdict === 'expert-review-required').length;
    const rejectedCount = this.entries.filter(e => e.verdict === 'rejected').length;

    if (reviewRequiredCount > 0 || rejectedCount > 0) {
      healthy = false;
      errors.push('UNVALIDATED_ENTRIES_FOUND');
    }

    return {
      initialized: this.initialized,
      healthy,
      packageId: this.manifest?.packageId || '',
      packageDigest: this.manifest?.packageDigest || '',
      entryCount: this.entries.length,
      reviewRequiredCount,
      rejectedCount,
      errors,
    };
  }

  public getByCandidateId(candidateId: string): ValidatedCompetitiveSetEntry | undefined {
    if (!this.initialized) this.initialize();
    return this.entriesByCandidateId.get(candidateId);
  }

  public getByPokemonId(pokemonId: string): ValidatedCompetitiveSetEntry[] {
    if (!this.initialized) this.initialize();
    const norm = pokemonId.toLowerCase().trim();
    return this.entriesByPokemonId.get(norm) || [];
  }

  public getBySpeciesForm(species: string, form?: string): ValidatedCompetitiveSetEntry[] {
    if (!this.initialized) this.initialize();
    const targetKey = (form ? `${species}-${form}` : species).toLowerCase().trim();
    return this.entriesByPokemonId.get(targetKey) || this.getByPokemonId(species);
  }

  public listValidatedSets(): ValidatedCompetitiveSetEntry[] {
    if (!this.initialized) this.initialize();
    return [...this.entries];
  }

  public hasValidatedSet(pokemonName: string): boolean {
    return this.getByPokemonId(pokemonName).length > 0;
  }

  public verifyIntegrity(): boolean {
    if (!this.initialized || !this.manifest) return false;
    return (
      this.manifest.packageDigest === this.expectedDigest &&
      this.manifest.entryCount === 102 &&
      this.entries.length === 102
    );
  }
}
