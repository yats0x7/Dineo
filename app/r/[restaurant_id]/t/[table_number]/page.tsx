'use client';

import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function QRRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    const restaurantId = params.restaurant_id as string;
    const tableNumber = params.table_number as string;

    if (restaurantId && tableNumber) {
      // Store to localStorage for persistence
      localStorage.setItem('dineo_restaurant_id', restaurantId);
      localStorage.setItem('dineo_table_number', tableNumber);
      
      // Redirect with query params so menu page can read them directly
      router.replace(`/menu?restaurant_id=${restaurantId}&table=${tableNumber}`);
    } else {
      router.replace('/table-entry');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}
