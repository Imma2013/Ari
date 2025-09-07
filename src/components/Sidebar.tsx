'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import React, { useState, type ReactNode } from 'react';
import Layout from './Layout';
import { useTranslation } from '@/hooks/useTranslation';

// Heroicons (outline) - modern, clean icons
import {
  HomeIcon,
  MagnifyingGlassIcon,
  BookOpenIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';


const VerticalIconContainer = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-col items-center gap-y-3 w-full">{children}</div>
  );
};

const Sidebar = ({ children }: { children: ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const { t } = useTranslation();

  const navLinks = [
    {
      icon: HomeIcon,
      href: '/',
      active: segments.length === 0 || segments.includes('c'),
      label: t('navigation.home'),
    },
    {
      icon: MagnifyingGlassIcon,
      href: '/discover',
      active: segments.includes('discover'),
      label: t('navigation.discover'),
    },
    {
      icon: BookOpenIcon,
      href: '/library',
      active: segments.includes('library'),
      label: t('navigation.library'),
    },
  ];

  return (
    <div>
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-20 lg:flex-col" role="navigation" aria-label="Primary sidebar">
        <div className="flex grow flex-col items-center justify-between gap-y-5 overflow-y-auto bg-light-secondary dark:bg-dark-secondary px-2 py-8">
          <a href="/" aria-label="Open Perplexify home" title="Perplexify home" className="p-2.5 rounded-lg focus:outline-none">
            <BookOpenIcon className="h-7 w-7" aria-hidden="true" />
          </a>
          <VerticalIconContainer>
            {navLinks.map((link, i) => (
              <Link
                key={i}
                href={link.href}
                title={link.label}
                aria-current={link.active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center justify-center cursor-pointer duration-150 transition w-full p-2.5 rounded-lg',
                  link.active
                    ? 'text-black dark:text-white'
                    : 'text-black/70 dark:text-white/70',
                )}
              >
              <link.icon className="h-5 w-5" aria-hidden="true" />
                {link.active && (
                  <div className="absolute right-0 -mr-2 h-full w-1 rounded-l-lg bg-black dark:bg-white" />
                )}
              </Link>
            ))}
          </VerticalIconContainer>

          <div className="flex flex-col items-center gap-y-3">
            <Link href="/settings" title={t('navigation.settings')} className="p-2.5 rounded-lg">
              <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 w-full z-50 flex flex-row items-center gap-x-6 bg-light-primary dark:bg-dark-primary px-4 py-4 shadow-sm lg:hidden" role="navigation" aria-label="Mobile primary navigation">
        {navLinks.map((link, i) => (
          <Link
            href={link.href}
            key={i}
            title={link.label}
            aria-current={link.active ? 'page' : undefined}
            className={cn(
              'relative flex flex-col items-center space-y-1 text-center w-full p-2.5',
              link.active
                ? 'text-black dark:text-white'
                : 'text-black dark:text-white/70',
            )}
          >
            {link.active && (
              <div className="absolute top-0 -mt-4 h-1 w-full rounded-b-lg bg-black dark:bg-white" />
            )}
            <link.icon className="h-5 w-5" aria-hidden="true" />
            <p className="text-xs">{link.label}</p>
          </Link>
        ))}
      </div>

      <Layout>{children}</Layout>
    </div>
  );
};

export default Sidebar;
