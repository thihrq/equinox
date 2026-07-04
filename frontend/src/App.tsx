import React, { useMemo, useState } from 'react';
import { Loader2, Moon, Sun } from 'lucide-react';
import type { ExplanationEntry, SuggestionResponse, TeamIdentity, TeamOption } from './types/equinox';
import type { Locale } from './i18n/equinoxI18n';
import { t } from './i18n/equinoxI18n';
import { getNextPokemonSpriteUrl, getPokemonSpriteUrl, getSmogonPokemonSlug } from './utils/pokemonSprites';
import { apiPost, type ApiErrorShape } from './services/api';
import { BattlePlanHero, CoachTimeline, SectionHeader } from './components/coach';
import { PokemonGrid } from './components/pokemon';
import { OptionTabs, StrategySummary } from './components/strategy';
import {
  AIBuilderDecision,
  CandidateDiversity,
  ChampionsRegulationPanel,
  DataSourcePanel,
  CoverageSpeed,
  DetailsBlock,
  ExplanationList,
  FormatIntelligencePanel,
  MatchupAnalysis,
  RadicalRedGauntletPanel,
  ScoreBreakdownView,
  ThreatReport,
} from './components/analysis';

type FormatFamily = 'vanilla' | 'competitive' | 'radical_red' | 'champions';

interface PickerOption<TValue extends string = string> {
  value: TValue;
  label: string;
  short: string;
}

interface VanillaGamePickerOption extends PickerOption {
  group: string;
}

const getIdentityOptions = (locale: Locale): Array<PickerOption<TeamIdentity>> => [
  { value: 'balanced', label: t(locale, 'identityBalanced'), short: t(locale, 'identityBalancedShort') },
  { value: 'bulky_offense', label: t(locale, 'identityBulky'), short: t(locale, 'identityBulkyShort') },
  { value: 'hyper_offense', label: t(locale, 'identityHyper'), short: t(locale, 'identityHyperShort') },
  { value: 'stall', label: t(locale, 'identityStall'), short: t(locale, 'identityStallShort') },
  { value: 'speed', label: t(locale, 'identitySpeed'), short: t(locale, 'identitySpeedShort') },
  { value: 'fun', label: t(locale, 'identityFun'), short: t(locale, 'identityFunShort') },
];

const getFormatFamilies = (locale: Locale): Array<PickerOption<FormatFamily>> => [
  { value: 'vanilla', label: t(locale, 'formatFamilyVanilla'), short: t(locale, 'formatFamilyVanillaShort') },
  { value: 'competitive', label: t(locale, 'formatFamilyCompetitive'), short: t(locale, 'formatFamilyCompetitiveShort') },
  { value: 'radical_red', label: t(locale, 'formatFamilyRadicalRed'), short: t(locale, 'formatFamilyRadicalRedShort') },
  { value: 'champions', label: t(locale, 'formatFamilyChampions'), short: t(locale, 'formatFamilyChampionsShort') },
];

const getVanillaGameOptions = (locale: Locale): VanillaGamePickerOption[] => [
  { group: t(locale, 'vanillaGroupKanto'), value: 'vanilla_red_blue_yellow', label: t(locale, 'formatRedBlueYellow'), short: t(locale, 'formatRedBlueYellowShort') },
  { group: t(locale, 'vanillaGroupKanto'), value: 'vanilla_fire_red', label: t(locale, 'formatFireRed'), short: t(locale, 'formatFireRedShort') },
  { group: t(locale, 'vanillaGroupJohto'), value: 'vanilla_gold_silver_crystal', label: t(locale, 'formatGoldSilverCrystal'), short: t(locale, 'formatGoldSilverCrystalShort') },
  { group: t(locale, 'vanillaGroupJohto'), value: 'vanilla_heartgold_soulsilver', label: t(locale, 'formatHeartGoldSoulSilver'), short: t(locale, 'formatHeartGoldSoulSilverShort') },
  { group: t(locale, 'vanillaGroupHoenn'), value: 'vanilla_ruby_sapphire', label: t(locale, 'formatRubySapphire'), short: t(locale, 'formatRubySapphireShort') },
  { group: t(locale, 'vanillaGroupHoenn'), value: 'vanilla_emerald', label: t(locale, 'formatEmerald'), short: t(locale, 'formatEmeraldShort') },
  { group: t(locale, 'vanillaGroupHoenn'), value: 'vanilla_omega_ruby_alpha_sapphire', label: t(locale, 'formatOmegaRubyAlphaSapphire'), short: t(locale, 'formatOmegaRubyAlphaSapphireShort') },
  { group: t(locale, 'vanillaGroupSinnoh'), value: 'vanilla_diamond_pearl', label: t(locale, 'formatDiamondPearl'), short: t(locale, 'formatDiamondPearlShort') },
  { group: t(locale, 'vanillaGroupSinnoh'), value: 'vanilla_platinum', label: t(locale, 'formatPlatinum'), short: t(locale, 'formatPlatinumShort') },
  { group: t(locale, 'vanillaGroupSinnoh'), value: 'vanilla_brilliant_diamond_shining_pearl', label: t(locale, 'formatBrilliantDiamondShiningPearl'), short: t(locale, 'formatBrilliantDiamondShiningPearlShort') },
  { group: t(locale, 'vanillaGroupUnova'), value: 'vanilla_black_white', label: t(locale, 'formatBlackWhite'), short: t(locale, 'formatBlackWhiteShort') },
  { group: t(locale, 'vanillaGroupUnova'), value: 'vanilla_black_2_white_2', label: t(locale, 'formatBlack2White2'), short: t(locale, 'formatBlack2White2Short') },
  { group: t(locale, 'vanillaGroupKalos'), value: 'vanilla_x_y', label: t(locale, 'formatXY'), short: t(locale, 'formatXYShort') },
  { group: t(locale, 'vanillaGroupKalos'), value: 'vanilla_legends_za', label: t(locale, 'formatLegendsZA'), short: t(locale, 'formatLegendsZAShort') },
  { group: t(locale, 'vanillaGroupAlola'), value: 'vanilla_sun_moon', label: t(locale, 'formatSunMoon'), short: t(locale, 'formatSunMoonShort') },
  { group: t(locale, 'vanillaGroupAlola'), value: 'vanilla_ultra_sun_ultra_moon', label: t(locale, 'formatUltraSunUltraMoon'), short: t(locale, 'formatUltraSunUltraMoonShort') },
  { group: t(locale, 'vanillaGroupSwitch'), value: 'vanilla_lets_go_pikachu_eevee', label: t(locale, 'formatLetsGoPikachuEevee'), short: t(locale, 'formatLetsGoPikachuEeveeShort') },
  { group: t(locale, 'vanillaGroupGalar'), value: 'vanilla_sword_shield', label: t(locale, 'formatSwordShield'), short: t(locale, 'formatSwordShieldShort') },
  { group: t(locale, 'vanillaGroupHisui'), value: 'vanilla_legends_arceus', label: t(locale, 'formatLegendsArceus'), short: t(locale, 'formatLegendsArceusShort') },
  { group: t(locale, 'vanillaGroupPaldea'), value: 'vanilla_scarlet_violet', label: t(locale, 'formatScarletViolet'), short: t(locale, 'formatScarletVioletShort') },
];

const getChampionsOptions = (locale: Locale): Array<PickerOption> => [
  { value: 'champions_reg_m_b_singles', label: t(locale, 'formatChampionsSingles'), short: t(locale, 'formatChampionsSinglesShort') },
  { value: 'champions_reg_m_b_doubles', label: t(locale, 'formatChampionsDoubles'), short: t(locale, 'formatChampionsDoublesShort') },
];

const getFormatFamily = (format: string): FormatFamily => {
  if (format.startsWith('vanilla_') || format === 'vanilla') return 'vanilla';
  if (format.startsWith('champions_')) return 'champions';
  if (format === 'radical_red') return 'radical_red';
  return 'competitive';
};

export default function App() {
  const [team, setTeam] = useState(['', '', '']);
  const [format, setFormat] = useState('vanilla_fire_red');
  const [teamIdentity, setTeamIdentity] = useState<TeamIdentity>('balanced');
  const [allowLegendaries, setAllowLegendaries] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [locale, setLocale] = useState<Locale>('pt-BR');
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestionResponse | null>(null);
  const [error, setError] = useState('');

  const identityOptions = useMemo(() => getIdentityOptions(locale), [locale]);
  const formatFamilies = useMemo(() => getFormatFamilies(locale), [locale]);
  const vanillaGameOptions = useMemo(() => getVanillaGameOptions(locale), [locale]);
  const championsOptions = useMemo(() => getChampionsOptions(locale), [locale]);
  const activeFormatFamily = useMemo(() => getFormatFamily(format), [format]);
  const vanillaGamesByGroup = useMemo(() => {
    return vanillaGameOptions.reduce<Record<string, VanillaGamePickerOption[]>>((groups, option) => {
      groups[option.group] = [...(groups[option.group] ?? []), option];
      return groups;
    }, {});
  }, [vanillaGameOptions]);
  const selectedVanillaGame = useMemo(() => {
    return vanillaGameOptions.find(option => option.value === format);
  }, [format, vanillaGameOptions]);

  const selectedOption = useMemo(() => {
    if (!result?.topTeams?.length) return null;
    return result.topTeams[Math.min(selectedOptionIndex, result.topTeams.length - 1)];
  }, [result, selectedOptionIndex]);

  const identityLabel = identityOptions.find(option => option.value === teamIdentity)?.label ?? 'Balance';

  const getSpriteUrl = (name: string) => getPokemonSpriteUrl(name);

  const getSmogonUrl = (name: string) => {
    const slug = getSmogonPokemonSlug(name);
    return `https://www.smogon.com/dex/sv/pokemon/${slug}/`;
  };

  const handleInputChange = (index: number, value: string) => {
    const newTeam = [...team];
    newTeam[index] = value;
    setTeam(newTeam);
  };

  const handleFormatFamilyChange = (family: FormatFamily) => {
    if (family === activeFormatFamily) return;

    if (family === 'vanilla') {
      setFormat('vanilla_fire_red');
      return;
    }

    if (family === 'competitive') {
      setFormat('national_dex');
      return;
    }

    if (family === 'radical_red') {
      setFormat('radical_red');
      return;
    }

    setFormat('champions_reg_m_b_singles');
  };

  const formatScore = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '0';
    return value > 0 ? `+${value}` : `${value}`;
  };

  const formatPercent = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '0%';
    return `${Math.round(value * 100)}%`;
  };

  const formatAverageSpeed = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '0';
    return value.toFixed(1);
  };

  const normalizeScore = (value: number) => Math.max(0, Math.min(100, 50 + value));

  const getTopExplanations = (option: TeamOption): ExplanationEntry[] => {
    return [...(option.explanations ?? [])]
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 6);
  };

  const getFriendlyApiError = (apiError: ApiErrorShape): string => {
    const status = apiError.response?.status;
    const code = apiError.response?.data?.code;

    if (status === 0 || code === 'NETWORK_ERROR') return t(locale, 'networkError');
    if (status === 404 || code === 'ROUTE_NOT_FOUND') return t(locale, 'routeError');
    if (status === 403 || code === 'CORS_ORIGIN_NOT_ALLOWED') return t(locale, 'corsError');

    return apiError.response?.data?.message || t(locale, 'serverError');
  };

  const analyzeTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (team.some(pokemon => pokemon.trim() === '')) {
      setError(t(locale, 'fillTeamError'));
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setSelectedOptionIndex(0);

    try {
      const response = await apiPost<SuggestionResponse>('/api/team/suggest', {
        team: team.map(pokemon => pokemon.trim()),
        format,
        allowLegendaries,
        teamIdentity,
        locale,
      });

      setResult(response);
    } catch (err: unknown) {
      setError(getFriendlyApiError(err as ApiErrorShape));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`eq-app-shell eq-theme-${theme}`}>
      <aside className="eq-sidebar-v2">
        <div className="eq-sidebar-brand">
          <YinYangMark className="eq-brand-orb" />
          <div>
            <strong>EQUINOX</strong>
            <span>Team Builder</span>
          </div>
        </div>

        <form className="eq-builder-panel" onSubmit={analyzeTeam}>
          <SectionLabel>{t(locale, 'timeBase')}</SectionLabel>

          <div className="eq-team-inputs">
            {[0, 1, 2].map(index => {
              const sprite = getSpriteUrl(team[index]);

              return (
                <label key={index} className="eq-team-input">
                  <span className="eq-team-slot">
                    {sprite ? (
                      <img
                        src={sprite}
                        alt={`Pokémon ${index + 1}`}
                        onError={event => {
                          event.currentTarget.src = getNextPokemonSpriteUrl(team[index], event.currentTarget.src);
                        }}
                      />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <input
                    type="text"
                    placeholder="Ex: Charizard"
                    value={team[index]}
                    onChange={event => handleInputChange(index, event.target.value)}
                  />
                </label>
              );
            })}
          </div>

          <div className="eq-sidebar-actions">
            <button
              className={`eq-modern-toggle ${allowLegendaries ? 'is-active' : ''}`}
              type="button"
              onClick={() => setAllowLegendaries(!allowLegendaries)}
            >
              <span>{t(locale, 'allowLegendaries')}</span>
              <i />
            </button>

            <button className="eq-generate-button" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="eq-spin" size={18} /> {t(locale, 'calculating')}
                </>
              ) : (
                t(locale, 'generate')
              )}
            </button>
          </div>

          {error && <p className="eq-error-message" role="alert">{error}</p>}

          <SectionLabel>{t(locale, 'format')}</SectionLabel>
          <div className="eq-format-picker eq-format-family-picker">
            {formatFamilies.map(option => (
              <button
                key={option.value}
                type="button"
                className={activeFormatFamily === option.value ? 'is-active' : ''}
                onClick={() => handleFormatFamilyChange(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.short}</span>
              </button>
            ))}
          </div>

          {activeFormatFamily === 'vanilla' && (
            <div className="eq-format-subpanel eq-format-subpanel--select">
              <span>{t(locale, 'vanillaGame')}</span>
              <label className="eq-format-select">
                <select
                  value={format}
                  onChange={event => setFormat(event.target.value)}
                  aria-label={t(locale, 'vanillaGame')}
                >
                  {Object.entries(vanillaGamesByGroup).map(([group, options]) => (
                    <optgroup key={group} label={group}>
                      {options.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {selectedVanillaGame && (
                <p className="eq-format-selected-note">
                  {selectedVanillaGame.short}
                </p>
              )}
            </div>
          )}

          {activeFormatFamily === 'champions' && (
            <div className="eq-format-subpanel">
              <span>{t(locale, 'championsMode')}</span>
              <p className="eq-format-selected-note">{t(locale, 'championsRegulationNote')}</p>
              <div className="eq-format-suboptions">
                {championsOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={format === option.value ? 'is-active' : ''}
                    onClick={() => setFormat(option.value)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.short}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <SectionLabel>{t(locale, 'identity')}</SectionLabel>
          <div className="eq-identity-picker">
            {identityOptions.map(option => (
              <button
                key={option.value}
                type="button"
                className={teamIdentity === option.value ? 'is-active' : ''}
                onClick={() => setTeamIdentity(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.short}</span>
              </button>
            ))}
          </div>
        </form>

        <div className="eq-sidebar-poem">
          <YinYangMark className="eq-sidebar-poem__mark" />
          <span>陰陽</span>
          <p>{t(locale, 'balanceMotto')}</p>
        </div>
      </aside>

      <main className="eq-main-v2">
        <header className="eq-header-v2 eq-header-v3">
          <div>
            <span className="eq-kicker-v2">{t(locale, 'appKicker')}</span>
            <h1>{t(locale, 'appTitle')}</h1>
            <p>{t(locale, 'appSubtitle')}</p>
          </div>

          <div className="eq-header-actions" aria-label={t(locale, 'interfaceControls')}>
            <div className="eq-header-language" role="group" aria-label={t(locale, 'language')}>
              <button type="button" className={locale === 'pt-BR' ? 'is-active' : ''} onClick={() => setLocale('pt-BR')}>
                PT
              </button>
              <button type="button" className={locale === 'en-US' ? 'is-active' : ''} onClick={() => setLocale('en-US')}>
                EN
              </button>
            </div>

            <button className="eq-theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t(locale, 'themeToggle')}>
              <Sun size={16} />
              <span><i /></span>
              <Moon size={16} />
            </button>
          </div>
        </header>

        {!result && !loading && <EmptyState locale={locale} />}
        {loading && <LoadingState locale={locale} />}

        {result && selectedOption && !loading && (
          <div className="eq-results-v3">
            <BattlePlanHero
              option={selectedOption}
              identityLabel={identityLabel}
              format={format}
              locale={locale}
              formatScore={formatScore}
              formatPercent={formatPercent}
            />

            <SectionHeader title={t(locale, 'coreTitle')} eyebrow={t(locale, 'coreEyebrow')} />
            <PokemonGrid
              pokemons={selectedOption.suggestedPokemons}
              locale={locale}
              getSpriteUrl={getSpriteUrl}
              getSmogonUrl={getSmogonUrl}
            />

            <OptionTabs
              options={result.topTeams}
              selectedIndex={selectedOptionIndex}
              locale={locale}
              onSelect={setSelectedOptionIndex}
              formatScore={formatScore}
            />

            <CoachTimeline coach={selectedOption.coach} suggestedPokemons={selectedOption.suggestedPokemons} locale={locale} />

            <SectionHeader title={t(locale, 'quickTitle')} eyebrow={t(locale, 'quickEyebrow')} />
            <StrategySummary option={selectedOption} locale={locale} />

            <section className="eq-details-v3">
              <SectionHeader title={t(locale, 'detailsTitle')} eyebrow={t(locale, 'detailsEyebrow')} />

              <DetailsBlock title={t(locale, 'formatIntelligence')} subtitle={t(locale, 'formatIntelligenceSubtitle')} count={selectedOption.formatIntelligence ? 1 : 0} locale={locale}>
                <FormatIntelligencePanel option={selectedOption} locale={locale} />
              </DetailsBlock>

              <DetailsBlock title={t(locale, 'dataSources')} subtitle={t(locale, 'dataSourcesSubtitle')} count={selectedOption.dataSourceReport?.entries.length ?? 0} locale={locale}>
                <DataSourcePanel option={selectedOption} locale={locale} />
              </DetailsBlock>

              <DetailsBlock title={t(locale, 'radicalRedGauntlet')} subtitle={t(locale, 'radicalRedGauntletSubtitle')} count={selectedOption.radicalRedGauntlet?.bossReports.length ?? 0} locale={locale}>
                <RadicalRedGauntletPanel option={selectedOption} locale={locale} />
              </DetailsBlock>

              <DetailsBlock title={t(locale, 'championsRegulation')} subtitle={t(locale, 'championsRegulationSubtitle')} count={selectedOption.championsRegulation ? 1 : 0} locale={locale}>
                <ChampionsRegulationPanel option={selectedOption} locale={locale} />
              </DetailsBlock>

              <DetailsBlock title={t(locale, 'threatIntelligence')} subtitle={t(locale, 'threatIntelligenceSubtitle')} count={selectedOption.threatAnalysis?.matchups.length ?? 0} locale={locale}>
                <ThreatReport option={selectedOption} locale={locale} />
              </DetailsBlock>

              <DetailsBlock title={t(locale, 'aiBuilderDecision')} subtitle={t(locale, 'aiBuilderDecisionSubtitle')} count={selectedOption.aiBuilder ? 1 : 0} locale={locale}>
                <AIBuilderDecision option={selectedOption} locale={locale} />
              </DetailsBlock>

              <DetailsBlock title={t(locale, 'matchupAnalysis')} subtitle={t(locale, 'matchupAnalysisSubtitle')} count={selectedOption.damageReport?.matchups.length ?? 0} locale={locale}>
                <MatchupAnalysis option={selectedOption} locale={locale} />
              </DetailsBlock>

              <DetailsBlock title={t(locale, 'coverageSpeed')} subtitle={t(locale, 'coverageSpeedSubtitle')} count={(selectedOption.offensiveCoverage?.uniqueAttackTypes.length ?? 0) + 1} locale={locale}>
                <CoverageSpeed option={selectedOption} locale={locale} formatPercent={formatPercent} formatAverageSpeed={formatAverageSpeed} />
              </DetailsBlock>

              <DetailsBlock title={t(locale, 'performanceMetrics')} subtitle={t(locale, 'performanceMetricsSubtitle')} count={6} locale={locale}>
                <ScoreBreakdownView option={selectedOption} locale={locale} normalizeScore={normalizeScore} formatScore={formatScore} />
              </DetailsBlock>

              <DetailsBlock title={t(locale, 'candidateDiversity')} subtitle={t(locale, 'candidateDiversitySubtitle')} count={result.candidateDiversity?.diversifiedCandidates ?? 0} locale={locale}>
                <CandidateDiversity diversity={result.candidateDiversity} locale={locale} />
              </DetailsBlock>

              <DetailsBlock title={t(locale, 'decisionReasons')} subtitle={t(locale, 'decisionReasonsSubtitle')} count={getTopExplanations(selectedOption).length} locale={locale}>
                <ExplanationList explanations={getTopExplanations(selectedOption)} locale={locale} formatScore={formatScore} />
              </DetailsBlock>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}


function YinYangMark({ className = '' }: { className?: string }) {
  return (
    <span className={`eq-yin-yang-mark ${className}`} aria-hidden="true">
      <span>☯</span>
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="eq-section-label">{children}</span>;
}

function EmptyState({ locale }: { locale: Locale }) {
  return (
    <section className="eq-empty-v2">
      <YinYangMark className="eq-empty-symbol" />
      <h2>{t(locale, 'emptyTitle')}</h2>
      <p>{t(locale, 'emptyText')}</p>
    </section>
  );
}

function LoadingState({ locale }: { locale: Locale }) {
  return (
    <section className="eq-loading-v2">
      <Loader2 className="eq-spin" size={30} />
      <h2>{t(locale, 'loadingTitle')}</h2>
      <p>{t(locale, 'loadingText')}</p>
      <div className="eq-loading-bars"><span /><span /><span /></div>
    </section>
  );
}
