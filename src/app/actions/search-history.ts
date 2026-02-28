'use server';

import { addSearchMessages, createSearchSession } from '@/lib/supabase/search-history';

export const createSearchSessionAction = async (
  title: string,
  preferredSessionId?: string,
) => {
  return createSearchSession(title, preferredSessionId);
};

export const addSearchMessageAction = async (
  sessionId: string,
  query: string,
  answer: string,
  sources: Record<string, unknown>[] = [],
  images: Record<string, unknown>[] = [],
  videos: Record<string, unknown>[] = [],
) => {
  return addSearchMessages(sessionId, query, answer, sources, images, videos);
};

