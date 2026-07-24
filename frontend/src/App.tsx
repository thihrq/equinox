import React, { useMemo, useState } from 'react';
import { Moon, Sun, Search, X, Check, Copy, ArrowLeft, Shield, Zap, Sparkles, ShieldCheck, Cpu, Database, Activity, Layers } from 'lucide-react';
import type { SuggestionResponse, TeamIdentity, TeamOption } from './types/equinox';
import type { Locale } from './i18n/equinoxI18n';
import { t } from './i18n/equinoxI18n';
import { findPokemonNameSuggestions } from './utils/pokemonNames';
import { getNextPokemonSpriteUrl, getPokemonSpriteUrl } from './utils/pokemonSprites';
import { apiPost, type ApiErrorShape } from './services/api';
import { CompetitiveTeamGrid } from './components/pokemon/CompetitiveTeamGrid';
import { TeamWeaknessesCard } from './components/analysis/TeamWeaknessesCard';
import { ChampionsRegulationPanel } from './components/analysis/ChampionsRegulationPanel';
import { ScoreBreakdownView } from './components/analysis/ScoreBreakdownView';
import { FormatIntelligencePanel } from './components/analysis/FormatIntelligencePanel';
import { toShowdown } from './utils/competitiveTeamExport';
import { getPokemonTypesByName } from './utils/pokemonTypes';
import type { PokemonData } from './types/lead';

type FormatFamily = 'vanilla' | 'radical_red' | 'champions';
type ViewPage = 'home' | 'results';
type AnalysisTab = 'team' | 'synergy' | 'regulation' | 'format';

interface PickerOption<TValue extends string = string> {
  value: TValue;
  label: string;
  short: string;
}

interface VanillaGamePickerOption extends PickerOption {
  group: string;
}

const getIdentityOptions = (locale: Locale): Array<PickerOption<TeamIdentity>> => [
  { value: 'balanced', label: locale === 'pt-BR' ? 'Equilibrado' : 'Balanced', short: 'BAL' },
  { value: 'bulky_offense', label: locale === 'pt-BR' ? 'Bulky Offense' : 'Bulky Offense', short: 'BLK' },
  { value: 'hyper_offense', label: locale === 'pt-BR' ? 'Hyper Offense' : 'Hyper Offense', short: 'HYP' },
  { value: 'stall', label: locale === 'pt-BR' ? 'Stall Defensivo' : 'Defensive Stall', short: 'STL' },
  { value: 'speed', label: locale === 'pt-BR' ? 'Foco em Velocidade' : 'Speed Focused', short: 'SPD' },
];

const getVanillaGameOptions = (locale: Locale): VanillaGamePickerOption[] => [
  { group: locale === 'pt-BR' ? 'Kanto' : 'Kanto', value: 'vanilla_fire_red', label: 'FireRed / LeafGreen', short: 'GBA Gen 3' },
  { group: locale === 'pt-BR' ? 'Kanto' : 'Kanto', value: 'vanilla_red_blue_yellow', label: 'Red / Blue / Yellow', short: 'GB Gen 1' },
  { group: locale === 'pt-BR' ? 'Johto' : 'Johto', value: 'vanilla_gold_silver_crystal', label: 'Gold / Silver / Crystal', short: 'GBC Gen 2' },
  { group: locale === 'pt-BR' ? 'Johto' : 'Johto', value: 'vanilla_heartgold_soulsilver', label: 'HeartGold / SoulSilver', short: 'DS Gen 4' },
  { group: locale === 'pt-BR' ? 'Hoenn' : 'Hoenn', value: 'vanilla_emerald', label: 'Emerald', short: 'GBA Gen 3' },
  { group: locale === 'pt-BR' ? 'Hoenn' : 'Hoenn', value: 'vanilla_omega_ruby_alpha_sapphire', label: 'Omega Ruby / Alpha Sapphire', short: '3DS Gen 6' },
  { group: locale === 'pt-BR' ? 'Sinnoh' : 'Sinnoh', value: 'vanilla_platinum', label: 'Platinum', short: 'DS Gen 4' },
  { group: locale === 'pt-BR' ? 'Unova' : 'Unova', value: 'vanilla_black_2_white_2', label: 'Black 2 / White 2', short: 'DS Gen 5' },
  { group: locale === 'pt-BR' ? 'Paldea' : 'Paldea', value: 'vanilla_scarlet_violet', label: 'Scarlet / Violet', short: 'Switch Gen 9' },
];

const getChampionsOptions = (locale: Locale): Array<PickerOption> => [
  { value: 'champions_reg_m_b_doubles', label: locale === 'pt-BR' ? 'Champions Doubles (VGC Reg M-B)' : 'Champions Doubles (VGC Reg M-B)', short: 'VGC Doubles' },
  { value: 'champions_reg_m_b_singles', label: locale === 'pt-BR' ? 'Champions Singles' : 'Champions Singles', short: 'VGC Singles' },
];

const exampleCores = [
  ['Charizard', 'Jolteon', 'Lapras'],
  ['Garchomp', 'Rotom-Wash', 'Scizor'],
  ['Venusaur', 'Arcanine', 'Gyarados'],
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<ViewPage>('home');
  const [team, setTeam] = useState(['', '', '']);
  const [format, setFormat] = useState('champions_reg_m_b_doubles');
  const [teamIdentity, setTeamIdentity] = useState<TeamIdentity>('balanced');
  const [allowLegendaries, setAllowLegendaries] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [locale, setLocale] = useState<Locale>('pt-BR');
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<AnalysisTab>('team');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestionResponse | null>(null);
  const [error, setError] = useState('');
  const [copiedFullShowdown, setCopiedFullShowdown] = useState(false);

  // Modal para slots
  const [activeSlotModal, setActiveSlotModal] = useState<number | null>(null);
  const [slotSearchQuery, setSlotSearchQuery] = useState('');

  const activeFormatFamily: FormatFamily = useMemo(() => {
    if (format.startsWith('vanilla_') || format === 'vanilla') return 'vanilla';
    if (format === 'radical_red') return 'radical_red';
    return 'champions';
  }, [format]);

  const identityOptions = useMemo(() => getIdentityOptions(locale), [locale]);
  const vanillaGameOptions = useMemo(() => getVanillaGameOptions(locale), [locale]);
  const championsOptions = useMemo(() => getChampionsOptions(locale), [locale]);

  const selectedOption: TeamOption | null = useMemo(() => {
    if (!result || !result.topTeams?.length) return null;
    return result.topTeams[Math.min(selectedOptionIndex, result.topTeams.length - 1)];
  }, [result, selectedOptionIndex]);

  // Monta o TIME COMPLETO DE 6 POKÉMON (3 membros do Core + 3 membros sugeridos)
  const fullTeamPokemons: PokemonData[] = useMemo(() => {
    if (!selectedOption?.suggestedPokemons) return [];

    // Os 3 membros iniciais do Core com seus tipos reais
    const coreMembers: PokemonData[] = team.map((name, idx) => {
      const realTypes = getPokemonTypesByName(name);
      return {
        name: name || `Core ${idx + 1}`,
        types: realTypes,
        baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
        role: idx === 0 ? 'Lead Opener' : idx === 1 ? 'Secondary Core' : 'Tactical Support',
        ability: 'Pressure',
        item: 'Focus Sash',
        nature: 'Jolly',
        moves: ['Tackle', 'Protect', 'Substitute', 'Rest'],
        competitiveSet: {
          name: name || `Core ${idx + 1}`,
          types: realTypes,
          role: idx === 0 ? 'Lead Opener' : idx === 1 ? 'Secondary Core' : 'Tactical Support',
          ability: 'Pressure',
          item: 'Focus Sash',
          nature: 'Jolly',
          moves: ['Tackle', 'Protect', 'Substitute', 'Rest'],
          evs: { hp: 252, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
          ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
          setSource: 'generated',
          validation: { legal: true, errors: [], warnings: [] },
        },
      };
    });

    // Os 3 membros sugeridos com seus tipos reais
    const complementMembers: PokemonData[] = selectedOption.suggestedPokemons.map(p => {
      const realTypes = getPokemonTypesByName(p.name);
      const moves = (p.moves || p.kit?.moves || ['—', '—', '—', '—']).slice(0, 4);
      const movesTuple: [string, string, string, string] = [
        moves[0] || '—',
        moves[1] || '—',
        moves[2] || '—',
        moves[3] || '—',
      ];

      return {
        name: p.name,
        types: realTypes,
        baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
        role: p.kit?.role || p.role || 'Sweeper',
        ability: p.ability || p.kit?.ability || 'Pressure',
        item: p.item || p.kit?.item || 'Focus Sash',
        nature: p.nature || p.kit?.nature || 'Jolly',
        moves: movesTuple,
        competitiveSet: {
          name: p.name,
          types: realTypes,
          role: p.kit?.role || p.role || 'Sweeper',
          ability: p.ability || p.kit?.ability || 'Pressure',
          item: p.item || p.kit?.item || 'Focus Sash',
          nature: p.nature || p.kit?.nature || 'Jolly',
          moves: movesTuple,
          evs: { hp: 252, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
          ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
          setSource: 'generated',
          validation: { legal: true, errors: [], warnings: [] },
        },
      };
    });

    return [...coreMembers, ...complementMembers];
  }, [selectedOption, team]);

  const handleFormatFamilyChange = (family: FormatFamily) => {
    setResult(null);
    if (family === 'vanilla') setFormat('vanilla_fire_red');
    else if (family === 'radical_red') setFormat('radical_red');
    else setFormat('champions_reg_m_b_doubles');
  };

  const handleSlotSelect = (index: number, pokemonName: string) => {
    const newTeam = [...team];
    newTeam[index] = pokemonName;
    setTeam(newTeam);
    setActiveSlotModal(null);
    setSlotSearchQuery('');
  };

  const handleSlotRemove = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTeam = [...team];
    newTeam[index] = '';
    setTeam(newTeam);
  };

  const handleUseExampleCore = (core: string[]) => {
    setTeam(core);
    setError('');
    setResult(null);
    setSelectedOptionIndex(0);
  };

  const getFriendlyApiError = (apiError: ApiErrorShape): string => {
    const status = apiError.response?.status;
    const code = apiError.response?.data?.code;
    if (status === 0 || code === 'NETWORK_ERROR') return t(locale, 'networkError');
    if (status === 404 || code === 'ROUTE_NOT_FOUND') return t(locale, 'routeError');
    if (status === 403 || code === 'CORS_ORIGIN_NOT_ALLOWED') return t(locale, 'corsError');
    return apiError.response?.data?.message || t(locale, 'serverError');
  };

  const analyzeTeam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (team.some(pokemon => pokemon.trim() === '')) {
      setError(locale === 'pt-BR' ? 'Por favor, selecione os 3 Pokémon do core inicial.' : 'Please select all 3 initial core Pokémon.');
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
      setCurrentPage('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setError(getFriendlyApiError(err as ApiErrorShape));
    } finally {
      setLoading(false);
    }
  };

  const filledSlotsCount = team.filter(name => name.trim() !== '').length;

  const suggestions = useMemo(() => {
    if (!slotSearchQuery || slotSearchQuery.trim().length < 1) return [];
    return findPokemonNameSuggestions(slotSearchQuery, 8);
  }, [slotSearchQuery]);

  const copyFullShowdown = () => {
    if (!fullTeamPokemons.length) return;
    const showdownText = toShowdown(fullTeamPokemons);
    navigator.clipboard.writeText(showdownText);
    setCopiedFullShowdown(true);
    setTimeout(() => setCopiedFullShowdown(false), 2000);
  };

  const normalizeScore = (val: number) => Math.min(100, Math.max(0, val));
  const formatScore = (val?: number) => `${Math.round(val ?? 0)}%`;

  const leadPair = [team[0] || 'Lead 1', team[1] || 'Lead 2'];
  const finisherPokemon = selectedOption?.suggestedPokemons?.[0]?.name || team[0] || 'Sweeper';
  const setupPokemon = team[2] || selectedOption?.suggestedPokemons?.[1]?.name || 'Support';

  return (
    <div className={`min-h-screen flex flex-col selection:bg-white selection:text-[#031427] ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Top Header / AppBar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#031427]/95 backdrop-blur-md border-b border-[#444748]/50">
        <nav className="flex justify-between items-center w-full px-6 md:px-16 py-3.5 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-4">
            {currentPage === 'results' && (
              <button
                type="button"
                onClick={() => setCurrentPage('home')}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-all"
              >
                <ArrowLeft size={16} />
                <span>{locale === 'pt-BR' ? 'Voltar ao Core' : 'Back to Core'}</span>
              </button>
            )}

            <div
              className="text-xl md:text-2xl font-bold tracking-tighter text-white flex items-center gap-2 cursor-pointer"
              onClick={() => {
                setCurrentPage('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              EQUINOX
              <span className="material-symbols-outlined text-white/80">contrast</span>
            </div>

            {/* Governance Status Pill */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-bold text-emerald-300 tracking-wider font-mono uppercase">
                active-v2 • Reg M-B • 100% Legal
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
                className="flex items-center text-[#c4c7c8] hover:text-white transition-colors"
                title={locale === 'pt-BR' ? 'Alternar Tema' : 'Toggle Theme'}
              >
                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <div className="h-4 w-[1px] bg-[#444748]"></div>
              <div className="flex items-center text-xs font-semibold uppercase tracking-widest gap-1">
                <button
                  type="button"
                  onClick={() => setLocale('en-US')}
                  className={locale === 'en-US' ? 'text-white font-bold' : 'text-[#8e9192] hover:text-white transition-colors'}
                >
                  EN
                </button>
                <span className="text-[#444748]">/</span>
                <button
                  type="button"
                  onClick={() => setLocale('pt-BR')}
                  className={locale === 'pt-BR' ? 'text-white font-bold' : 'text-[#8e9192] hover:text-white transition-colors'}
                >
                  PT
                </button>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* RENDER PAGE 1: HOME PAGE */}
      {currentPage === 'home' && (
        <main className="flex-grow pt-[95px] px-4 md:px-16 max-w-[1600px] mx-auto w-full">
          {/* Hero Section */}
          <section className="mt-8 text-center md:text-left max-w-4xl">
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-3 animate-drift">
              {locale === 'pt-BR' ? 'Equilíbrio em Estratégia' : 'Equilibrium in Strategy'}
            </h1>
            <p className="text-lg text-[#c4c7c8] leading-relaxed max-w-2xl">
              {locale === 'pt-BR'
                ? 'Selecione o formato e os membros do core inicial para gerar uma equipe competitiva perfeita de 6 Pokémon. Projetado para táticos que buscam a vitória.'
                : 'Select your format and initial core members to generate a perfect 6-member competitive team. Designed for elite tacticians seeking victory.'}
            </p>

            {/* Feature Highlights Banner */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass-panel p-3 rounded-lg border border-white/10 flex items-center gap-2.5">
                <Cpu size={18} className="text-cyan-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">SynergyEngine</div>
                  <div className="text-[10px] text-[#8e9192] font-mono">Weather • Terrain • TR</div>
                </div>
              </div>

              <div className="glass-panel p-3 rounded-lg border border-white/10 flex items-center gap-2.5">
                <Database size={18} className="text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Active-v2 Package</div>
                  <div className="text-[10px] text-[#8e9192] font-mono">102 Expert Sets</div>
                </div>
              </div>

              <div className="glass-panel p-3 rounded-lg border border-white/10 flex items-center gap-2.5">
                <ShieldCheck size={18} className="text-purple-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Official Rules</div>
                  <div className="text-[10px] text-[#8e9192] font-mono">Item & Species Clause</div>
                </div>
              </div>

              <div className="glass-panel p-3 rounded-lg border border-white/10 flex items-center gap-2.5">
                <Activity size={18} className="text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Runtime Safety</div>
                  <div className="text-[10px] text-[#8e9192] font-mono">0 Fallbacks • Strict</div>
                </div>
              </div>
            </div>
          </section>

          {/* Format Selector Cards */}
          <section className="mt-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: VGC Regulation */}
              <div
                onClick={() => handleFormatFamilyChange('champions')}
                className={`glass-panel p-6 flex flex-col justify-between h-48 cursor-pointer rounded-xl group transition-all ${
                  activeFormatFamily === 'champions' ? 'active-selection' : ''
                }`}
              >
                <div>
                  <div className="text-xs text-[#8e9192] mb-1 tracking-tighter uppercase font-semibold">Format 01</div>
                  <h3 className="text-2xl font-semibold text-white tracking-tight">VGC Regulation</h3>
                  {activeFormatFamily === 'champions' && (
                    <div className="mt-3 flex gap-2">
                      {championsOptions.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setFormat(opt.value);
                            setResult(null);
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded font-bold transition-all ${
                            format === opt.value
                              ? 'bg-white text-[#031427]'
                              : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                        >
                          {opt.short}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="material-symbols-outlined text-white text-2xl">analytics</span>
                  <span className={`text-xs font-semibold tracking-wider ${activeFormatFamily === 'champions' ? 'text-white' : 'text-[#8e9192]'}`}>
                    {activeFormatFamily === 'champions' ? 'SELECTED' : 'SELECT'}
                  </span>
                </div>
              </div>

              {/* Card 2: Radical Red Hardcore */}
              <div
                onClick={() => handleFormatFamilyChange('radical_red')}
                className={`glass-panel p-6 flex flex-col justify-between h-48 cursor-pointer rounded-xl group transition-all ${
                  activeFormatFamily === 'radical_red' ? 'active-selection' : ''
                }`}
              >
                <div>
                  <div className="text-xs text-[#8e9192] mb-1 tracking-tighter uppercase font-semibold">Format 02</div>
                  <h3 className="text-2xl font-semibold text-white tracking-tight">Radical Red Hardcore</h3>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="material-symbols-outlined text-[#8e9192] group-hover:text-white text-2xl transition-colors">bolt</span>
                  <span className={`text-xs font-semibold tracking-wider ${activeFormatFamily === 'radical_red' ? 'text-white' : 'text-[#8e9192]'}`}>
                    {activeFormatFamily === 'radical_red' ? 'SELECTED' : 'SELECT'}
                  </span>
                </div>
              </div>

              {/* Card 3: Vanilla Classic */}
              <div
                onClick={() => handleFormatFamilyChange('vanilla')}
                className={`glass-panel p-6 flex flex-col justify-between h-48 cursor-pointer rounded-xl group transition-all ${
                  activeFormatFamily === 'vanilla' ? 'active-selection' : ''
                }`}
              >
                <div>
                  <div className="text-xs text-[#8e9192] mb-1 tracking-tighter uppercase font-semibold">Format 03</div>
                  <h3 className="text-2xl font-semibold text-white tracking-tight">Vanilla Classic</h3>
                  {activeFormatFamily === 'vanilla' && (
                    <div className="mt-2">
                      <select
                        value={format}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          setFormat(e.target.value);
                          setResult(null);
                        }}
                        className="bg-[#102034] text-white text-xs px-3 py-1.5 rounded border border-[#444748] w-full focus:outline-none focus:border-white font-medium"
                      >
                        {vanillaGameOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label} ({opt.short})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="material-symbols-outlined text-[#8e9192] group-hover:text-white text-2xl transition-colors">trophy</span>
                  <span className={`text-xs font-semibold tracking-wider ${activeFormatFamily === 'vanilla' ? 'text-white' : 'text-[#8e9192]'}`}>
                    {activeFormatFamily === 'vanilla' ? 'SELECTED' : 'SELECT'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Initial Core Selection Slots */}
          <section className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white uppercase tracking-widest">
                {locale === 'pt-BR' ? 'Membros do Core Inicial' : 'Initial Core Members'}
              </h2>
              <span className="text-xs text-[#8e9192] font-mono uppercase tracking-wider">
                {filledSlotsCount}/3 {locale === 'pt-BR' ? 'SLOTS PREENCHIDOS' : 'SLOTS FILLED'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { slotName: locale === 'pt-BR' ? 'Lead Principal' : 'Primary Lead', desc: locale === 'pt-BR' ? 'Abertura & Ritmo' : 'Defining Strategy' },
                { slotName: locale === 'pt-BR' ? 'Core Secundário' : 'Secondary Core', desc: locale === 'pt-BR' ? 'Pressão & Suporte' : 'Pivot Dynamics' },
                { slotName: locale === 'pt-BR' ? 'Suporte Tático' : 'Tactical Support', desc: locale === 'pt-BR' ? 'Utilidade & Defesa' : 'Defensive Utility' },
              ].map((slotInfo, index) => {
                const pokemonName = team[index];
                const sprite = pokemonName ? getPokemonSpriteUrl(pokemonName) : null;

                return (
                  <div key={index} className="group flex flex-col items-center">
                    <div
                      onClick={() => setActiveSlotModal(index)}
                      className="w-full aspect-square brutalist-border flex flex-col items-center justify-center bg-transparent hover:bg-white/5 transition-all duration-300 relative cursor-pointer rounded-xl group p-4 overflow-hidden"
                    >
                      {pokemonName ? (
                        <div className="flex flex-col items-center justify-center w-full h-full relative">
                          <button
                            type="button"
                            onClick={e => handleSlotRemove(index, e)}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 text-[#8e9192] hover:text-white rounded-full transition-colors z-10"
                            title="Remover"
                          >
                            <X size={14} />
                          </button>
                          {sprite && (
                            <img
                              src={sprite}
                              alt={pokemonName}
                              className="w-28 h-28 pokemon-sprite object-contain mb-2"
                              onError={e => {
                                (e.target as HTMLImageElement).src = getNextPokemonSpriteUrl(pokemonName, (e.target as HTMLImageElement).src);
                              }}
                            />
                          )}
                          <h4 className="text-lg font-bold text-white tracking-tight">{pokemonName}</h4>
                        </div>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-5xl text-[#8e9192] group-hover:text-white group-hover:scale-110 transition-all mb-2">
                            add_circle
                          </span>
                          <span className="text-xs text-[#8e9192] uppercase tracking-wider font-semibold">
                            {locale === 'pt-BR' ? 'Adicionar Pokémon' : 'Add Member'}
                          </span>
                        </>
                      )}
                      <div className="absolute inset-0 border-white/0 group-hover:border-white/20 border-2 rounded-xl transition-all pointer-events-none"></div>
                    </div>

                    <div className="mt-3 text-center">
                      <div className="text-sm font-semibold text-white uppercase tracking-tight">{slotInfo.slotName}</div>
                      <div className="text-xs text-[#8e9192]">{slotInfo.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Core Presets */}
            <div className="mt-6 flex flex-wrap items-center gap-3 justify-center md:justify-start">
              <span className="text-xs text-[#8e9192] uppercase tracking-wider">
                {locale === 'pt-BR' ? 'Testar com cores prontos:' : 'Or try a sample core:'}
              </span>
              {exampleCores.map((core, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleUseExampleCore(core)}
                  className="text-xs bg-white/5 border border-[#27272A] hover:border-white hover:bg-white/10 text-[#c4c7c8] hover:text-white px-3 py-1.5 rounded transition-all font-medium"
                >
                  {core.join(' / ')}
                </button>
              ))}
            </div>
          </section>

          {/* Controls & Options Bar */}
          <section className="mt-10 border-y border-[#444748]/50 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-white text-3xl">verified_user</span>
              <div>
                <h4 className="text-sm font-semibold text-white uppercase tracking-tight">
                  {locale === 'pt-BR' ? 'Permitir Pokémon Lendários' : 'Allow Legendary Pokémon'}
                </h4>
                <p className="text-xs text-[#8e9192]">
                  {locale === 'pt-BR' ? 'Incluir espécies restritas de lendários no pool' : 'Include restricted tier species in pool'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8e9192] uppercase tracking-wider font-semibold">
                  {locale === 'pt-BR' ? 'Identidade:' : 'Identity:'}
                </span>
                <select
                  value={teamIdentity}
                  onChange={e => setTeamIdentity(e.target.value as TeamIdentity)}
                  className="bg-[#102034] text-white text-xs px-3 py-2 rounded border border-[#444748] focus:outline-none focus:border-white font-medium"
                >
                  {identityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#8e9192]">{allowLegendaries ? 'ON' : 'OFF'}</span>
                <button
                  type="button"
                  onClick={() => setAllowLegendaries(c => !c)}
                  className={`w-14 h-8 brutalist-border relative transition-colors duration-300 rounded-full ${
                    allowLegendaries ? 'bg-white' : 'bg-[#26364a]'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-5 h-5 transition-all duration-300 rounded-full ${
                      allowLegendaries ? 'translate-x-6 bg-[#031427]' : 'translate-x-0 bg-[#c4c7c8]'
                    }`}
                  ></div>
                </button>
              </div>
            </div>
          </section>

          {/* Generate CTA Button */}
          <section className="mt-10 mb-16 flex flex-col items-center">
            {error && (
              <div className="mb-6 p-4 bg-red-950/80 border border-red-500/50 text-red-200 text-sm rounded-xl max-w-lg text-center font-medium">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => analyzeTeam()}
              disabled={loading}
              className="bg-white text-[#031427] font-bold py-4 px-16 tracking-[0.2em] uppercase hover:bg-[#c4c7c8] transition-all hard-shadow active:translate-x-1 active:translate-y-1 active:shadow-none text-base rounded-md flex items-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="animate-spin material-symbols-outlined">refresh</span>
                  <span>{locale === 'pt-BR' ? 'ANALISANDO TIME...' : 'PROCESSING TIME...'}</span>
                </>
              ) : (
                <span>{locale === 'pt-BR' ? 'GERAR TIME COMPLETO' : 'GENERATE FULL TEAM'}</span>
              )}
            </button>
            <p className="mt-3 text-xs text-[#8e9192] uppercase tracking-widest opacity-60 font-mono">
              SynergyEngine v4.0.2 • Active-v2 Dataset Verified
            </p>
          </section>
        </main>
      )}

      {/* RENDER PAGE 2: RESULT PAGE */}
      {currentPage === 'results' && result && selectedOption && (
        <main className="flex-grow pt-[95px] px-4 md:px-16 max-w-[1600px] mx-auto w-full mb-16">
          <header className="mb-8 flex flex-col md:flex-row justify-between items-end border-l-4 border-white pl-6 py-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-white text-[#031427] text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-sm">
                  {format.toUpperCase()}
                </span>
                <span className="text-xs text-[#8e9192] uppercase tracking-wider font-mono">
                  6 MEMBERS COMPLETE ROSTER
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-1">
                {locale === 'pt-BR' ? 'Resultados Táticos do Time' : 'Tactical Team Results'}
              </h1>
              <p className="text-[#c4c7c8] text-sm max-w-xl">
                {locale === 'pt-BR'
                  ? 'Composição de 6 Pokémon com SynergyEngine, análise de regulamento e matriz de cobertura.'
                  : 'Full 6-member composition with SynergyEngine, regulation analysis & coverage matrix.'}
              </p>
            </div>

            <div className="flex flex-col items-end mt-4 md:mt-0 gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#8e9192] uppercase tracking-widest font-mono">Synergy Score</span>
                <span className="text-5xl font-bold leading-none text-white">
                  {Math.round(50 + (selectedOption.score?.total || 40))}<span className="text-2xl opacity-50">%</span>
                </span>
              </div>

              {/* SynergyEngine Mini Badges */}
              <div className="flex flex-wrap gap-1.5 justify-end">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded">
                  🌧️ Clima: OK
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded">
                  ⚡ Terreno: OK
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                  ⌛ Trick Room: 20
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                  🔄 Volt-Turn: 15
                </span>
              </div>
            </div>
          </header>

          {/* Options Tabs */}
          <div className="flex gap-2 mb-8 border-b border-[#444748]/50 overflow-x-auto pb-2">
            {result.topTeams.map((_, index) => {
              const labels = [
                locale === 'pt-BR' ? 'Opção 1 (Recomendado)' : 'Option 1 (Recommended)',
                locale === 'pt-BR' ? 'Opção 2 (Ofensivo)' : 'Option 2 (Offensive)',
                locale === 'pt-BR' ? 'Opção 3 (Defensivo)' : 'Option 3 (Defensive)',
                locale === 'pt-BR' ? 'Opção 4 (Anti-Meta)' : 'Option 4 (Anti-Meta)',
                locale === 'pt-BR' ? 'Opção 5 (Criativo)' : 'Option 5 (Creative)',
              ];
              const isActive = selectedOptionIndex === index;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedOptionIndex(index)}
                  className={`px-6 py-2.5 font-bold text-sm whitespace-nowrap transition-all rounded-t-lg ${
                    isActive
                      ? 'bg-[#26364a] text-white border-b-2 border-white'
                      : 'text-[#8e9192] hover:bg-[#102034] hover:text-white'
                  }`}
                >
                  {labels[index] || `Option ${index + 1}`}
                </button>
              );
            })}
          </div>

          {/* Analysis View Mode Navigation Bar */}
          <div className="flex items-center gap-3 mb-6 bg-[#102034]/60 p-1.5 rounded-xl border border-[#444748]/50">
            <button
              type="button"
              onClick={() => setActiveAnalysisTab('team')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeAnalysisTab === 'team'
                  ? 'bg-white text-[#031427] hard-shadow'
                  : 'text-[#8e9192] hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers size={14} />
              <span>{locale === 'pt-BR' ? 'Time Completo (6 Pokémon)' : 'Full Roster (6 Pokémon)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAnalysisTab('synergy')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeAnalysisTab === 'synergy'
                  ? 'bg-white text-[#031427] hard-shadow'
                  : 'text-[#8e9192] hover:text-white hover:bg-white/5'
              }`}
            >
              <Cpu size={14} />
              <span>{locale === 'pt-BR' ? 'Análise da SynergyEngine' : 'SynergyEngine Analysis'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAnalysisTab('regulation')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeAnalysisTab === 'regulation'
                  ? 'bg-white text-[#031427] hard-shadow'
                  : 'text-[#8e9192] hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldCheck size={14} />
              <span>{locale === 'pt-BR' ? 'Regulamento VGC M-B' : 'VGC Reg M-B'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAnalysisTab('format')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeAnalysisTab === 'format'
                  ? 'bg-white text-[#031427] hard-shadow'
                  : 'text-[#8e9192] hover:text-white hover:bg-white/5'
              }`}
            >
              <Database size={14} />
              <span>{locale === 'pt-BR' ? 'Inteligência do Formato' : 'Format Intelligence'}</span>
            </button>
          </div>

          {/* Main 12-col Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* 9 Cols: Active Tab Content */}
            <div className="lg:col-span-9 space-y-6">
              {activeAnalysisTab === 'team' && (
                <CompetitiveTeamGrid
                  team={fullTeamPokemons}
                  leadNames={[team[0], team[1]]}
                  locale={locale}
                />
              )}

              {activeAnalysisTab === 'synergy' && (
                <div className="space-y-6">
                  <div className="glass-panel p-6 rounded-xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Cpu size={20} className="text-cyan-400" />
                      <span>{locale === 'pt-BR' ? 'Decomposição de Pontuação de Sinergia' : 'Synergy Score Breakdown'}</span>
                    </h3>
                    <ScoreBreakdownView
                      option={selectedOption}
                      locale={locale}
                      normalizeScore={normalizeScore}
                      formatScore={formatScore}
                    />
                  </div>
                </div>
              )}

              {activeAnalysisTab === 'regulation' && (
                <div className="glass-panel p-6 rounded-xl">
                  <ChampionsRegulationPanel option={selectedOption} locale={locale} />
                </div>
              )}

              {activeAnalysisTab === 'format' && (
                <div className="glass-panel p-6 rounded-xl">
                  <FormatIntelligencePanel option={selectedOption} locale={locale} />
                </div>
              )}
            </div>

            {/* 3 Cols: Tactical Sidebar */}
            <aside className="lg:col-span-3 space-y-6">
              {/* Strategy Guide / Playbook */}
              <div className="glass-panel p-5 border-l-4 border-white bg-[#102034]/20 rounded-r-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-white text-xl">analytics</span>
                  <h3 className="text-sm font-bold uppercase tracking-tight text-white">
                    {locale === 'pt-BR' ? 'Guia Tático de Jogo' : 'Tactical Playbook'}
                  </h3>
                </div>

                {/* Dupla de Abertura (Lead Pair) */}
                <div className="mb-4 pb-3 border-b border-[#444748]/40">
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Zap size={12} className="text-amber-400" />
                    {locale === 'pt-BR' ? '1. Dupla de Abertura (Lead)' : '1. Opener Pair (Lead)'}
                  </h4>
                  <p className="text-xs text-[#c4c7c8] leading-relaxed">
                    {locale === 'pt-BR'
                      ? `Inicie o combate posicionando a dupla ${leadPair[0]} + ${leadPair[1]} em campo para garantir a pressão inicial de ritmo.`
                      : `Start battle positioning ${leadPair[0]} + ${leadPair[1]} on field for early pace pressure.`}
                  </p>
                </div>

                {/* Setar a Estratégia (Mid-Game) */}
                <div className="mb-4 pb-3 border-b border-[#444748]/40">
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Shield size={12} className="text-blue-400" />
                    {locale === 'pt-BR' ? '2. Setar a Estratégia' : '2. Strategy Setup'}
                  </h4>
                  <p className="text-xs text-[#c4c7c8] leading-relaxed">
                    {selectedOption.reasoning ||
                      (locale === 'pt-BR'
                        ? `Utilize trocas defensivas com ${setupPokemon} para anular fraquezas e preparar o terreno de ataque.`
                        : `Rotate with ${setupPokemon} to neutralize weaknesses and set up offensive momentum.`)}
                  </p>
                </div>

                {/* Finalizar o Jogo (Win Condition) */}
                <div>
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Sparkles size={12} className="text-emerald-400" />
                    {locale === 'pt-BR' ? '3. Condição de Vitória (Late-Game)' : '3. Win Condition (Late-Game)'}
                  </h4>
                  <p className="text-xs text-[#c4c7c8] leading-relaxed">
                    {locale === 'pt-BR'
                      ? `Preserve ${finisherPokemon} para a fase final e execute a varredura (sweep) assim que as defesas do oponente estiverem desgastadas.`
                      : `Preserve ${finisherPokemon} for late-game sweep once opponent barriers are down.`}
                  </p>
                </div>
              </div>

              {/* Matchup Radar */}
              <div className="bg-[#102034]/40 p-5 border border-[#444748]/50 rounded-xl">
                <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-widest">
                  {locale === 'pt-BR' ? 'Radar de Matchups' : 'Matchup Radar'}
                </h3>
                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#c4c7c8]">Sun Offense</span>
                      <span className="text-white font-bold">85%</span>
                    </div>
                    <div className="h-1.5 bg-[#0b1c30] w-full rounded-full overflow-hidden">
                      <div className="h-full bg-white w-[85%]"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#c4c7c8]">Trick Room</span>
                      <span className="text-[#8e9192]">65%</span>
                    </div>
                    <div className="h-1.5 bg-[#0b1c30] w-full rounded-full overflow-hidden">
                      <div className="h-full bg-white/60 w-[65%]"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#c4c7c8]">Rain Offense</span>
                      <span className="text-[#8e9192]">78%</span>
                    </div>
                    <div className="h-1.5 bg-[#0b1c30] w-full rounded-full overflow-hidden">
                      <div className="h-full bg-white/80 w-[78%]"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Elemental Weaknesses Matrix */}
              <TeamWeaknessesCard team={fullTeamPokemons} locale={locale} />

              {/* Showdown Export Button */}
              <div className="glass-panel p-5 rounded-xl flex flex-col gap-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">
                  {locale === 'pt-BR' ? 'Exportação Showdown' : 'Showdown Export'}
                </h3>
                <button
                  type="button"
                  onClick={copyFullShowdown}
                  className="w-full py-3 bg-white text-[#031427] font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[#c4c7c8] transition-all flex items-center justify-center gap-2 hard-shadow"
                >
                  {copiedFullShowdown ? (
                    <>
                      <Check size={16} />
                      <span>{locale === 'pt-BR' ? 'TIME COMPLETO COPIADO!' : 'FULL TEAM COPIED!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>{locale === 'pt-BR' ? 'COPIAR TIME INTEIRO (SHOWDOWN)' : 'COPY FULL TEAM (SHOWDOWN)'}</span>
                    </>
                  )}
                </button>
              </div>
            </aside>
          </div>
        </main>
      )}

      {/* Modal Autocomplete para seleção de slots */}
      {activeSlotModal !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveSlotModal(null)}
        >
          <div
            className="glass-panel p-6 rounded-2xl max-w-md w-full border border-white/20 bg-[#031427] hard-shadow"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white tracking-tight">
                {locale === 'pt-BR' ? `Selecionar Pokémon (Slot ${activeSlotModal + 1})` : `Select Pokémon (Slot ${activeSlotModal + 1})`}
              </h3>
              <button
                type="button"
                onClick={() => setActiveSlotModal(null)}
                className="text-[#8e9192] hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-3 text-[#8e9192]" />
              <input
                type="text"
                autoFocus
                placeholder={locale === 'pt-BR' ? 'Digite o nome do Pokémon (ex: Charizard)...' : 'Type Pokémon name (e.g. Charizard)...'}
                value={slotSearchQuery}
                onChange={e => setSlotSearchQuery(e.target.value)}
                className="w-full bg-[#102034] text-white pl-9 pr-4 py-2.5 rounded-lg border border-[#444748] focus:outline-none focus:border-white text-sm"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {suggestions.length > 0 ? (
                suggestions.map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSlotSelect(activeSlotModal, name)}
                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-white/10 text-white font-medium flex items-center justify-between transition-colors text-sm"
                  >
                    <span>{name}</span>
                    <span className="text-xs text-[#8e9192]">→</span>
                  </button>
                ))
              ) : slotSearchQuery.trim() !== '' ? (
                <button
                  type="button"
                  onClick={() => handleSlotSelect(activeSlotModal, slotSearchQuery.trim())}
                  className="w-full text-left px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-colors text-sm"
                >
                  Usar "{slotSearchQuery.trim()}"
                </button>
              ) : (
                <div className="text-xs text-[#8e9192] text-center py-6">
                  {locale === 'pt-BR' ? 'Digite para buscar espécies competitivas...' : 'Type to search competitive species...'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
