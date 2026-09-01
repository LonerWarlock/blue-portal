"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f7f5ef] px-6 py-24 text-[#172033]">
        <main className="mx-auto max-w-lg rounded-lg border border-[#d9dde7] bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#2c6f9e]">Blue AI</p>
          <h1 className="mt-3 text-3xl font-bold">Something went wrong.</h1>
          <p className="mt-4 text-sm leading-6 text-[#667085]">
            The service encountered a temporary error. Please retry this page.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-7 rounded-md bg-[#2c6f9e] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
