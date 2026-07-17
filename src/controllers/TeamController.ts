import { Request, Response } from 'express';
import * as crypto from 'crypto';
import mongoose from 'mongoose';
import { TeamService, TeamSuggestionInputError } from '../services/TeamService';
import { TeamIdentity } from '../equinox/recommendation/CandidateScoreEngine';
import { appConfig } from '../config/env';
import { LeadStrategyRecommendationService } from '../services/LeadStrategyRecommendationService';
import { PokemonInput, LeadMode } from '../equinox/vgc/LeadBuildTypes';
import { runActiveV2RuntimeShadow } from '../services/competitive-data/runtime-shadow/ActiveV2RuntimeShadowOrchestrator';
import {
  resolveActiveV2RuntimeServe,
  writeActiveV2RuntimeServeTelemetry,
} from '../services/competitive-data/runtime-serve/ActiveV2RuntimeServeOrchestrator';
import { ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1 } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAuthPolicy';
import type { ActiveV2InternalCanaryRequestHeaders } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAuthTypes';
import type { ActiveV2ServeSuggestedPokemon } from '../services/competitive-data/runtime-serve/ActiveV2RuntimeServeTypes';

type SuggestedPokemonEntry = {
  name: string;
  item: string;
  ability: string;
  nature: string;
  moves: string[];
  kit?: { item?: string; ability?: string; nature?: string; moves?: string[] };
};

/**
 * Identificador determinístico para o hashing de canário (Fase 4) — formato
 * + composição do time normalizado, sem depender de sessão/autenticação
 * (que este endpoint não tem). Dá "stickiness": a mesma consulta de time
 * sempre cai no mesmo balde, em vez de sortear um balde novo a cada
 * requisição (o que aconteceria com um UUID aleatório).
 */
function buildActiveV2ServeIdentifier(format: string, team: string[]): string {
  return `${format}:${[...team].sort().join(',')}`;
}

function extractInternalCanaryAuthHeaders(req: Request): Partial<ActiveV2InternalCanaryRequestHeaders> | null {
  const { headerNames } = ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1;
  const readHeader = (name: string): string | undefined => {
    const value = req.headers[name];
    return typeof value === 'string' ? value : undefined;
  };
  const subject = readHeader(headerNames.subject);
  const timestamp = readHeader(headerNames.timestamp);
  const nonce = readHeader(headerNames.nonce);
  const signature = readHeader(headerNames.signature);
  if (!subject && !timestamp && !nonce && !signature) return null;
  return { subject, timestamp, nonce, signature };
}

/**
 * Sobrescreve item/ability/nature/moves no lugar dos dados do baseline —
 * tanto os campos soltos quanto o sub-objeto `kit` duplicado (ver
 * RecommendationAdapter.formatOption), que carregam os mesmos valores em
 * dois lugares no mesmo objeto.
 */
function applyActiveV2Hydration(result: unknown, hydrated: ActiveV2ServeSuggestedPokemon[]): void {
  const suggestedPokemons = (result as { topTeams?: Array<{ suggestedPokemons?: SuggestedPokemonEntry[] }> })
    .topTeams?.[0]?.suggestedPokemons;
  if (!Array.isArray(suggestedPokemons)) return;

  for (const hydratedPokemon of hydrated) {
    const target = suggestedPokemons.find(p => p?.name === hydratedPokemon.name);
    if (!target) continue;
    target.item = hydratedPokemon.item;
    target.ability = hydratedPokemon.ability;
    target.nature = hydratedPokemon.nature;
    target.moves = hydratedPokemon.moves;
    if (target.kit) {
      target.kit.item = hydratedPokemon.item;
      target.kit.ability = hydratedPokemon.ability;
      target.kit.nature = hydratedPokemon.nature;
      target.kit.moves = hydratedPokemon.moves;
    }
  }
}

const ALLOWED_IDENTITIES: TeamIdentity[] = [
  'balanced',
  'bulky_offense',
  'hyper_offense',
  'stall',
  'speed',
  'fun',
];

function normalizeTeamIdentity(value: unknown): TeamIdentity {
  if (typeof value !== 'string') return 'balanced';

  return ALLOWED_IDENTITIES.includes(value as TeamIdentity)
    ? (value as TeamIdentity)
    : 'balanced';
}

function normalizePokemonInput(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => String(item ?? '').trim())
    .filter(Boolean);
}

function normalizeLeadInput(value: unknown): PokemonInput[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (typeof item === 'string') {
      return { name: item.trim() };
    }
    if (item && typeof item === 'object') {
      const obj = item as any;
      return {
        name: String(obj.name ?? '').trim(),
        item: obj.item ? String(obj.item).trim() : undefined,
        ability: obj.ability ? String(obj.ability).trim() : undefined,
        moves: Array.isArray(obj.moves) ? obj.moves.map((m: any) => String(m ?? '').trim()).filter(Boolean) : undefined,
        nature: obj.nature ? String(obj.nature).trim() : undefined,
      };
    }
    return { name: '' };
  }).filter(p => p.name !== '');
}



function localizeExactTeamSizeError(locale: unknown): string {
  return locale === 'en-US'
    ? 'Please provide exactly 3 Pokémon to build the base team.'
    : 'Informe exatamente 3 Pokémon para montar a base do time.';
}

function internalErrorPayload(code: string, message: string, error: unknown) {
  return {
    code,
    message,
    ...(appConfig.isProduction ? {} : { error: error instanceof Error ? error.message : error }),
  };
}

function localizeSuggestionInputError(error: TeamSuggestionInputError, locale: unknown): string {
  const isEnglish = locale === 'en-US';
  const pokemonNames = Array.isArray(error.details.pokemonNames)
    ? error.details.pokemonNames.join(', ')
    : '';
  const formatLabel = typeof error.details.formatLabel === 'string'
    ? error.details.formatLabel
    : 'o jogo selecionado';
  const poolLabel = typeof error.details.poolLabel === 'string'
    ? error.details.poolLabel
    : 'a geração selecionada';

  if (error.code === 'POKEMON_NOT_FOUND') {
    return isEnglish
      ? `Pokémon not found: ${pokemonNames}. Check the spelling and type a Pokémon available in the Equinox database.`
      : `Pokémon não encontrado: ${pokemonNames}. Verifique a escrita e digite um Pokémon existente no banco do Equinox.`;
  }

  if (error.code === 'VANILLA_POOL_INCOMPATIBLE') {
    return isEnglish
      ? `This Pokémon is not compatible with the selected game: ${pokemonNames}. Type a Pokémon compatible with ${formatLabel} (${poolLabel}).`
      : `Pokémon não é compatível com a geração selecionada: ${pokemonNames}. Digite um Pokémon compatível com ${formatLabel} (${poolLabel}).`;
  }

  if (error.code === 'FORMAT_RULE_INCOMPATIBLE') {
    return isEnglish
      ? `This Pokémon is not compatible with the selected format rules: ${pokemonNames}. Change the core or choose a compatible format.`
      : `Pokémon não é compatível com as regras do formato selecionado: ${pokemonNames}. Troque o core ou escolha um formato compatível.`;
  }

  return isEnglish
    ? 'Please provide exactly 3 valid Pokémon to build the base team.'
    : 'Informe exatamente 3 Pokémon válidos para montar a base do time.';
}

export class TeamController {
  public static async analyze(req: Request, res: Response): Promise<void> {
    try {
      const { team, format } = req.body;
      const normalizedTeam = normalizePokemonInput(team);

      if (normalizedTeam.length === 0) {
        res.status(400).json({
          message: 'Informe uma equipe válida para análise.',
        });
        return;
      }

      const analysis = normalizedTeam.map((pokemonName: string) => ({
        name: pokemonName,
      }));

      res.json({
        team: analysis,
        format,
      });
    } catch (error) {
      res.status(500).json(internalErrorPayload(
        'TEAM_ANALYSIS_FAILED',
        'Erro ao analisar equipe.',
        error,
      ));
    }
  }

  public static async suggest(req: Request, res: Response): Promise<void> {
    try {
      const {
        team,
        format = 'vanilla',
        allowLegendaries = false,
        teamIdentity = 'balanced',
      } = req.body;

      const normalizedTeam = normalizePokemonInput(team);

      if (normalizedTeam.length !== 3) {
        res.status(400).json({
          code: 'INVALID_TEAM_SIZE',
          message: localizeExactTeamSizeError(req.body?.locale),
        });
        return;
      }

      const resolvedFormat = String(format || 'vanilla');
      const resolvedTeamIdentity = normalizeTeamIdentity(teamIdentity);
      const startedAt = Date.now();
      const result = await TeamService.suggestComplements(
        normalizedTeam,
        resolvedFormat,
        Boolean(allowLegendaries),
        resolvedTeamIdentity,
      );
      const baselineLatencyMs = Date.now() - startedAt;

      const primaryTeamSuggestedPokemons = (result as { topTeams?: Array<{ suggestedPokemons?: unknown }> }).topTeams?.[0]?.suggestedPokemons as
        | { name: string; item: string; ability: string; nature: string; moves: string[] }[]
        | undefined ?? [];
      const requestId = crypto.randomUUID();

      // Active V2 — decide e, quando aplicável, hidrata os dados de set
      // (item/ability/nature/moves) ANTES da resposta ser enviada, já que
      // (ao contrário do shadow mode) isso precisa afetar o que o usuário
      // recebe. Nunca lança: qualquer erro/timeout cai em baseline — ver
      // ActiveV2RuntimeServeOrchestrator.
      const serveResult = await resolveActiveV2RuntimeServe(mongoose.connection, {
        requestId,
        identifier: buildActiveV2ServeIdentifier(resolvedFormat, normalizedTeam),
        format: resolvedFormat,
        teamIdentity: resolvedTeamIdentity,
        primaryTeamSuggestedPokemons,
        baselineLatencyMs,
        internalCanaryAuthHeaders: extractInternalCanaryAuthHeaders(req),
        requestPath: req.path,
      });
      if (serveResult.hydratedSuggestedPokemons) {
        applyActiveV2Hydration(result, serveResult.hydratedSuggestedPokemons);
      }

      res.json(result);

      if (serveResult.telemetryEvent) {
        void writeActiveV2RuntimeServeTelemetry(mongoose.connection, serveResult.telemetryEvent)
          .catch(error => console.warn('[Equinox] Active V2 runtime serve telemetry failed (ignored):', error));
      }

      // Fase 3 — Runtime Shadow Mode. Disparado somente APÓS a resposta já
      // ter sido enviada; nunca pode afetar o que o usuário recebeu. Mesmo
      // padrão fire-and-forget já usado em src/server.ts para trabalho de
      // background não crítico. Mutuamente exclusivo com o serving real
      // acima por modo de canário (shadow nunca resulta em servePath
      // active-v2), então `primaryTeamSuggestedPokemons` aqui sempre
      // reflete o baseline original quando este caminho executa de fato.
      void runActiveV2RuntimeShadow(mongoose.connection, {
        requestId,
        format: resolvedFormat,
        teamIdentity: resolvedTeamIdentity,
        primaryTeamSuggestedPokemons,
        baselineLatencyMs,
      }).catch(error => console.warn('[Equinox] Active V2 runtime shadow failed (ignored):', error));
    } catch (error) {
      if (error instanceof TeamSuggestionInputError) {
        res.status(error.statusCode).json({
          code: error.code,
          message: localizeSuggestionInputError(error, req.body?.locale),
          details: error.details,
        });
        return;
      }

      res.status(500).json(internalErrorPayload(
        'TEAM_SUGGESTION_FAILED',
        'Erro ao sugerir complementos para o time.',
        error,
      ));
    }
  }

  public static async suggestFromLead(req: Request, res: Response): Promise<void> {
    try {
      const {
        lead,
        format = 'champions_reg_m_b_doubles',
        leadMode = 'fixed-lead',
        allowLegendaries = false,
        teamIdentity = 'balanced',
      } = req.body;

      const normalizedLead = normalizeLeadInput(lead);

      if (normalizedLead.length !== 2) {
        res.status(400).json({
          code: 'INVALID_TEAM_SIZE',
          message: req.body?.locale === 'en-US'
            ? 'Please provide exactly 2 Pokémon for the lead.'
            : 'Informe exatamente 2 Pokémon para a lead.',
        });
        return;
      }

      const service = new LeadStrategyRecommendationService();
      const result = await service.execute({
        lead: [normalizedLead[0], normalizedLead[1]],
        format: String(format || 'champions_reg_m_b_doubles'),
        leadMode: (leadMode === 'core-pair' ? 'core-pair' : 'fixed-lead') as LeadMode,
        allowLegendaries: Boolean(allowLegendaries),
        teamIdentity: normalizeTeamIdentity(teamIdentity),
      });

      res.json(result);
    } catch (error) {
      if (error instanceof TeamSuggestionInputError) {
        res.status(error.statusCode).json({
          code: error.code,
          message: localizeSuggestionInputError(error, req.body?.locale),
          details: error.details,
        });
        return;
      }

      res.status(500).json(internalErrorPayload(
        'LEAD_SUGGESTION_FAILED',
        'Erro ao sugerir complementos a partir da lead.',
        error,
      ));
    }
  }
}
