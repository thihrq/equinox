export class CoachTemplates {
  public static byIdentity(identity: string): string {
    switch (identity) {
      case 'hyper_offense':
        return 'Equipe agressiva: jogue para criar pressão cedo e abrir caminho para finalizar no late game.';
      case 'bulky_offense':
        return 'Equipe bulky offense: alterne resistência e pressão para vencer por trocas favoráveis.';
      case 'stall':
        return 'Equipe defensiva: priorize preservação, controle de hazards e desgaste progressivo.';
      case 'speed':
        return 'Equipe focada em velocidade: mantenha o ritmo e force o adversário a responder.';
      case 'fun':
        return 'Equipe com identidade livre: use as peças sugeridas para manter variedade sem perder estrutura competitiva.';
      case 'balanced':
      default:
        return 'Equipe balanceada: busque estabilidade no início, pressão no meio da partida e uma condição clara de vitória no final.';
    }
  }
}
