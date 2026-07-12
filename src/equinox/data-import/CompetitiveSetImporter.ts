import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { assertDatabaseWritesAllowed, markMongoWrite, stableContentHash } from '../data-audit/DataAuditRuntime';
import { createAuditRunContext } from '../data-audit/AuditRunContext';
import { detectCompetitiveSetDuplicates } from '../data-audit/CompetitiveSetDuplicateDetector';
import { getCompetitiveDataSource } from '../data-sources/DataSourceCatalog';
import { normalizeCompetitiveSetIdentity } from '../data-normalization/CompetitiveDataNormalizer';
import { validateCompetitiveSetCoherence } from '../data-validation/CompetitiveSetCoherenceValidator';
import { validateCompetitiveSetLegality } from '../data-validation/CompetitiveSetLegalityValidator';
import { validateCompetitiveSetStructure } from '../data-validation/CompetitiveSetStructureValidator';
import { CompetitiveSetValidationInput } from '../data-validation/CompetitiveValidationTypes';
import { CompetitiveSetImportReport, CompetitiveSetImportRequest, CompetitiveSetLoadResult } from './CompetitiveSetImportTypes';

export class CompetitiveSetImporter {
  public importFromFile(request: CompetitiveSetImportRequest): CompetitiveSetImportReport {
    const runContext = createAuditRunContext(`sets:import:${request.mode}`);
    const source = getCompetitiveDataSource(request.sourceId);
    const loadResult = this.loadRecords(request.file);
    if (loadResult.rawRecordCount === 0 && !request.allowEmpty) {
      throw new Error(
        `No competitive sets were loaded. Source: ${loadResult.sourcePath}. Reason: ${loadResult.emptyReason ?? 'unknown'}.`,
      );
    }
    const raw = loadResult.fileExists
      ? JSON.parse(readFileSync(request.file, 'utf8')) as { sets?: CompetitiveSetValidationInput[] } | CompetitiveSetValidationInput[]
      : [];
    const records = Array.isArray(raw) ? raw : raw.sets ?? [];
    const normalized = records.map(record => this.normalizeRecord(record, request));
    const duplicates = detectCompetitiveSetDuplicates(normalized.map(record => ({
      setId: record.setId,
      pokemonId: record.pokemonId ?? '',
      formId: record.formId ?? '',
      regulationId: record.regulationId ?? '',
      item: record.item ?? '',
      ability: record.ability ?? '',
      nature: record.nature ?? '',
      evs: record.evs,
      ivs: record.ivs,
      moves: record.moves ?? [],
      sourceId: record.sourceId,
      primaryRole: record.primaryRole,
      sourceUpdatedAt: record.sourceUpdatedAt,
    })));

    let accepted = 0;
    let rejected = 0;
    let quarantined = 0;
    const warnings: string[] = [];

    for (const record of normalized) {
      const structure = validateCompetitiveSetStructure(record);
      const legality = validateCompetitiveSetLegality(record);
      const coherence = validateCompetitiveSetCoherence(record);
      if (!structure.valid || !legality.legal) {
        rejected += 1;
      } else if (!coherence.accepted || (record.confidence ?? 0) < 70) {
        quarantined += 1;
      } else {
        accepted += 1;
      }
      warnings.push(...structure.warnings.map(warning => warning.message));
      warnings.push(...legality.warnings.map(warning => warning.message));
      warnings.push(...coherence.issues.filter(issue => issue.severity === 'warning').map(warning => warning.message));
    }

    if (!source) warnings.push(`Unknown sourceId ${request.sourceId}; imported records cannot become active.`);
    const dryRun = request.mode === 'dry-run';
    let writtenCount = 0;
    let mongoWrites = 0;

    if (dryRun) {
      console.log('[DRY-RUN] Nenhuma alteracao sera persistida.');
    } else {
      assertDatabaseWritesAllowed('publish competitive sets');
      warnings.push('Database publish mode is scaffolded; no write operation is executed by this importer yet.');
      writtenCount = 0;
      mongoWrites = 0;
      markMongoWrite(0);
    }

    return {
      accepted,
      rejected,
      changed: 0,
      duplicated: duplicates.length,
      quarantined,
      mode: request.mode,
      readCount: records.length,
      acceptedCount: accepted,
      rejectedCount: rejected,
      writtenCount,
      mongoWrites,
      dryRun,
      loadResult,
      runContext,
      sources: [{
        path: request.file,
        sha256: loadResult.fileExists ? sha256(readFileSync(request.file, 'utf8')) : '',
        recordCount: records.length,
      }],
      warnings,
      records: normalized.map(record => ({
        ...record,
        contentHash: record.contentHash ?? this.sourceHash(record),
      })),
    };
  }

  private sourceHash(record: CompetitiveSetValidationInput): string {
    return stableContentHash(JSON.stringify(record));
  }

  private normalizeRecord(record: CompetitiveSetValidationInput, request: CompetitiveSetImportRequest): CompetitiveSetValidationInput {
    const identity = normalizeCompetitiveSetIdentity(record);
    return {
      ...record,
      pokemonId: identity.pokemonId,
      formId: identity.formId,
      regulationId: request.regulationId,
      sourceId: request.sourceId,
      sourceType: record.sourceType ?? getCompetitiveDataSource(request.sourceId)?.type,
      confidence: record.confidence ?? getCompetitiveDataSource(request.sourceId)?.trustScore ?? 30,
      dataVersion: record.dataVersion ?? new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      importedAt: record.importedAt ?? new Date().toISOString(),
    };
  }

  private loadRecords(sourcePath: string): CompetitiveSetLoadResult {
    if (!sourcePath) {
      return {
        sourcePath: '',
        fileExists: false,
        rawRecordCount: 0,
        acceptedForValidationCount: 0,
        filteredRecordCount: 0,
        emptyReason: 'missing-file-argument',
      };
    }

    if (!existsSync(sourcePath)) {
      return {
        sourcePath,
        fileExists: false,
        rawRecordCount: 0,
        acceptedForValidationCount: 0,
        filteredRecordCount: 0,
        emptyReason: 'file-not-found',
      };
    }

    const content = readFileSync(sourcePath, 'utf8');
    const parsed = JSON.parse(content) as { sets?: CompetitiveSetValidationInput[] } | CompetitiveSetValidationInput[];
    const records = Array.isArray(parsed) ? parsed : parsed.sets ?? [];
    const emptyReason = records.length === 0
      ? sourcePath.includes('champions-reg-mb-doubles') ? 'package-draft-empty' : 'file-empty'
      : undefined;

    return {
      sourcePath,
      fileExists: true,
      rawRecordCount: records.length,
      acceptedForValidationCount: records.length,
      filteredRecordCount: 0,
      emptyReason,
    };
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}
