# Equinox V2 Runtime/Safety Production Deploy Runbook

## Visão Geral
Este runbook descreve o procedimento operacional padrão para implantação da versão **Equinox V2 Runtime/Safety** em ambiente de produção.

## Pré-requisitos
- Commit homologado: `cfafc8c7a90c32da24d28f13bfb0ed4f28344fe7`
- Tag definitiva: `v1.0.0-runtime-safety-ready`
- Pacote competitivo ativo: `data/competitive/validated-packages/active-v2` (`sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665`)

## Passos de Implantação

### 1. Verificação Pré-Deploy
```bash
npx tsc --noEmit
npm run preflight
npm run sets:active-v2-production:offline:check
```

### 2. Compilação dos Artefatos
```bash
npm run build
npm --prefix frontend run build
```

### 3. Validação do Artefato de Release v2
```bash
npm run release:runtime-safety:regression
```
Confirmar a saída `{"valid": true}`.

### 4. Inicialização dos Serviços
- **Backend API**: Executar em modo `serve` com a variável `EQUINOX_DATA_MODE=filesystem`.
- **Frontend SPA**: Servir os arquivos estáticos de `frontend/dist`.

## Critérios de Sucesso Pós-Deploy
1. Endpoints de saúde e API V2 respondendo com código HTTP 200.
2. 100% dos sets competitivos servidos a partir do pacote `active-v2`.
3. Escrita em MongoDB mantida em `0`.
