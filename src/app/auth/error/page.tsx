interface AuthErrorPageProps {
  searchParams: Promise<{
    message?: string;
  }>;
}

const AuthErrorPage = async ({ searchParams }: AuthErrorPageProps) => {
  const params = await searchParams;
  const message = params.message || 'Authentication failed';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="w-full rounded-2xl border border-light-200 bg-light-secondary/50 p-6 dark:border-dark-200 dark:bg-dark-secondary/50">
        <h1 className="text-xl font-semibold text-black/90 dark:text-white/90">
          Auth error
        </h1>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">{message}</p>
        <a
          href="/auth/sign-in"
          className="mt-6 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black"
        >
          Back to sign-in
        </a>
      </div>
    </main>
  );
};

export default AuthErrorPage;

