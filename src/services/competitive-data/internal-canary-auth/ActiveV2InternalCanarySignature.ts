import * as crypto from 'crypto';

/**
 * Assinatura: HMAC-SHA256(subject + timestamp + nonce + requestPath, rotatingSecret)
 * — exatamente a fórmula do adendo 3.5.
 */
export function computeActiveV2InternalCanarySignature(
  subject: string,
  timestamp: string,
  nonce: string,
  requestPath: string,
  secret: string
): string {
  const payload = `${subject}${timestamp}${nonce}${requestPath}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Compara a assinatura candidata contra a esperada usando comparação de
 * tempo constante (`timingSafeEqual`), para não vazar informação sobre o
 * quanto a assinatura fornecida está "próxima" da correta.
 */
export function verifyActiveV2InternalCanarySignature(
  candidateSignatureHex: string,
  subject: string,
  timestamp: string,
  nonce: string,
  requestPath: string,
  secret: string
): boolean {
  const expectedHex = computeActiveV2InternalCanarySignature(subject, timestamp, nonce, requestPath, secret);

  let expectedBuf: Buffer;
  let candidateBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expectedHex, 'hex');
    candidateBuf = Buffer.from(candidateSignatureHex, 'hex');
  } catch {
    return false;
  }

  if (expectedBuf.length !== candidateBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, candidateBuf);
}
