import { applyActiveStagingTraceToTeamData } from '../equinox/competitive/active-staging/ActiveStagingTeamDataTracker';
import type { ActiveStagingEngineInput } from '../equinox/competitive/active-staging/ActiveStagingEngineAdapter';

const input: ActiveStagingEngineInput = {
  scenarioId: 'sinistcha-aggronmega',
  leadPokemon: ['Sinistcha', 'Aggron-Mega'],
  format: 'champions-reg-mb-doubles',
  competitiveVerificationState: 'staging-controlled',
  expectedActiveV2SetsResolvedFromMongo: ['a', 'b', 'c', 'd'],
  expectedActiveV2SetsPresentedToEngine: ['a', 'b'],
  presentedRecords: [],
  localPilotFallbackUsed: false,
};

const teamData = applyActiveStagingTraceToTeamData({ team: [] }, input);
if (teamData.competitiveVerificationState !== 'staging-controlled') throw new Error('state not applied');
if (teamData.expectedActiveV2SetsAppliedToTeamData.length !== 2) throw new Error('TeamData must trace the 2 applied sets');
if (teamData.localPilotFallbackUsed !== false) throw new Error('fallback flag must stay false');
console.log('active staging TeamData tracker ok');
