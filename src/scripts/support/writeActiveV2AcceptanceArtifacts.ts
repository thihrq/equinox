import * as fs from 'fs';
import * as path from 'path';

export function writeArtifactAtomically(targetPath: string, content: string): void {
  const absolutePath = path.resolve(targetPath);
  const dir = path.dirname(absolutePath);

  // 1. Criar o diretório se não existir
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${absolutePath}.tmp`;

  try {
    // 2. Escrever no arquivo temporário
    fs.writeFileSync(tempPath, content, 'utf8');

    // 3. Renomear para o destino final
    fs.renameSync(tempPath, absolutePath);
  } catch (error) {
    // 4. Limpar o temporário em caso de falha
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (unlinkErr) {
        // Ignora erros de remoção secundários
      }
    }
    throw error;
  }
}
