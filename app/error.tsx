"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ui] route render failed", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="min-h-[70vh] bg-paper px-6 py-24 text-ink">
      <div className="panel mx-auto max-w-lg p-8 text-center">
        <p className="eyebrow">// temporary error</p>
        <h1 className="mt-3 font-display text-3xl font-bold">This page could not be loaded.</h1>
        <p className="mt-4 text-sm leading-6 text-ink-muted">
          Your account and work are safe. Try the request again, or return to the homepage.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <a href="/" className="btn btn-secondary">
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
