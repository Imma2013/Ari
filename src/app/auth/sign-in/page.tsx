import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

const SignInPage = async () => {
  const signInWithGoogle = async () => {
    'use server';

    const supabase = await createClient();
    const headerStore = await headers();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || headerStore.get('origin') || '';

    if (!origin) {
      redirect('/auth/error?message=Missing site origin');
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });

    if (error || !data.url) {
      const message = error?.message || 'Unable to start Google sign-in';
      redirect(`/auth/error?message=${encodeURIComponent(message)}`);
    }

    redirect(data.url);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="w-full rounded-2xl border border-light-200 bg-light-secondary/50 p-6 dark:border-dark-200 dark:bg-dark-secondary/50">
        <h1 className="text-xl font-semibold text-black/90 dark:text-white/90">
          Sign in to Ari
        </h1>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          Continue with Google to sync your searches and history.
        </p>
        <form action={signInWithGoogle} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
};

export default SignInPage;

