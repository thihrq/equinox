import {
  EquinoxDataPackManifest,
  EquinoxDataPackValidationResult,
} from './DataPackManifest';
import { RadicalRedDataPack } from '../radicalred/RadicalRedBossProfile';
import { CompetitiveSetValidationInput } from '../data-validation/CompetitiveValidationTypes';
import { validateCompetitiveSetStructure } from '../data-validation/CompetitiveSetStructureValidator';

export class DataPackValidator {
  public validateManifest(manifest: Omit<EquinoxDataPackManifest, 'validation'>): EquinoxDataPackValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.id.trim()) errors.push('Manifest id is required.');
    if (!manifest.title.trim()) errors.push(`Data pack ${manifest.id || '(unknown)'} must have a title.`);
    if (!manifest.dataVersion.trim()) errors.push(`Data pack ${manifest.id} must have a dataVersion.`);
    if (!manifest.sourceName.trim()) errors.push(`Data pack ${manifest.id} must declare a sourceName.`);
    if (!manifest.formatIds.length) errors.push(`Data pack ${manifest.id} must map to at least one format id.`);

    if (manifest.status === 'verified' && !manifest.sourceUrl) {
      warnings.push(`Verified data pack ${manifest.id} should expose a sourceUrl.`);
    }

    if (manifest.status === 'verified' && !manifest.dataHash) {
      warnings.push(`Verified data pack ${manifest.id} should expose a dataHash/checksum.`);
    }

    if (manifest.status !== 'pending' && manifest.recordCount <= 0) {
      errors.push(`Data pack ${manifest.id} has no records.`);
    }

    if (manifest.status === 'pending') {
      warnings.push(`Data pack ${manifest.id} is pending and should not be treated as locked data.`);
    }

    if (manifest.status === 'bootstrap') {
      warnings.push(`Data pack ${manifest.id} is a bootstrap profile and should be replaced by an exact import when precision matters.`);
    }

    return this.result(errors, warnings);
  }

  public validateRadicalRedBossPack(pack: RadicalRedDataPack): EquinoxDataPackValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!pack.id) errors.push('Radical Red pack id is required.');
    if (!pack.dataVersion) errors.push(`Radical Red pack ${pack.id} must have a dataVersion.`);
    if (!pack.sourceUrl) errors.push(`Radical Red pack ${pack.id} must reference the official sourceUrl.`);
    if (!pack.bosses.length) errors.push(`Radical Red pack ${pack.id} has no bosses.`);

    const expectedBosses = ['Lorelei', 'Bruno', 'Agatha', 'Lance', 'Champion'];
    for (const expectedBoss of expectedBosses) {
      if (!pack.bosses.some(boss => boss.name.toLowerCase() === expectedBoss.toLowerCase())) {
        warnings.push(`Radical Red pack ${pack.id} is missing expected boss line: ${expectedBoss}.`);
      }
    }

    for (const boss of pack.bosses) {
      if (!boss.variants.length) {
        errors.push(`Boss ${boss.name} has no variants.`);
      }

      for (const variant of boss.variants) {
        if (variant.pokemon.length !== 6) {
          warnings.push(`Boss ${boss.name} / ${variant.label} has ${variant.pokemon.length} Pokémon instead of 6.`);
        }

        for (const pokemon of variant.pokemon) {
          if (!pokemon.name || !pokemon.types.length) {
            errors.push(`Boss ${boss.name} / ${variant.label} has an invalid Pokémon entry.`);
          }
        }
      }
    }

    return this.result(errors, warnings);
  }

  public validateCompetitiveSetPack(records: CompetitiveSetValidationInput[]): EquinoxDataPackValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    records.forEach((record, index) => {
      const validation = this.validateCompetitiveSetRecord(record);
      for (const error of validation.errors) errors.push(`set[${index}]: ${error}`);
      for (const warning of validation.warnings) warnings.push(`set[${index}]: ${warning}`);
    });

    return this.result(errors, warnings);
  }

  public validateCompetitiveSetRecord(record: CompetitiveSetValidationInput): EquinoxDataPackValidationResult {
    const validation = validateCompetitiveSetStructure(record);
    return this.result(
      validation.errors.map(error => `${error.code} ${error.path}: ${error.message}`),
      validation.warnings.map(warning => `${warning.code} ${warning.path}: ${warning.message}`),
    );
  }

  public validatePackCoverage(recordCount: number, expectedMinimum: number): EquinoxDataPackValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (recordCount <= 0) errors.push('Competitive set pack has no records.');
    if (recordCount < expectedMinimum) warnings.push(`Competitive set pack has ${recordCount} records, below expected minimum ${expectedMinimum}.`);
    return this.result(errors, warnings);
  }

  public validatePackFreshness(sourceUpdatedAt?: string): EquinoxDataPackValidationResult {
    const warnings: string[] = [];
    if (!sourceUpdatedAt) warnings.push('Competitive set pack does not expose sourceUpdatedAt.');
    return this.result([], warnings);
  }

  public validatePackConsistency(records: CompetitiveSetValidationInput[]): EquinoxDataPackValidationResult {
    const warnings: string[] = [];
    const formats = new Set(records.map(record => record.formatId).filter(Boolean));
    const regulations = new Set(records.map(record => record.regulationId).filter(Boolean));
    if (formats.size > 1) warnings.push(`Competitive set pack mixes formats: ${[...formats].join(', ')}.`);
    if (regulations.size > 1) warnings.push(`Competitive set pack mixes regulations: ${[...regulations].join(', ')}.`);
    return this.result([], warnings);
  }

  private result(errors: string[], warnings: string[]): EquinoxDataPackValidationResult {
    if (errors.length > 0) return { status: 'fail', errors, warnings };
    if (warnings.length > 0) return { status: 'warn', errors, warnings };
    return { status: 'pass', errors, warnings };
  }
}
