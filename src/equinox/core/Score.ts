// TODO: Implementar a classe/módulo Score.ts
export interface ScoreBreakdown {
  coverage: number;
  defense: number;
  offense: number;
  roles: number;
  speed: number;
  meta: number;
  threats: number;
  cores: number;
  total: number;
}

export function createEmptyScore(): ScoreBreakdown {
  return {
    coverage: 0,
    defense: 0,
    offense: 0,
    roles: 0,
    speed: 0,
    meta: 0,
    threats: 0,
    cores: 0,
    total: 0,
  };
}