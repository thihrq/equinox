import { Router } from 'express';
import { TeamController } from './controllers/TeamController';
import { SystemController } from './controllers/SystemController';

const routes = Router();

routes.get('/health', SystemController.health);
routes.get('/ready', SystemController.readiness);
routes.get('/api/system/status', SystemController.status);
routes.get('/system/status', SystemController.status);
routes.get('/api/system/data-packs', SystemController.dataPacks);
routes.get('/system/data-packs', SystemController.dataPacks);
routes.get('/api/system/format-scope', SystemController.formatScope);
routes.get('/system/format-scope', SystemController.formatScope);
routes.get('/api/system/release', SystemController.release);
routes.get('/system/release', SystemController.release);

// Canonical API route.
routes.post('/api/team/suggest', TeamController.suggest);
routes.post('/api/team/suggest-from-lead', TeamController.suggestFromLead);

// Compatibility aliases for local envs where VITE_API_BASE_URL may already include /api
// or older builds still post to the pre-hardening route.
routes.post('/team/suggest', TeamController.suggest);
routes.post('/team/suggest-from-lead', TeamController.suggestFromLead);
routes.post('/api/api/team/suggest', TeamController.suggest);
routes.post('/api/api/team/suggest-from-lead', TeamController.suggestFromLead);

export default routes;
