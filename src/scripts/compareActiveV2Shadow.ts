import { runActiveV2ShadowCli } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowCli';

runActiveV2ShadowCli().then(code => {
  process.exitCode = code;
});
