import { route } from '@/router';

const tabs: { id: string; label: string; icon: string }[] = [
  { id: 'today', label: 'TODAY', icon: 'M4 5h16v14H4z M4 9h16 M8 3v4 M16 3v4' },
  { id: 'schedule', label: 'SCHEDULE', icon: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z' },
  { id: 'library', label: 'LIBRARY', icon: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M12 7v6 M12 13l-4 6 M12 13l4 6 M6 10l6-1 6 1' },
  { id: 'aar', label: 'AAR', icon: 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4' },
  { id: 'intel', label: 'INTEL', icon: 'M4 20h16 M6 16l4-5 4 3 5-7' },
];

export function TabBar() {
  const cur = route.value.parts[0] ?? 'today';
  return (
    <nav class="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <a key={t.id} href={`#/${t.id}`} class={cur === t.id ? 'on' : ''} aria-current={cur === t.id ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d={t.icon} />
          </svg>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
