'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check for active order first - highest priority
    const activeOrder = localStorage.getItem('dineo_active_order');
    if (activeOrder && activeOrder !== 'null') {
      router.push('/order-status');
      return;
    }

    // Then check for table number
    const tableNumber = localStorage.getItem('dineo_table_number');
    if (tableNumber) {
      router.push('/menu');
    } else {
      router.push('/table-entry');
    }
  }, []);

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
          Redirecting you to the right place...
        </p>
        <div className="flex justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
