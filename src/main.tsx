import { render } from 'preact';
import '@fontsource/black-ops-one/latin-400.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app';
import { registerSW } from 'virtual:pwa-register';
import { boot } from './lib/store';
import { route, navigate } from './router';
import { readActiveRun } from './lib/activeRun';

registerSW({ immediate: true });

render(<App />, document.getElementById('app')!);
void boot().then(() => {
  // iOS relaunches a killed PWA at the start URL: send it back to a timer that is still running.
  const run = readActiveRun();
  if (run && route.value.parts[0] !== 'session') navigate(run.path);
});

// Test/debug hook (no personal data; on-device only).
import { db } from './lib/db';
import { updateSettings, settings } from './lib/settings';
import { startBlock, reloadBlocks, reloadLogs, reloadStack, importStackSeed, setCurrentDay, completeDay, saveLog } from './lib/store';
import { applyImport } from './lib/exportImport';
(window as unknown as { __bops: unknown }).__bops = { db, updateSettings, settings, startBlock, reloadBlocks, reloadLogs, applyImport, reloadStack, importStackSeed, setCurrentDay, completeDay, saveLog };
