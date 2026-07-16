import * as crypto from 'crypto';

export const ACTIVE_V2_DATA_DIGEST_ALGORITHM = 'active-v2-canonical-sha256-v1';

const EXCLUDED_FIELDS = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'publishRunId',
  'previousPublishRunId',
  'sourceActiveRunId',
  'active',
  'productionActivatedAt',
  'productionDeactivatedAt',
  // Os campos abaixo foram descobertos comparando, campo a campo, um
  // registro real de staging com o mesmo registro já publicado em
  // pokemonsets_v2 (rodando a homologação de leitura da Fase 2 contra um
  // Mongo real — nenhum teste offline com Mongo mockado jamais exerceria
  // essa comparação estrutural). Duas causas distintas:
  //
  // 1. `role` é exigido pelo schema Mongoose de PokemonSetV2 mas é sempre
  //    derivado de `primaryRole` no momento da publicação (ver
  //    ActiveV2ProductionPublisher.ts) — não existe nos registros de
  //    staging. `legal`, `validationErrors` e `validationWarnings` são
  //    preenchidos por valores padrão do schema quando ausentes do
  //    documento inserido — também nunca fazem parte do conteúdo curado
  //    real hoje.
  'role',
  'legal',
  'validationErrors',
  'validationWarnings',
  'importedAt',
  //
  // 2. O schema estrito do Mongoose (strict mode) descarta, silenciosamente,
  //    qualquer campo do documento de staging que não esteja declarado no
  //    schema de PokemonSetV2 — isso inclui toda a metadata de governança/
  //    linhagem de promoção (quem revisou, quando foi verificado/ativado em
  //    staging). Essa metadata é sobre o PROCESSO de chegar até aqui, não
  //    sobre o conteúdo competitivo em si — mesma categoria de
  //    `publishRunId`/`previousPublishRunId`, já excluídos acima.
  'humanReview',
  'verifiedAt',
  'verifiedRunId',
  'activatedAt',
  'activatedFromStatus',
  'activationMetadata',
  'activeRunId',
  'previousVerifiedRunId',
]);

/** Chaves cujo valor deve ser normalizado como data (string ISO), mesmo
 * quando a fonte às vezes traz uma string de data "solta" (ex: leitura
 * bruta de staging via driver, sem cast de schema) e outras vezes um
 * `Date` real do Mongoose (ex: leitura de um documento já publicado) —
 * sem isso, a mesma data semântica gera dois hashes diferentes dependendo
 * de qual lado do pipeline a leu. */
const DATE_NORMALIZED_FIELDS = new Set(['sourceUpdatedAt']);

/**
 * Normaliza e ordena recursivamente as propriedades de um valor/objeto para fins de hashing canônico.
 */
export function canonicalizeValue(val: any): any {
  if (val === null || val === undefined) {
    return null;
  }

  if (Array.isArray(val)) {
    return val.map(item => canonicalizeValue(item));
  }

  if (typeof val === 'object') {
    if (val instanceof Date) {
      return val.toISOString();
    }
    // Caso seja outro objeto Mongoose/Documento
    const plainObj = typeof val.toObject === 'function' ? val.toObject() : val;
    
    const sortedObj: any = {};
    const keys = Object.keys(plainObj).sort();
    
    for (const key of keys) {
      if (EXCLUDED_FIELDS.has(key)) {
        continue;
      }
      
      let canonicalized = canonicalizeValue(plainObj[key]);

      // Regra especial: ordenar alfabeticamente os arrays competitivos
      if ((key === 'moves' || key === 'roles' || key === 'tags') && Array.isArray(canonicalized)) {
        canonicalized = [...canonicalized].sort((a, b) => String(a).localeCompare(String(b)));
      }

      // Regra especial: normalizar campos de data que podem chegar como
      // string solta OU como Date real, dependendo de qual estágio do
      // pipeline os leu.
      if (DATE_NORMALIZED_FIELDS.has(key) && canonicalized !== null) {
        const parsed = new Date(canonicalized);
        if (!Number.isNaN(parsed.getTime())) {
          canonicalized = parsed.toISOString();
        }
      }
      
      sortedObj[key] = canonicalized;
    }
    return sortedObj;
  }

  return val;
}

/**
 * Calcula o digest canônico SHA-256 de um conjunto de registros V2 ativos.
 */
export function calculateCanonicalActiveV2DataDigest(records: readonly any[]): string {
  if (!records || records.length === 0) {
    const hash = crypto.createHash('sha256').update('[]').digest('hex');
    return `sha256-${hash}`;
  }

  // 1. Canonicalizar cada registro
  const canonicalizedRecords = records.map(rec => {
    const plainRec = typeof rec.toObject === 'function' ? rec.toObject() : rec;
    return canonicalizeValue(plainRec);
  });

  // 2. Ordenar os documentos por setId
  const sortedRecords = [...canonicalizedRecords].sort((a, b) => {
    const idA = a.setId || '';
    const idB = b.setId || '';
    return String(idA).localeCompare(String(idB));
  });

  // 3. Serializar e calcular o hash
  const serialized = JSON.stringify(sortedRecords);
  const hash = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
  return `sha256-${hash}`;
}
