# Active V2 Runtime Flag Changelog

Registro obrigatório (adendo 4.2) de toda mudança de estado do circuit breaker dinâmico
(`active-v2-runtime-control`). Uma linha por mudança — nunca editar linhas existentes,
apenas anexar.

| Timestamp UTC | Responsável | Aprovador | Valor Anterior | Valor Novo | Motivo | Canary Campaign ID | Publish Run ID | Resultado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-07-17T21:14:10.782Z | Thiago | n/a | off | internal | primeira | unstarted | n/a | success |
| 2026-07-17T23:40:22.579Z | Thiago | n/a | internal | percentage:5 | Avanco para Fase 6 - canario publico 5%, apos validacao real da Fase 5 (auth HMAC, decisao, fallback seguro confirmados em producao) | unstarted | n/a | success |
| 2026-07-19T01:46:28.837Z | Thiago Silva | n/a | normal | force-baseline | Pausa temporaria para publicar 4 novos sets (Suicune/Pelipper/Hydreigon/Indeedee-F) em producao | n/a | active-v2-prod-publish-2026-07-19 | success |
| 2026-07-19T01:47:07.106Z | Thiago Silva | n/a | percentage:5 | percentage:5 | Reiniciar janela de observacao apos publicacao de 4 novos sets | canary-campaign-2026-07-19-data-expansion | n/a | success |
| 2026-07-19T01:50:45.317Z | Thiago Silva + Thiago Silva (aprovacao solo - projeto individual, sem segundo revisor humano disponivel) | Thiago Silva, Thiago Silva (aprovacao solo - projeto individual, sem segundo revisor humano disponivel) | force-baseline | normal | V2 publicado com sucesso em producao (8 sets ativos), seguro reativar servico normal | canary-campaign-2026-07-19-data-expansion | active-v2-prod-publish-2026-07-19 | success |
| 2026-07-19T13:05:19.491Z | Thiago Silva | n/a | normal | force-baseline | Pausa temporaria para publicar 6 novos sets (Sinistcha-redirection/Aggron-body-press/Incineroar-taunt/Togekiss/Muk-Alola/Giratina-Origin) em producao | n/a | active-v2-prod-publish-2026-07-19-b | success |
| 2026-07-19T13:05:26.676Z | Thiago Silva | n/a | percentage:5 | percentage:5 | Reiniciar janela de observacao apos publicacao de 6 novos sets | canary-campaign-2026-07-19-data-expansion-b | n/a | success |
| 2026-07-19T13:06:28.705Z | Thiago Silva + Thiago Silva (aprovacao solo - projeto individual, sem segundo revisor humano disponivel) | Thiago Silva, Thiago Silva (aprovacao solo - projeto individual, sem segundo revisor humano disponivel) | force-baseline | normal | V2 publicado com sucesso em producao (14 sets ativos), seguro reativar servico normal | canary-campaign-2026-07-19-data-expansion-b | active-v2-prod-publish-2026-07-19-b | success |
