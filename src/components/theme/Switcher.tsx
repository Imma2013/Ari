'use client';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

type Theme = 'dark' | 'light' | 'system';

const ThemeSwitcher = ({ className }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);

  const { theme, setTheme } = useTheme();

  const isTheme = useCallback((t: Theme) => t === theme, [theme]);

  const handleThemeSwitch = (theme: Theme) => {
    setTheme(theme);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isTheme('system')) {
      const preferDarkScheme = window.matchMedia(
        '(prefers-color-scheme: dark)',
      );

      const detectThemeChange = (event: MediaQueryListEvent) => {
        const theme: Theme = event.matches ? 'dark' : 'light';
        setTheme(theme);
      };

      preferDarkScheme.addEventListener('change', detectThemeChange);

      return () => {
        preferDarkScheme.removeEventListener('change', detectThemeChange);
      };
    }
  }, [isTheme, setTheme, theme]);

  // Avoid Hydration Mismatch
  if (!mounted) {
    return null;
  }

  return (
    <Select value={theme} onValueChange={(value) => handleThemeSwitch(value as Theme)}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
      </SelectContent>
    </Select>
  );
};

export default ThemeSwitcher;
