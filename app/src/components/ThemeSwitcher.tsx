import React, { useState, useEffect } from 'react';
import { Palette, Check, Sparkles, Sun, Flame, Zap, Compass } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export type ThemeId =
  | 'theme-cyber-dark'
  | 'theme-neon-violet'
  | 'theme-emerald-matrix'
  | 'theme-sapphire-blue'
  | 'theme-pure-light';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  icon: React.ReactNode;
  previewGradient: string;
  accentColor: string;
  isLight?: boolean;
}

export const THEMES: ThemeOption[] = [
  {
    id: 'theme-cyber-dark',
    name: 'Cyber Horizon',
    description: 'Sleek dark obsidian with fiery amber & sunset glow',
    icon: <Flame className="w-4 h-4 text-orange-400" />,
    previewGradient: 'linear-gradient(135deg, #ef4444, #f97316, #eab308)',
    accentColor: '#f97316',
  },
  {
    id: 'theme-neon-violet',
    name: 'Neon Cyber-Glass',
    description: 'Cosmic deep violet with electric purple & cyan neon',
    icon: <Zap className="w-4 h-4 text-fuchsia-400" />,
    previewGradient: 'linear-gradient(135deg, #a855f7, #ec4899, #06b6d4)',
    accentColor: '#a855f7',
  },
  {
    id: 'theme-emerald-matrix',
    name: 'Emerald Matrix',
    description: 'High-tech dark slate with glowing mint & emerald accents',
    icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
    previewGradient: 'linear-gradient(135deg, #10b981, #059669, #14b8a6)',
    accentColor: '#10b981',
  },
  {
    id: 'theme-sapphire-blue',
    name: 'Sapphire Midnight',
    description: 'Deep royal navy with vibrant electric blue & sky glow',
    icon: <Compass className="w-4 h-4 text-sky-400" />,
    previewGradient: 'linear-gradient(135deg, #3b82f6, #0ea5e9, #6366f1)',
    accentColor: '#3b82f6',
  },
  {
    id: 'theme-pure-light',
    name: 'Luxe Light Frost',
    description: 'Crisp pearl frost with vibrant indigo gradients',
    icon: <Sun className="w-4 h-4 text-amber-500" />,
    previewGradient: 'linear-gradient(135deg, #6366f1, #8b5cf6, #3b82f6)',
    accentColor: '#6366f1',
    isLight: true,
  },
];

export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('next_videos_theme') as ThemeId;
    if (saved && THEMES.some(t => t.id === saved)) return saved;
    return 'theme-cyber-dark';
  });

  const applyTheme = (themeId: ThemeId) => {
    THEMES.forEach(t => {
      document.body.classList.remove(t.id);
      document.documentElement.classList.remove(t.id);
    });

    document.body.classList.add(themeId);
    document.documentElement.classList.add(themeId);

    const themeObj = THEMES.find(t => t.id === themeId);
    if (themeObj?.isLight) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }

    localStorage.setItem('next_videos_theme', themeId);
    setCurrentTheme(themeId);
  };

  useEffect(() => {
    applyTheme(currentTheme);
  }, []);

  return { currentTheme, applyTheme };
}

export const ThemeSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { currentTheme, applyTheme } = useTheme();
  const activeTheme = THEMES.find(t => t.id === currentTheme) || THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          className="relative gap-2 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl backdrop-blur-md transition-all shadow-sm group"
          title="Switch Theme"
        >
          <div
            className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20 transition-transform group-hover:scale-110 shadow-sm"
            style={{ background: activeTheme.previewGradient }}
          />
          {!compact && (
            <span className="hidden md:inline-flex text-xs font-medium text-gray-200">
              {activeTheme.name}
            </span>
          )}
          <Palette className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 bg-slate-900/95 border-white/10 backdrop-blur-2xl text-white shadow-2xl p-2 rounded-2xl animate-in fade-in-50 zoom-in-95"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
          <span>Theme Styles</span>
          <Sparkles className="w-3 h-3 text-orange-400" />
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10 my-1" />

        <div className="space-y-1">
          {THEMES.map(theme => {
            const isSelected = theme.id === currentTheme;
            return (
              <DropdownMenuItem
                key={theme.id}
                onClick={() => applyTheme(theme.id)}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-white/15 text-white font-medium shadow-sm'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-4 h-4 rounded-full shadow-inner flex-shrink-0"
                    style={{ background: theme.previewGradient }}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs leading-none">{theme.name}</span>
                    <span className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">
                      {theme.description}
                    </span>
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
