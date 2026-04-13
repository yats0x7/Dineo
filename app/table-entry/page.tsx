'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

function TableEntryContent() {
  const [tableNumber, setTableNumber] = useState('');
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [restaurantName, setRestaurantName] = useState('Dineo');
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRedirected = useRef(false);

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase.from('restaurant_settings').select('restaurant_id, logo_url, restaurant_name').limit(1).single();
      if (data) {
        if (data.logo_url) setLogoUrl(data.logo_url);
        if (data.restaurant_name) setRestaurantName(data.restaurant_name);
        if (data.restaurant_id) setRestaurantId(data.restaurant_id);
      }
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    if (hasRedirected.current) return;

    // Only redirect if we have a restaurant_id stored (or can store one)
    const storedRestId = localStorage.getItem('dineo_restaurant_id');

    const tableParam = searchParams.get('table');
    if (tableParam && storedRestId) {
      hasRedirected.current = true;
      setTableNumber(tableParam);
      localStorage.setItem('dineo_table_number', tableParam);
      router.push('/menu');
      return;
    }

    const storedTable = localStorage.getItem('dineo_table_number');
    if (storedTable && storedRestId) {
      hasRedirected.current = true;
      router.push('/menu');
    }
  }, [searchParams, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(tableNumber);

    if (!tableNumber || isNaN(num) || num < 1 || num > 100) {
      setError('Please enter a valid table number (1-100)');
      return;
    }

    if (!restaurantId) {
      setError('Unable to find restaurant. Please try again.');
      return;
    }

    localStorage.setItem('dineo_table_number', tableNumber);
    localStorage.setItem('dineo_restaurant_id', restaurantId);
    router.push('/menu');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center flex flex-col items-center">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="mb-4 h-24 w-auto object-contain" />
        ) : (
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4">
            {restaurantName.charAt(0)}
          </div>
        )}
        <h1 className="text-3xl font-bold text-foreground mb-2">{restaurantName}</h1>
        <p className="text-muted-foreground">Welcome to {restaurantName}</p>
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

export default function TableEntry() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary flex items-center justify-center p-4">Loading...</div>}>
      <TableEntryContent />
    </Suspense>
  )
}
