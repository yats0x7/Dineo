'use client';

import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4">
          D
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dineo</h1>
        <p className="text-muted-foreground">The Golden Fork - Fast & Delicious</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl bg-card shadow-lg p-8 border border-border text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">Welcome!</h2>
        <p className="text-muted-foreground mb-6">
          Order from our menu, track your order status, and enjoy delicious food in real-time.
        </p>

        <button
          onClick={() => router.push('/table-entry')}
          className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
        >
          Start Ordering
        </button>
      </div>
    </div>
  );
}
