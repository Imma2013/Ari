import { createClient } from '@/lib/supabase/server';

export interface SaveSearchTurnInput {
  sessionId?: string;
  query: string;
  answer: string;
  sources?: unknown[];
  images?: unknown[];
  videos?: unknown[];
}

export interface SaveSearchTurnResult {
  saved: boolean;
  sessionId: string | null;
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export const createSearchSession = async (
  title: string,
  preferredSessionId?: string,
) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { saved: false, sessionId: null } satisfies SaveSearchTurnResult;
  }

  if (preferredSessionId && isUuid(preferredSessionId)) {
    const { data: existing } = await supabase
      .from('search_sessions')
      .select('id')
      .eq('id', preferredSessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing?.id) {
      return { saved: true, sessionId: existing.id } satisfies SaveSearchTurnResult;
    }

    const { data: createdWithId, error: createWithIdError } = await supabase
      .from('search_sessions')
      .insert({
        id: preferredSessionId,
        user_id: user.id,
        title: title.slice(0, 180),
      })
      .select('id')
      .single();

    if (!createWithIdError && createdWithId?.id) {
      return { saved: true, sessionId: createdWithId.id } satisfies SaveSearchTurnResult;
    }
  }

  const { data: created, error } = await supabase
    .from('search_sessions')
    .insert({
      user_id: user.id,
      title: title.slice(0, 180),
    })
    .select('id')
    .single();

  if (error || !created?.id) {
    console.error('Failed to create search session:', error?.message);
    return { saved: false, sessionId: null } satisfies SaveSearchTurnResult;
  }

  return { saved: true, sessionId: created.id } satisfies SaveSearchTurnResult;
};

export const addSearchMessages = async (
  sessionId: string,
  query: string,
  answer: string,
  sources: unknown[] = [],
  images: unknown[] = [],
  videos: unknown[] = [],
) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const payload = [
    {
      session_id: sessionId,
      user_id: user.id,
      role: 'user',
      content: query,
    },
    {
      session_id: sessionId,
      user_id: user.id,
      role: 'assistant',
      content: answer,
      sources,
      images,
      videos,
    },
  ];

  const { error } = await supabase.from('search_messages').insert(payload);
  if (error) {
    console.error('Failed to insert search messages:', error.message);
    return false;
  }

  return true;
};

export const saveSearchTurn = async (
  input: SaveSearchTurnInput,
): Promise<SaveSearchTurnResult> => {
  try {
    const session = await createSearchSession(input.query, input.sessionId);
    if (!session.sessionId) {
      return session;
    }

    const inserted = await addSearchMessages(
      session.sessionId,
      input.query,
      input.answer,
      input.sources || [],
      input.images || [],
      input.videos || [],
    );

    return {
      saved: inserted,
      sessionId: session.sessionId,
    };
  } catch (error) {
    console.error('saveSearchTurn failed:', error);
    return { saved: false, sessionId: null };
  }
};
