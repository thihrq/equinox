import { Threat } from '../threats/Threat';

export type MetaFormatId =
  | 'vanilla'
  | 'radical_red'
  | 'national_dex'
  | 'champions_singles'
  | 'champions_ranked_singles'
  | 'champions_doubles'
  | 'champions_ranked_doubles'
  | 'champions_reg_m_b_singles'
  | 'champions_reg_m_b_doubles';

export interface MetaWeights {
  coverage: number;
  defense: number;
  roles: number;
  speed: number;
  threats: number;
}

export interface MetaFormat {
  id: MetaFormatId;
  name: string;
  description: string;
  threatProfileName: string;
  threats: Threat[];
  weights: MetaWeights;
  notes: string[];
}

export interface MetaAnalysis {
  id: MetaFormatId;
  name: string;
  description: string;
  threatProfileName: string;
  threatCount: number;
  weights: MetaWeights;
  notes: string[];
}
