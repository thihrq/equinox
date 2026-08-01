import mongoose, { Connection } from 'mongoose';
import { Pokemon } from '../../../models/Pokemon';
import { PokemonSet } from '../../../models/PokemonSet';

/**
 * Banco efêmero e exclusivo por execução de suíte.
 *
 * A suíte anterior conectava ao banco de desenvolvimento compartilhado e o
 * limpava com `Pokemon.deleteMany({})`. Isso não apenas apagava as fixtures de
 * outros testes — tornava o resultado dependente da ordem de execução, impedia
 * paralelismo e destruía qualquer baseline. Um E2E que rodasse depois falhava
 * por falta de dado, não por regressão, e a distinção entre os dois casos se
 * perdia.
 *
 * Cada suíte passa a criar o próprio banco, semear o que precisa e derrubá-lo
 * no fim. Nenhum teste depende de documento preexistente.
 */

const TEST_DATABASE_PREFIX = 'pokemon_teambuilder_test_';
const ALLOWED_HOSTS = ['localhost', '127.0.0.1'];

/**
 * Trava de segurança: `dropDatabase()` é irreversível, então o alvo é
 * verificado antes de qualquer destruição — nunca depois. Uma `MONGO_URI`
 * apontando para Atlas jamais pode ser derrubada por engano.
 */
export function assertSafeTestDatabase(connection: Connection): void {
  const host = connection.host;
  const name = connection.name;

  if (!ALLOWED_HOSTS.includes(host) || !name.startsWith(TEST_DATABASE_PREFIX)) {
    throw new Error(
      `UNSAFE_TEST_DATABASE_TARGET: host=${host}, database=${name}. ` +
        `Esperado host local e banco iniciado por "${TEST_DATABASE_PREFIX}".`,
    );
  }
}

export interface IsolatedTestDatabase {
  readonly connection: Connection;
  readonly databaseName: string;
  dispose(): Promise<void>;
}

/**
 * Conecta a um banco novo, nomeado por execução.
 *
 * A URI é construída aqui em vez de lida do ambiente: `MONGO_URI` pode apontar
 * para um cluster remoto, e nenhuma suíte de teste deve poder alcançá-lo.
 */
export async function connectIsolatedTestDatabase(): Promise<IsolatedTestDatabase> {
  const runId = `${process.pid}-${Date.now()}`;
  const databaseName = `${TEST_DATABASE_PREFIX}${runId}`;
  const uri = `mongodb://localhost:27017/${databaseName}`;

  await mongoose.connect(uri);
  const connection = mongoose.connection;

  assertSafeTestDatabase(connection);

  // Espera a construção de índices terminar antes de devolver o controle.
  //
  // Com `autoIndex` ligado (o padrão), o Mongoose dispara `createIndexes()` em
  // segundo plano ao registrar cada modelo, e criar um índice cria a coleção.
  // Numa suíte curta essa tarefa ainda estava pendente na hora do
  // `dropDatabase()` e recriava `pokemons`/`pokemonsets` logo depois — o banco
  // reaparecia vazio, já órfão. As suítes longas venciam a corrida por acaso,
  // o que tornava o sintoma intermitente por duração de teste.
  await Promise.all([Pokemon.init(), PokemonSet.init()]);

  let disposed = false;

  return {
    connection,
    databaseName,
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;

      assertSafeTestDatabase(connection);
      await connection.dropDatabase();
      await connection.close();
    },
  };
}

/**
 * Executa um corpo de teste com banco isolado, garantindo o descarte.
 *
 * O `finally` é o ponto central: um `process.exit()` ou um `throw` no corpo do
 * teste não pode deixar banco para trás, e é exatamente em falha que a limpeza
 * mais importa — uma suíte que só limpa quando passa acumula lixo justamente
 * durante a depuração.
 */
export async function runWithIsolatedDatabase(
  body: (database: IsolatedTestDatabase) => Promise<void>,
): Promise<void> {
  const database = await connectIsolatedTestDatabase();
  try {
    await body(database);
  } finally {
    await database.dispose();
  }
}
