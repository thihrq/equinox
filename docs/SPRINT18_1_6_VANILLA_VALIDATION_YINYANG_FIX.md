# Sprint 18.1.6 — Vanilla Validation + Yin Yang Fix

## Objetivo

Refinar as mudanças recentes de UI/UX antes de avançar para Pokémon Champions Regulation Profiles.

## Ajustes

- Corrige a simetria do Yin Yang superior da sidebar, que estava herdando estilos do texto secundário do brand.
- Mantém a mesma família visual do símbolo nos estados vazios e na barra lateral.
- Não adiciona novos Yin Yang decorativos.
- Troca erro genérico do builder por mensagens acionáveis quando o usuário escolhe Pokémon incompatível com o jogo Vanilla selecionado.
- Retorna validações de time base como HTTP 400, não 500.
- Distingue Pokémon inexistente de Pokémon existente porém fora da geração/pool selecionado.

## Exemplos de validação

PT-BR:

```txt
Pokémon não é compatível com a geração selecionada: Sceptile-Mega. Digite um Pokémon compatível com Pokémon FireRed / LeafGreen (Kanto Pokédex #001-151).
```

EN-US:

```txt
This Pokémon is not compatible with the selected game: Sceptile-Mega. Type a Pokémon compatible with Pokémon FireRed / LeafGreen (Kanto Pokédex #001-151).
```
