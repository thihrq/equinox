import { Threat } from './Threat';
import { MetaDatabase } from '../meta/MetaDatabase';

/**
 * ThreatDatabase
 *
 * Mantém compatibilidade com a Sprint 10, mas agora delega a escolha das
 * ameaças para o MetaDatabase. Assim, o ThreatEngine continua simples e o
 * conhecimento competitivo passa a ser controlado pela camada de Meta.
 */
export class ThreatDatabase {
  private readonly metaDatabase = new MetaDatabase();

  public getThreats(format: string): Threat[] {
    return this.metaDatabase.getFormat(format).threats;
  }
}
