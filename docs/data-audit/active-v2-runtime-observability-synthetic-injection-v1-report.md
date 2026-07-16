# Relatório de Auditoria — Active V2 Runtime Observability Synthetic Injection Gate V1

**Gerado em:** 2026-07-16T01:06:41.658Z

## 1. Resumo Executivo

*   **Versão da Política:** `active-v2-runtime-observability-v1`
*   **SLA de disparo:** `60000ms`
*   **Todos os alertas dispararam:** `SIM`
*   **Todos dentro do SLA:** `SIM`
*   **Gate da Fase 2A:** `APROVADO`

> **Limitação assumida:** Injeção offline em memória — comprova a lógica de classificação e o orçamento de SLA de avaliação, não a entrega ponta-a-ponta contra um ambiente de staging vivo (pendente da Fase 3).

## 2. Cenários de Injeção Sintética

| Alerta | Disparou | Tempo (ms) | Dentro do SLA | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| V2_ERROR_RATE | SIM | 0 | SIM | Taxa de erro do Active V2 acima de 5% em uma janela de 20 requisições |
| V2_TIMEOUT_RATE | SIM | 0 | SIM | Taxa de timeout do Active V2 acima de 5% em uma janela de 20 requisições |
| FALLBACK_RATE | SIM | 0 | SIM | Taxa de fallback para baseline acima de 10% em uma janela de 20 requisições |
| P95_LATENCY_DEGRADATION | SIM | 1 | SIM | Degradação de latência p95 do Active V2 acima de 50% em relação à baseline |
| BLOCKER_CLASSIFICATION_PRESENT | SIM | 0 | SIM | Um cenário classificado como blocker aparece na janela |
| ZERO_ACTIVE_SETS | SIM | 0 | SIM | Nenhum set ativo encontrado em pokemonsets_v2 |
| MULTIPLE_ACTIVE_VERSIONS | SIM | 0 | SIM | Mais de uma versão ativa simultânea para o mesmo setId |
| MANIFEST_INCONSISTENCY | SIM | 0 | SIM | recordCount do manifesto ativo não confere com a contagem real de sets ativos |
| DIGEST_MISMATCH | SIM | 0 | SIM | Digest recalculado dos sets ativos diverge do digest registrado no manifesto |
