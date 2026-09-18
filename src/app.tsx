import { route } from '@/router';
import { TabBar } from '@/components/TabBar';
import { Today } from '@/screens/Today';
import { Schedule } from '@/screens/Schedule';
import { Library } from '@/screens/Library';
import { AAR } from '@/screens/AAR';
import { Intel } from '@/screens/Intel';
import { Kit } from '@/screens/Kit';
import { Stack } from '@/screens/Stack';
import { DevPoses } from '@/screens/DevPoses';
import { Session } from '@/screens/Session';
import { FlashOverlay } from '@/components/Flash';
import { booted } from '@/lib/store';

export function App() {
  const r = route.value;
  const top = r.parts[0] ?? 'today';
  let screen;
  let tabs = true;
  switch (top) {
    case 'schedule': screen = <Schedule />; break;
    case 'library': screen = <Library />; break;
    case 'aar': screen = <AAR />; break;
    case 'intel': screen = <Intel />; break;
    case 'kit': screen = <Kit />; break;
    case 'stack': screen = <Stack />; break;
    case 'dev': screen = <DevPoses />; tabs = false; break;
    case 'session': screen = <Session key={r.path + '?' + r.query.toString()} />; tabs = false; break;
    case 'today':
    default: screen = <Today />;
  }
  if (!booted.value) return <main class="screen" aria-busy="true"><div class="wordmark">BOUNDLESS <span class="accent">OPS</span></div></main>;
  return (
    <>
      <FlashOverlay />
      {screen}
      {tabs && <TabBar />}
    </>
  );
}
