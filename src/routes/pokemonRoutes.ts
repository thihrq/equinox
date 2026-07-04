import { Router } from 'express';
import { PokemonController } from '../controllers/PokemonController';
import { TeamController } from '../controllers/TeamController';

const router = Router();

// --- Rotas de Consulta ---
router.get('/pokemons/:name', PokemonController.show);

// --- Rotas de Equipe ---
// Analisa as fraquezas de um time enviado
router.post('/team/analyze', TeamController.analyze);

// Sugere complementos baseados nas fraquezas do time
router.post('/team/suggest', TeamController.suggest);

export default router;