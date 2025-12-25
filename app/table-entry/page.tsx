'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TableEntry() {
  const [tableNumber, setTableNumber] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();


  useEffect(() => {
    const storedTable = localStorage.getItem('dineo_table_number');
    if (storedTable) {
      router.push('/menu');
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(tableNumber);

    if (!tableNumber || isNaN(num) || num < 1 || num > 100) {
      setError('Please enter a valid table number (1-100)');
      return;
    }

    localStorage.setItem('dineo_table_number', tableNumber);
    router.push('/menu');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4">
          D
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dineo</h1>
        <p className="text-muted-foreground">Welcome to The Golden Fork</p>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-sm rounded-3xl bg-card shadow-lg p-8 border border-border">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
          What's Your Table?
        </h2>
        <p className="text-center text-muted-foreground mb-6">
          Enter your table number to start ordering
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Field */}
          <div>
            <label htmlFor="table" className="block text-sm font-medium text-foreground mb-2">
              Table Number
            </label>
            <input
              id="table"
              type="number"
              min="1"
              max="100"
              placeholder="e.g., 12"
              value={tableNumber}
              onChange={(e) => {
                setTableNumber(e.target.value);
                setError('');
              }}
              className="w-full rounded-xl px-4 py-3 text-lg text-center bg-secondary text-foreground placeholder:text-muted-foreground border-2 border-transparent focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95 mt-6"
          >
            Start Ordering
          </button>
        </form>

        {/* Restaurant Info */}
        <div className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
          <p>Open Daily: 11 AM - 10 PM</p>
          <p className="mt-1">Tables: 1-100</p>
        </div>
      </div>
    </div>
  );
}
