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
  'active',
  'productionActivatedAt',
  'productionDeactivatedAt',
]);

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
