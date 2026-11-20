import type { ComponentType } from 'react';
import { ListMusicIcon, LogoIcon, MoonIcon, SettingsIcon, SparklesIcon, SunIcon, WaveIcon } from './components/icons';
import { AppStateProvider, useAppState, type ViewId } from './state/AppStateContext';
import { RecordsSettingsView } from './views/RecordsSettingsView';
import { RecommendView } from './views/RecommendView';
import { SongsView } from './views/SongsView';
import { VocalRangeView } from './views/VocalRangeView';

interface NavItem {
  id: ViewId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'recommend', label: '推薦', icon: SparklesIcon },
  { id: 'songs', label: '楽曲', icon: ListMusicIcon },
  { id: 'vocal', label: '音域', icon: WaveIcon },
  { id: 'records', label: '記録・設定', icon: SettingsIcon },
];

function AppShell() {
  const { activeView, setActiveView, resolvedTheme, setTheme } = useAppState();

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-app bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
              <LogoIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-extrabold leading-tight tracking-tight">UtaMemo</h1>
              <p className="text-[0.68rem] text-muted">歌いたい曲を、もっと身近に。</p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={resolvedTheme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            onClick={toggleTheme}
          >
            {resolvedTheme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* PC 向け上部ナビゲーション */}
        <nav className="hidden border-t border-app md:block" aria-label="メインナビゲーション">
          <div className="mx-auto flex max-w-3xl gap-2 px-4 py-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="nav-btn px-4 py-2"
                  data-active={activeView === item.id}
                  aria-current={activeView === item.id ? 'page' : undefined}
                  onClick={() => setActiveView(item.id)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 md:pb-12 md:pt-8">
        {activeView === 'recommend' && <RecommendView />}
        {activeView === 'songs' && <SongsView />}
        {activeView === 'vocal' && <VocalRangeView />}
        {activeView === 'records' && <RecordsSettingsView />}
      </main>

      {/* スマホ向けボトムナビゲーション */}
      <nav
        className="bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-app bg-surface md:hidden"
        aria-label="メインナビゲーション"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className="nav-btn flex-col gap-1 px-1 py-2.5"
                data-active={activeView === item.id}
                aria-current={activeView === item.id ? 'page' : undefined}
                onClick={() => setActiveView(item.id)}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[0.65rem] leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}
