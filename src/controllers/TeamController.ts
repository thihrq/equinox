import { Request, Response } from 'express';
import { TeamService, TeamSuggestionInputError } from '../services/TeamService';
import { TeamIdentity } from '../equinox/recommendation/CandidateScoreEngine';
import { appConfig } from '../config/env';

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

      const result = await TeamService.suggestComplements(
        normalizedTeam,
        String(format || 'vanilla'),
        Boolean(allowLegendaries),
        normalizeTeamIdentity(teamIdentity),
      );

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
        'TEAM_SUGGESTION_FAILED',
        'Erro ao sugerir complementos para o time.',
        error,
      ));
    }
  }
}
