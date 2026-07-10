'use client';

import { useEffect } from 'react';

// Catastrophic error boundary — catches failures in the ROOT layout itself, so
// it must render its own <html>/<body> and can't rely on the next-intl provider
// or the theme. Kept minimal and bilingual-safe as a true last resort.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0a0a0a',
          color: '#fafafa',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong · حدث خطأ ما</h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 24 }}>
            An unexpected error occurred. Please try again. · وقع خطأ غير متوقّع، حاول مرة أخرى.
          </p>
          <button
            onClick={reset}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              background: '#fafafa',
              color: '#0a0a0a',
              cursor: 'pointer',
            }}
          >
            Try again · أعِد المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
