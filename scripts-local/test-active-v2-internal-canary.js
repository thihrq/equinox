/**
 * Automatiza a validacao manual do Runtime Serve via canario interno (Fase
 * 5), combinando os 3 passos do runbook (secao 12 "Runtime Serve" + secao 7
 * "Canario Interno / HMAC") num unico comando:
 *   1. (opcional) liga o canario para modo "internal", via o CLI real
 *      setActiveV2CanaryMode.ts (npm run sets:active-v2-canary:set-mode) —
 *      preserva a trilha de auditoria (changelog) e as regras de aprovacao.
 *   2. assina a requisicao reutilizando as MESMAS funcoes puras usadas por
 *      signActiveV2InternalCanaryRequest.ts (nao reimplementa o HMAC).
 *   3. dispara a requisicao real contra a API (Render ou outra URL) e
 *      mostra se a resposta veio hidratada com dados de pokemonsets_v2.
 *
 * Nao roda nada automaticamente: cada etapa side-effect exige a variavel de
 * ambiente correspondente (mesmo padrao de seguranca do resto do pipeline
 * Active V2 — ausencia de flag = comportamento seguro por padrao).
 *
 * Uso:
 *   MONGO_URI=... \
 *   API_BASE_URL=https://sua-api.onrender.com \
 *   CANARY_SUBJECT=seu-nome \
 *   EQUINOX_ACTIVE_V2_CANARY_HMAC_SECRETS='[{"secretId":"v1","secret":"...","activeFrom":"2026-01-01T00:00:00.000Z","activeUntil":null}]' \
 *   TEAM="Sinistcha,Togekiss,Suicune" \
 *   node scripts-local/test-active-v2-internal-canary.js [--set-mode] [--responsible <nome>] [--reason <texto>]
 *
 * --set-mode liga o canario para 'internal' antes de disparar a requisicao
 * (escrita real no Mongo — exige EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE=true
 * no ambiente). Sem essa flag, o script assume que o canario ja esta em
 * 'internal' e so assina+dispara.
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

require('dns').setServers(['8.8.8.8']);

const REPO_ROOT = path.join(__dirname, '..');
const envPath = path.join(REPO_ROOT, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, override: true });
}

const FORMAT = process.env.FORMAT || 'champions_reg_m_b_doubles';
const REQUEST_PATH = '/api/team/suggest';

function getFlagArg(name) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}
const shouldSetMode = process.argv.includes('--set-mode');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[test-internal-canary] Erro: variavel de ambiente ${name} e obrigatoria.`);
    process.exit(2);
  }
  return value;
}

function setCanaryModeToInternal(subject, reason) {
  console.log(`[test-internal-canary] Ligando canario para modo "internal" via CLI real (responsavel: ${subject})...`);
  requireEnv('EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE');
  if (process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE !== 'true') {
    console.error('[test-internal-canary] Erro: EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE deve ser exatamente "true".');
    process.exit(2);
  }

  try {
    execFileSync(
      'npx',
      [
        'ts-node',
        'src/scripts/setActiveV2CanaryMode.ts',
        '--mode', 'internal',
        '--responsible', subject,
        '--reason', reason,
      ],
      {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          NODE_OPTIONS: `--require ${path.join(__dirname, 'dns-preload.js')}`,
        },
      }
    );
  } catch (error) {
    console.error('[test-internal-canary] Erro ao ligar o canario (ver saida do CLI acima). Abortando.');
    process.exit(1);
  }
}

function signRequest(subject) {
  require('ts-node').register({ project: path.join(REPO_ROOT, 'tsconfig.json'), transpileOnly: true });
  const crypto = require('crypto');
  const { computeActiveV2InternalCanarySignature } = require(path.join(REPO_ROOT, 'src/services/competitive-data/internal-canary-auth/ActiveV2InternalCanarySignature.ts'));
  const { loadActiveV2InternalCanarySecrets, findActiveActiveV2CanarySecretsAt } = require(path.join(REPO_ROOT, 'src/services/competitive-data/internal-canary-auth/ActiveV2InternalCanarySecretRegistry.ts'));
  const { ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1 } = require(path.join(REPO_ROOT, 'src/services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAuthPolicy.ts'));

  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();

  const secrets = loadActiveV2InternalCanarySecrets();
  const activeSecrets = findActiveActiveV2CanarySecretsAt(secrets, new Date(Number(timestamp)));
  if (activeSecrets.length === 0) {
    console.error('[test-internal-canary] Erro: nenhum segredo ativo em EQUINOX_ACTIVE_V2_CANARY_HMAC_SECRETS.');
    process.exit(2);
  }
  const secret = activeSecrets[0].secret;

  const signature = computeActiveV2InternalCanarySignature(subject, timestamp, nonce, REQUEST_PATH, secret);
  const headerNames = ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1.headerNames;

  return {
    [headerNames.subject]: subject,
    [headerNames.timestamp]: timestamp,
    [headerNames.nonce]: nonce,
    [headerNames.signature]: signature,
  };
}

async function fireRequest(baseUrl, signedHeaders, team) {
  const url = `${baseUrl.replace(/\/$/, '')}${REQUEST_PATH}`;
  console.log(`[test-internal-canary] Disparando POST ${url}...`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...signedHeaders },
    body: JSON.stringify({ team, format: FORMAT, allowLegendaries: false, teamIdentity: 'balanced' }),
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function main() {
  const baseUrl = requireEnv('API_BASE_URL');
  const subject = requireEnv('CANARY_SUBJECT');
  const team = requireEnv('TEAM').split(',').map(s => s.trim());

  if (team.length !== 3) {
    console.error('[test-internal-canary] Erro: TEAM deve conter exatamente 3 nomes separados por virgula.');
    process.exit(2);
  }

  if (shouldSetMode) {
    const reason = getFlagArg('--reason') || 'teste manual do caminho de serving real (runbook secao 12)';
    setCanaryModeToInternal(getFlagArg('--responsible') || subject, reason);
  } else {
    console.log('[test-internal-canary] --set-mode nao informado — assumindo que o canario ja esta em "internal".');
  }

  const signedHeaders = signRequest(subject);
  console.log('[test-internal-canary] Requisicao assinada (segredo omitido):', signedHeaders);

  const { status, body } = await fireRequest(baseUrl, signedHeaders, team);
  console.log(`[test-internal-canary] Status HTTP: ${status}`);

  const suggested = body && body.topTeams && body.topTeams[0] && body.topTeams[0].suggestedPokemons;
  if (!Array.isArray(suggested)) {
    console.log('[test-internal-canary] Resposta nao teve o formato esperado — corpo completo:');
    console.log(JSON.stringify(body, null, 2));
    process.exit(status >= 200 && status < 300 ? 0 : 1);
  }

  console.log('\n[test-internal-canary] Pokemon sugeridos e seus dados de set:');
  for (const p of suggested) {
    console.log(`  - ${p.name}: item=${p.item} ability=${p.ability} nature=${p.nature} moves=${JSON.stringify(p.moves)}`);
  }
  console.log('\n[test-internal-canary] Compare esses valores com o que esta publicado em pokemonsets_v2 (Atlas Data Explorer, ou');
  console.log('npm run sets:active-v2-runtime-read:homologate) — se baterem, o serving real do Active V2 esta funcionando.');
  console.log('Verifique tambem em active_v2_runtime_telemetry se um evento com servePath="active-v2" foi gravado para este requestId.');

  process.exit(0);
}

main().catch(err => {
  console.error('[test-internal-canary] erro inesperado:', err);
  process.exit(1);
});
