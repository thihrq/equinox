# Equinox V2 Runtime/Safety Production Rollback Runbook

## Visão Geral
Este guia descreve os procedimentos de emergência para reverter o sistema Equinox V2 para a versão de segurança anterior (`v1.0.0-ga-ready`) ou para o modo `validate-only`.

## Gatilhos de Rollback
O rollback imediato deve ser executado caso ocorra qualquer uma das condições:
1. Erros HTTP 500 em endpoints de API ou erro crítico na renderização do frontend.
2. Qualquer tentativa de escrita não autorizada em MongoDB (`mongoWrites > 0`).
3. Falha de validação ou divergência de integridade no pacote `active-v2`.

## Procedimento de Rollback Imediato

### Opção A: Reversão para Modo `validate-only` (Runtime Graceful Degradation)
1. Alterar a variável de ambiente do serviço backend:
   ```bash
   EQUINOX_DATA_MODE=validate-only
   ```
2. Reiniciar os processos da API Node.js.
3. Confirmar que o serviço responde apenas com validação offline de integridade.

### Opção B: Reversão de Código para a Tag Legada Homologada
1. Fazer o checkout da tag legada homologada `v1.0.0-ga-ready` (`048a11d`):
   ```bash
   git checkout v1.0.0-ga-ready
   ```
2. Re-compilar o frontend e o backend:
   ```bash
   npm run build
   npm --prefix frontend run build
   ```
3. Reiniciar os serviços de produção.
4. Notificar a equipe de governança e registrar a ocorrência no log de incidentes.
