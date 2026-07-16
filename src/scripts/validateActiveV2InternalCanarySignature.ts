import { computeActiveV2InternalCanarySignature, verifyActiveV2InternalCanarySignature } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanarySignature';

async function runTests(): Promise<void> {
  const subject = 'alice';
  const timestamp = '1752000000000';
  const nonce = 'nonce-1';
  const requestPath = '/api/team-builder';
  const secret = 'super-secret-value';

  // --- Caso de Teste 1: assinatura correta verifica com sucesso ---
  const signature = computeActiveV2InternalCanarySignature(subject, timestamp, nonce, requestPath, secret);
  if (!verifyActiveV2InternalCanarySignature(signature, subject, timestamp, nonce, requestPath, secret)) {
    throw new Error('Test 1 failed: expected valid signature to verify');
  }

  // --- Caso de Teste 2: mesma entrada produz sempre a mesma assinatura (determinístico) ---
  const signature2 = computeActiveV2InternalCanarySignature(subject, timestamp, nonce, requestPath, secret);
  if (signature !== signature2) throw new Error('Test 2 failed: expected deterministic signature');

  // --- Caso de Teste 3: qualquer campo alterado invalida a assinatura ---
  if (verifyActiveV2InternalCanarySignature(signature, 'bob', timestamp, nonce, requestPath, secret)) {
    throw new Error('Test 3 failed: expected signature to be invalid for a different subject');
  }
  if (verifyActiveV2InternalCanarySignature(signature, subject, timestamp, 'different-nonce', requestPath, secret)) {
    throw new Error('Test 3 failed: expected signature to be invalid for a different nonce');
  }
  if (verifyActiveV2InternalCanarySignature(signature, subject, timestamp, nonce, '/other/path', secret)) {
    throw new Error('Test 3 failed: expected signature to be invalid for a different requestPath');
  }

  // --- Caso de Teste 4: segredo errado invalida a assinatura ---
  if (verifyActiveV2InternalCanarySignature(signature, subject, timestamp, nonce, requestPath, 'wrong-secret')) {
    throw new Error('Test 4 failed: expected signature to be invalid with the wrong secret');
  }

  // --- Caso de Teste 5: assinatura malformada (não-hex) não lança, apenas retorna falso ---
  if (verifyActiveV2InternalCanarySignature('not-hex-!!', subject, timestamp, nonce, requestPath, secret)) {
    throw new Error('Test 5 failed: expected malformed signature to fail verification without throwing');
  }

  // --- Caso de Teste 6: assinatura de tamanho diferente não lança, apenas retorna falso ---
  if (verifyActiveV2InternalCanarySignature('ab', subject, timestamp, nonce, requestPath, secret)) {
    throw new Error('Test 6 failed: expected shorter signature to fail verification without throwing');
  }

  console.log('[Equinox] Active V2 internal canary signature validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
