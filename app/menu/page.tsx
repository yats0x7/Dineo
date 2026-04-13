'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Plus, Minus, X, Search, Check, ChefHat, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { OTPLoginModal } from '../../components/OTPLoginModal';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isVeg: boolean;
  vegType: 'veg' | 'non_veg' | 'egg';
  taxRate: number;
  isSoldOut: boolean;
  offer?: {
    discount_type: 'percent' | 'flat';
    discount_value: number;
  };
}

interface CartItem extends MenuItem {
  quantity: number;
}

const CATEGORIES = ['All', 'Starters', 'Main Course', 'Beverages', 'Desserts'];

// Helper function to safely format prices
const safePrice = (price: number | null | undefined): number => {
  const parsed = Number(price);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
};

// Helper function to format Indian currency
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
    minimumFractionDigits: price % 1 === 0 ? 0 : 2
  }).format(price);
};

export default function MenuPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurantName, setRestaurantName] = useState('The Golden Fork');
  const [logoUrl, setLogoUrl] = useState('');
  const [gstEnabled, setGstEnabled] = useState(true);
  const [servicePercent, setServicePercent] = useState(0);
  const [activeBillOffer, setActiveBillOffer] = useState<{ discount_type: 'percent' | 'flat', discount_value: number, min_order_value: number } | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [pendingCashOrder, setPendingCashOrder] = useState(false);
  
  // Active Orders Tracking
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [showOrderTracker, setShowOrderTracker] = useState(false);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const hasRedirected = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check localStorage for persisted OTP verification (survives refresh)
  const checkPersistedVerification = (): boolean => {
    try {
      const stored = localStorage.getItem('dineo_verified_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        const elapsed = Date.now() - (parsed.timestamp || 0);
        const FOUR_HOURS = 4 * 60 * 60 * 1000;
        if (elapsed < FOUR_HOURS) {
          setIsAuthenticated(true);
          if (parsed.phone) setUserPhone(parsed.phone);
          return true;
        } else {
          // Expired — clear stale verification
          localStorage.removeItem('dineo_verified_user');
        }
      }
    } catch {
      // Corrupted data — clear it
      localStorage.removeItem('dineo_verified_user');
    }
    return false;
  };

  const checkAuthStatus = async () => {
    // First check localStorage (instant, survives refresh)
    if (checkPersistedVerification()) return;

    // Fallback: Check Supabase auth session
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setIsAuthenticated(true);
      if (user.phone) setUserPhone(user.phone);
      // Persist this session too
      localStorage.setItem('dineo_verified_user', JSON.stringify({
        verified: true,
        phone: user.phone || null,
        userId: user.id,
        timestamp: Date.now()
      }));
    }
  };

  const fetchMenu = async (restId: string) => {
    try {
      // Fetch restaurant settings (try restaurant_id first, fall back to owner_id lookup)
      let settingsData = null;
      const { data: directSettings } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('restaurant_id', restId)
        .limit(1)
        .single();
      
      if (directSettings) {
        settingsData = directSettings;
      } else {
        // Fallback: lookup via owner_id for legacy settings rows
        const { data: restaurant } = await supabase.from('restaurants').select('owner_id').eq('id', restId).single();
        if (restaurant?.owner_id) {
          const { data: fallbackSettings } = await supabase
            .from('restaurant_settings')
            .select('*')
            .eq('owner_id', restaurant.owner_id)
            .limit(1)
            .single();
          settingsData = fallbackSettings;
        }
      }

      if (settingsData) {
        if (settingsData.restaurant_name) setRestaurantName(settingsData.restaurant_name);
        if (settingsData.logo_url) setLogoUrl(settingsData.logo_url);
        setGstEnabled(settingsData.gst_enabled ?? true);
        setServicePercent(settingsData.service_charge_percent ?? 0);
      }

      // Fetch active bill offer
      try {
        const { data: billOfferData } = await supabase
          .from('bill_offers')
          .select('*')
          .eq('restaurant_id', restId)
          .eq('active', true)
          .gte('end_date', new Date().toISOString())
          .lte('start_date', new Date().toISOString())
          .limit(1)
          .single();
        if (billOfferData) {
          setActiveBillOffer(billOfferData);
        }
      } catch (e) {
        // No active bill offer
      }

      // Fetch menu items with active offers
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          item_offers!inner (
            discount_type,
            discount_value,
            active,
            start_date,
            end_date
          )
        `)
        .eq('restaurant_id', restId);

      // Also fetch items without offers
      const { data: itemsWithoutOffers, error: noOffersError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restId);

      if (error && noOffersError) throw error || noOffersError;

      // Merge results
      const allItems = itemsWithoutOffers || [];
      const itemsWithActiveOffers = data || [];

      const now = new Date();

      const mappedItems: MenuItem[] = allItems.map((item) => {
        // Find active offer for this item
        const itemWithOffer = itemsWithActiveOffers.find(i => i.id === item.id);

        let offer = undefined;
        if (itemWithOffer && itemWithOffer.item_offers) {
          const offerData = Array.isArray(itemWithOffer.item_offers)
            ? itemWithOffer.item_offers[0]
            : itemWithOffer.item_offers;

          // Check if offer is active and within date range
          if (offerData?.active) {
            const startDate = new Date(offerData.start_date);
            const endDate = new Date(offerData.end_date);

            if (now >= startDate && now <= endDate) {
              offer = {
                discount_type: offerData.discount_type,
                discount_value: offerData.discount_value
              };
            }
          }
        }

        return {
          id: item.id,
          name: item.name || 'Unnamed Item',
          description: item.description || '',
          price: safePrice(item.price),
          image: item.image_url,
          category: item.category || 'Other',
          isVeg: item.is_veg ?? true,
          vegType: item.veg_type || (item.is_veg ? 'veg' : 'non_veg'),
          taxRate: item.tax_rate ?? 5,
          isSoldOut: item.is_sold_out ?? false,
          offer
        };
      });

      setMenuItems(mappedItems);
    } catch (error) {
      console.error('Error fetching menu:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const fetchActiveOrders = async (rId: string, tNum: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          short_id,
          status,
          total_amount,
          created_at,
          order_items (
            item_name,
            quantity,
            unit_price
          )
        `)
        .eq('restaurant_id', rId)
        .eq('table_number', tNum)
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActiveOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch active orders:', err);
    }
  };

  useEffect(() => {
    // 1. Check URL query params first (handles /menu?restaurant_id=X&table=Y)
    const urlParams = new URLSearchParams(window.location.search);
    const urlRestId = urlParams.get('restaurant_id');
    const urlTable = urlParams.get('table');

    if (urlRestId && urlTable) {
      // Store from URL params and proceed directly (skip table-entry)
      localStorage.setItem('dineo_restaurant_id', urlRestId);
      localStorage.setItem('dineo_table_number', urlTable);
    }

    // 2. Load state from localStorage (may have just been set above)
    const storedTable = localStorage.getItem('dineo_table_number');
    const storedRestId = localStorage.getItem('dineo_restaurant_id');
    const storedCart = localStorage.getItem('dineo_cart');

    if (!storedTable || !storedRestId) {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        routerRef.current.push('/table-entry');
      }
      return;
    }

    setTableNumber(storedTable);
    setRestaurantId(storedRestId);

    if (storedCart) {
      try {
        setCart(JSON.parse(storedCart));
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }

    fetchMenu(storedRestId);
    checkAuthStatus();
    
    // Initial fetch for persistent active orders
    fetchActiveOrders(storedRestId, storedTable);

    // Set up realtime subscription for menu_items (sold out toggle)
    const menuChannel = supabase
      .channel('menu_items_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${storedRestId}` },
        (payload) => {
          setMenuItems((prev) =>
            prev.map((item) => {
              if (item.id === payload.new.id) {
                return {
                  ...item,
                  isSoldOut: payload.new.is_sold_out ?? item.isSoldOut,
                };
              }
              return item;
            })
          );
        }
      )
      .subscribe();

    // Set up realtime subscription for active orders tracked by customer
    const ordersChannel = supabase
      .channel(`customer_active_orders_${storedRestId}_${storedTable}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${storedRestId}` },
        (payload) => {
          console.log('🔄 Realtime order event:', payload.eventType, (payload.new as any)?.id);
          // Refetch our table's active orders on any order change in the restaurant
          fetchActiveOrders(storedRestId, storedTable);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Orders realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Orders realtime subscription failed, relying on polling fallback');
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Orders realtime subscription timed out, relying on polling fallback');
        }
      });

    // Polling fallback — ensures updates even if realtime silently fails
    const orderPollingInterval = setInterval(() => {
      fetchActiveOrders(storedRestId, storedTable);
    }, 10000); // Every 10 seconds

    // Reconnect handler — refetch immediately when network is restored
    const handleNetworkRestore = () => {
      console.log('🔄 Network restored, refreshing active orders...');
      fetchActiveOrders(storedRestId, storedTable);
    };
    window.addEventListener('online', handleNetworkRestore);

    return () => {
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(ordersChannel);
      clearInterval(orderPollingInterval);
      window.removeEventListener('online', handleNetworkRestore);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('dineo_cart', JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  const resetSession = () => {
    if (confirm('Are you sure you want to end your session? This will clear your cart and table data.')) {
      localStorage.removeItem('dineo_table_number');
      localStorage.removeItem('dineo_restaurant_id');
      localStorage.removeItem('dineo_cart');
      localStorage.removeItem('dineo_active_order');
      localStorage.removeItem('dineo_verified_user');
      router.push('/');
    }
  };

  const filteredMenu = menuItems
    .filter((item) =>
      selectedCategory === 'All' ? true : item.category === selectedCategory
    )
    .filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const addToCart = (item: MenuItem) => {
    if (item.isSoldOut) return; // Prevent adding sold out items

    const existingItem = cart.find((cartItem) => cartItem.id === item.id);
    if (existingItem) {
      setCart(
        cart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter((item) => item.id !== id));
    } else {
      setCart(
        cart.map((item) =>
          item.id === id ? { ...item, quantity } : item
        )
      );
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate total with item discounts applied
  const itemsWithDiscounts = cart.map(item => {
    if (item.offer) {
      const discount = item.offer.discount_type === 'percent'
        ? (item.price * item.offer.discount_value) / 100
        : item.offer.discount_value;
      const discountedPrice = Math.max(0, item.price - discount);
      return { ...item, discountedPrice, itemDiscount: discount };
    }
    return { ...item, discountedPrice: item.price, itemDiscount: 0 };
  });

  // Subtotal after item discounts
  const subtotal = itemsWithDiscounts.reduce((sum, item) => sum + item.discountedPrice * item.quantity, 0);

  // Exact Tax & Service Charge sync
  let taxTotal = 0;
  itemsWithDiscounts.forEach((item) => {
    const itemTax = gstEnabled ? (item.discountedPrice * item.quantity * (item.taxRate || 0) / 100) : 0;
    taxTotal += itemTax;
  });

  let billDiscountAmount = 0;
  if (activeBillOffer && subtotal >= activeBillOffer.min_order_value) {
    billDiscountAmount = activeBillOffer.discount_type === 'percent'
      ? (subtotal * activeBillOffer.discount_value) / 100
      : activeBillOffer.discount_value;
  }

  const afterDiscount = subtotal - billDiscountAmount;
  const serviceChargeAmount = gstEnabled ? (afterDiscount * servicePercent / 100) : 0;
  const finalTotalAmount = afterDiscount + taxTotal + serviceChargeAmount;

  const handleOTPSuccess = async (userId: string) => {
    setShowOTPModal(false);
    setIsAuthenticated(true);

    // Persist verification to localStorage (survives refresh, 4hr TTL)
    const { data: { user } } = await supabase.auth.getUser();
    const phone = user?.phone || null;
    if (phone) setUserPhone(phone);
    localStorage.setItem('dineo_verified_user', JSON.stringify({
      verified: true,
      phone,
      userId,
      timestamp: Date.now()
    }));
    
    if (pendingCashOrder) {
      setPendingCashOrder(false);
      // Re-open review modal so user can see their order, then place it
      setShowReviewModal(true);
      // Small delay to let modal render, then place order
      setTimeout(() => placeOrder('cash', 'unpaid'), 100);
    } else {
      setShowReviewModal(true);
    }
  };

  const handlePlaceOrderClick = async () => {
    setShowReviewModal(true); // Always proceed to review modal directly
  };

  const placeOrder = async (paymentMethod: 'online' | 'cash', paymentStatus: 'paid' | 'unpaid') => {
    if (!tableNumber) return;
    setIsPlacingOrder(true);

    try {
      // 1. Ensure user is authenticated or guest
      const { data: { user } } = await supabase.auth.getUser();

      if (!user && !isGuestMode) {
        throw new Error('Please login to place order');
      }

      // 2. Fetch restaurant settings
      const { data: settingsData } = await supabase
        .from('restaurant_settings')
        .select('gst_enabled, gst_percent, service_charge_percent, tax_enabled, invoice_prefix, currency_symbol')
        .eq('restaurant_id', restaurantId)
        .limit(1)
        .single();

      const gstEnabled = settingsData?.gst_enabled ?? true;
      const servicePercent = settingsData?.service_charge_percent ?? 0;
      const invoicePrefix = settingsData?.invoice_prefix || 'INV';

      // 3. Calculate per-item taxes
      const subtotal = cart.reduce((sum, item) => {
        const itemPrice = item.offer
          ? Math.max(0, item.price - (item.offer.discount_type === 'percent'
            ? (item.price * item.offer.discount_value) / 100
            : item.offer.discount_value))
          : item.price;
        return sum + itemPrice * item.quantity;
      }, 0);

      let taxTotal = 0;
      const orderItemsPayload = cart.map((item) => {
        const effectivePrice = item.offer
          ? Math.max(0, item.price - (item.offer.discount_type === 'percent'
            ? (item.price * item.offer.discount_value) / 100
            : item.offer.discount_value))
          : item.price;
        const itemTax = gstEnabled ? (effectivePrice * item.quantity * (item.taxRate || 0) / 100) : 0;
        taxTotal += itemTax;
        return {
          menu_item_id: item.id,
          item_name: item.name,
          quantity: item.quantity,
          unit_price: effectivePrice,
          tax_rate: item.taxRate || 0,
          tax_amount: parseFloat(itemTax.toFixed(2)),
        };
      });

      const cgst = parseFloat((taxTotal / 2).toFixed(2));
      const sgst = parseFloat((taxTotal / 2).toFixed(2));

      // 4. Fetch and apply bill discount
      const { data: billOfferData } = await supabase
        .from('bill_offers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .gte('end_date', new Date().toISOString())
        .lte('start_date', new Date().toISOString())
        .single();

      let discountAmount = 0;
      if (billOfferData && subtotal >= billOfferData.min_order_value) {
        discountAmount = billOfferData.discount_type === 'percent'
          ? (subtotal * billOfferData.discount_value) / 100
          : billOfferData.discount_value;
      }

      // 5. Service charge on subtotal after discount
      const afterDiscount = subtotal - discountAmount;
      const serviceCharge = gstEnabled ? parseFloat((afterDiscount * servicePercent / 100).toFixed(2)) : 0;

      // 6. Final total
      const finalTotal = parseFloat((afterDiscount + taxTotal + serviceCharge).toFixed(2));

      // 7. Generate invoice number
      const invoiceNumber = `${invoicePrefix}-${Date.now().toString(36).toUpperCase()}`;

      // 8. Fetch a valid chef_id
      const { data: chefData, error: chefError } = await supabase
        .from('menus')
        .select('chef_id')
        .eq('restaurant_id', restaurantId)
        .limit(1)
        .single();

      if (chefError || !chefData?.chef_id) {
        throw new Error('System Error: No available chef found.');
      }

      // 9. Insert Order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            table_number: tableNumber,
            status: 'received',
            total_amount: finalTotal,
            subtotal: parseFloat(subtotal.toFixed(2)),
            discount_amount: parseFloat(discountAmount.toFixed(2)),
            tax_total: parseFloat(taxTotal.toFixed(2)),
            cgst,
            sgst,
            service_charge: serviceCharge,
            invoice_number: invoiceNumber,
            chef_id: chefData.chef_id,
            special_instructions: specialInstructions || null,
            user_id: user?.id || null,
            customer_phone: userPhone || null,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            restaurant_id: restaurantId,
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('No order data returned');

      const orderId = orderData.id;

      // 10. Insert Order Items with tax snapshots
      const itemsWithOrderId = orderItemsPayload.map((item) => ({
        ...item,
        order_id: orderId,
        restaurant_id: restaurantId,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsWithOrderId);

      if (itemsError) throw itemsError;

      // 11. Clear Cart & Reset UI (No localStorage active_order hack needed anymore)
      localStorage.removeItem('dineo_cart');
      setCart([]);
      setSpecialInstructions('');
      setShowReviewModal(false);
      
      // Update the active tracker UI natively 
      await fetchActiveOrders(restaurantId, tableNumber);
      setShowOrderTracker(true);

    } catch (error: any) {
      console.error('=== ORDER PLACEMENT ERROR ===');
      console.error('Full error:', error);
      alert(`Failed to place order. ${error.message || 'Please try again.'}`);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (!isLoaded || !tableNumber) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-4 md:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-contain bg-white" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                  {restaurantName.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {restaurantName}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Table #{tableNumber}
                </p>
              </div>
            </div>
            <p className="hidden text-xs font-light text-muted-foreground/60 sm:block">
              Ordering with Dineo
            </p>
          </div>
        </div>
      </header >

      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        {/* Verification Banner */}
        {!isAuthenticated && !isPlacingOrder && (
          <div className="mb-6 rounded-2xl bg-primary/10 p-4 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-primary">Verify Your Identity</h3>
              <p className="text-sm text-muted-foreground">
                Please verify your phone number to place an order.
              </p>
            </div>
            <button
              onClick={() => setShowOTPModal(true)}
              className="flex-shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              Verify Now
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6 relative">
          <input
            type="text"
            placeholder="Search for dishes, ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 pl-11 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="mb-6 flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`flex-shrink-0 rounded-full px-4 py-2 font-medium transition-all ${selectedCategory === category
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Menu Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {menuItems.length > 0 ? (
            filteredMenu.map((item) => {
              const cartItem = cart.find((c) => c.id === item.id);
              const quantity = cartItem?.quantity || 0;

              return (
                <div
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-md transition-shadow hover:shadow-lg"
                >
                  {/* Image */}
                  <div className="relative h-40 bg-secondary">
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      className="h-full w-full object-cover transition-opacity duration-300 opacity-0 data-[loaded=true]:opacity-100"
                      onLoad={(e) => e.currentTarget.setAttribute('data-loaded', 'true')}
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                        e.currentTarget.setAttribute('data-loaded', 'true');
                      }}
                    />
                    <div className="absolute inset-0 bg-secondary animate-pulse -z-10" />

                    {item.isSoldOut && (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-xl">
                        <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider shadow-lg">
                          Sold Out
                        </span>
                      </div>
                    )}

                    <div className="absolute top-2 right-2 rounded bg-white/90 p-1 shadow-sm">
                      {item.vegType === 'non_veg' ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-red-600 bg-white">
                          <div className="h-2 w-2 rounded-full bg-red-600" />
                        </div>
                      ) : item.vegType === 'egg' ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-yellow-500 bg-white">
                          <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        </div>
                      ) : (
                        <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-green-600 bg-white">
                          <div className="h-2 w-2 rounded-full bg-green-600" />
                        </div>
                      )}
                    </div>
                    {/* Offer Badge */}
                    {item.offer && (
                      <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-1 rounded-md text-xs font-bold shadow-md">
                        {item.offer.discount_type === 'percent'
                          ? `${item.offer.discount_value}% OFF`
                          : `₹${item.offer.discount_value} OFF`}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <h3 className="font-bold text-foreground text-lg">
                        {item.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      {/* Price with Discount */}
                      <div className="flex flex-col gap-0.5">
                        {item.offer ? (
                          <>
                            <span className="text-xs text-muted-foreground line-through">
                              ₹{formatPrice(safePrice(item.price))}
                            </span>
                            <span className="font-bold text-primary text-lg">
                              ₹{(() => {
                                const discount = item.offer.discount_type === 'percent'
                                  ? (item.price * item.offer.discount_value) / 100
                                  : item.offer.discount_value;
                                return formatPrice(Math.max(0, item.price - discount));
                              })()}
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-primary text-lg">
                            ₹{formatPrice(safePrice(item.price))}
                          </span>
                        )}
                      </div>

                      {/* Add / Quantity Controls */}
                      {quantity === 0 ? (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => addToCart(item)}
                            disabled={item.isSoldOut}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-transform active:scale-95 flex items-center gap-2 ${item.isSoldOut ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:scale-105'
                              }`}
                          >
                            <Plus size={16} />
                            Add
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-1">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, quantity - 1)
                            }
                            className="rounded p-1 hover:bg-primary/20"
                          >
                            <Minus size={16} className="text-primary" />
                          </button>
                          <span className="w-6 text-center font-semibold text-primary">
                            {quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.id, quantity + 1)
                            }
                            className="rounded p-1 hover:bg-primary/20"
                          >
                            <Plus size={16} className="text-primary" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-10 text-muted-foreground">Loading menu...</div>
          )}
        </div>
      </main>

      {/* Sticky Cart Summary (Mobile) */}
      {
        cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card shadow-2xl md:hidden">
            <div className="mx-auto max-w-4xl px-4 py-4">
              <button
                onClick={handlePlaceOrderClick}
                className="flex w-full items-center justify-between rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart size={20} />
                  <span>{totalItems} items</span>
                </div>
                <div>
                  <span>₹{formatPrice(finalTotalAmount)}</span>
                </div>
              </button>
            </div>
          </div>
        )
      }

      {/* Desktop Cart Summary */}
      {
        cart.length > 0 && (
          <div className="fixed right-6 bottom-6 hidden w-72 rounded-2xl bg-card shadow-lg md:block border border-border p-4">
            <h3 className="mb-3 font-bold text-foreground">Order Summary</h3>
            <div className="mb-4 max-h-48 space-y-2 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-semibold text-foreground">
                    ₹{formatPrice(safePrice(item.price) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 mb-3">
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span className="text-primary">₹{formatPrice(finalTotalAmount)}</span>
              </div>
            </div>
            <button
              onClick={handlePlaceOrderClick}
              className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              Review Order
            </button>
          </div>
        )
      }

      {/* Sticky Active Orders Tracker (Mobile) */}
      {activeOrders.length > 0 && (
        <div className={`fixed ${cart.length > 0 ? 'bottom-20' : 'bottom-0'} left-0 right-0 z-40 transition-all duration-300 md:hidden flex justify-center pb-4 px-4 pointer-events-none`}>
          <button
            onClick={() => setShowOrderTracker(true)}
            className="flex w-full items-center justify-between rounded-xl bg-blue-600/95 backdrop-blur shadow-2xl px-5 py-3.5 text-white font-medium hover:scale-105 active:scale-95 transition-transform border border-blue-500 pointer-events-auto"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>{activeOrders.length} Active Order{activeOrders.length > 1 ? 's' : ''}</span>
            </div>
            <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-full">
              View Status
            </span>
          </button>
        </div>
      )}

      {/* Desktop Active Orders Bumper */}
      {activeOrders.length > 0 && (
        <div className={`fixed right-6 ${cart.length > 0 ? 'bottom-[340px]' : 'bottom-6'} hidden md:block z-40`}>
          <button
             onClick={() => setShowOrderTracker(true)}
             className="flex w-72 items-center justify-between rounded-xl bg-blue-600/95 backdrop-blur shadow-xl px-4 py-3 text-white font-medium hover:-translate-y-1 transition-transform border border-blue-500"
          >
             <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Tracking {activeOrders.length} Order{activeOrders.length > 1 ? 's' : ''}</span>
            </div>
            <span className="text-sm font-bold">View →</span>
          </button>
        </div>
      )}

      {/* Order Review Modal */}
      {
        showReviewModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50">
            <div className="w-full rounded-t-3xl md:rounded-2xl bg-card shadow-2xl md:max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card p-6">
                <h2 className="text-2xl font-bold text-foreground">
                  Review Order
                </h2>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="rounded-lg p-1 hover:bg-secondary"
                >
                  <X size={24} className="text-foreground" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Order Items */}
                <div className="space-y-3">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="text-4xl mb-2">🍽️</div>
                      <p className="font-semibold text-lg text-foreground">Your plate is empty</p>
                      <p className="text-muted-foreground text-sm">Add some delicious items from the menu!</p>
                      <button
                        onClick={() => setShowReviewModal(false)}
                        className="mt-4 text-primary font-bold hover:underline"
                      >
                        Browse Menu
                      </button>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-center rounded-lg bg-secondary p-4"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">
                            {item.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            ₹{formatPrice(safePrice(item.price))} each
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-1">
                            <button
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                              className="rounded p-1 hover:bg-primary/20"
                            >
                              <Minus size={16} className="text-primary" />
                            </button>
                            <span className="w-6 text-center font-semibold text-primary">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.id, item.quantity + 1)
                              }
                              className="rounded p-1 hover:bg-primary/20"
                            >
                              <Plus size={16} className="text-primary" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="rounded p-1 hover:bg-secondary"
                          >
                            <X size={20} className="text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    )))}
                </div>

                {/* Order Summary */}
                <div className="space-y-2 border-t border-border pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal <span className="text-xs opacity-70">(inc. item offers)</span>:</span>
                    <span className="font-semibold text-foreground">
                      ₹{formatPrice(subtotal)}
                    </span>
                  </div>

                  {billDiscountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 font-medium">
                      <span>Extra Discount applied:</span>
                      <span>- ₹{formatPrice(billDiscountAmount)}</span>
                    </div>
                  )}

                  {taxTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">GST Taxes:</span>
                      <span className="font-semibold text-foreground">
                        ₹{formatPrice(taxTotal)}
                      </span>
                    </div>
                  )}

                  {serviceChargeAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Service Charge ({servicePercent}%):</span>
                      <span className="font-semibold text-foreground">
                        ₹{formatPrice(serviceChargeAmount)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
                    <span className="text-foreground">Grand Total:</span>
                    <span className="text-primary">
                      ₹{formatPrice(finalTotalAmount)}
                    </span>
                  </div>
                </div>

                {/* Special Instructions Input */}
                <div className="space-y-2 border-t border-border pt-4">
                  <label htmlFor="instructions" className="text-sm font-semibold text-foreground">
                    Instructions for Chef (optional)
                  </label>
                  <textarea
                    id="instructions"
                    value={specialInstructions}
                    onChange={(e) => {
                      if (e.target.value.length <= 250) {
                        setSpecialInstructions(e.target.value);
                      }
                    }}
                    placeholder="E.g. No onion, less spicy, extra cheese..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    rows={3}
                    maxLength={250}
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    {specialInstructions.length}/250
                  </div>
                </div>

                {/* Payment Options */}
                {isOffline ? (
                  <div className="w-full rounded-xl bg-destructive/10 p-3 text-center text-destructive font-bold border border-destructive/20">
                    ⚠️ You are offline. Check connection.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        const amountInPaise = Math.round(finalTotalAmount * 100);
                        const options = {
                          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_yourkeyhere',
                          amount: amountInPaise,
                          currency: 'INR',
                          name: restaurantName,
                          description: `Order for Table #${tableNumber}`,
                          handler: function () {
                            placeOrder('online', 'paid');
                          },
                          prefill: {
                            contact: userPhone ? userPhone.replace('+91', '') : undefined
                          },
                          theme: { color: '#D4A574' },
                        };
                        const rzp = new (window as any).Razorpay(options);
                        rzp.open();
                      }}
                      disabled={cart.length === 0 || isPlacingOrder}
                      className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPlacingOrder ? 'Processing...' : 'Pay Now'}
                    </button>
                    <button
                      onClick={() => {
                        // Use local state (already hydrated from localStorage on load)
                        if (!isAuthenticated && !isGuestMode) {
                          setPendingCashOrder(true);
                          setShowReviewModal(false); // Close review modal so OTP modal isn't obscured
                          setShowOTPModal(true);
                        } else {
                          placeOrder('cash', 'unpaid');
                        }
                      }}
                      disabled={cart.length === 0 || isPlacingOrder}
                      className="w-full rounded-lg border-2 border-border bg-secondary px-4 py-3 font-bold text-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPlacingOrder ? 'Processing...' : 'Pay Later (Cash)'}
                    </button>
                  </div>
                )}

                {/* Reset Session - kept separate, below order button */}
                <div className="mt-4 flex justify-center opacity-30 hover:opacity-100 transition-opacity">
                  <button onClick={resetSession} className="text-xs text-muted-foreground underline">
                    Reset Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Order Tracker Slide-Up Panel */}
      {showOrderTracker && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-background w-full rounded-t-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-300">
            
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ChefHat className="h-6 w-6 text-primary" />
                Your Active Orders
              </h2>
              <button 
                onClick={() => setShowOrderTracker(false)}
                className="p-2 rounded-full hover:bg-muted bg-muted/50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Orders List */}
            <div className="p-4 overflow-y-auto w-full max-w-2xl mx-auto space-y-4 pb-12">
              {activeOrders.map((ord, idx) => {
                const getStatusMeta = (status: string) => {
                  switch(status) {
                    case 'received': return { icon: Clock, label: 'Order Received', color: 'text-amber-500', bg: 'bg-amber-100', text: 'Waiting for chef to accept...' };
                    case 'preparing': return { icon: ChefHat, label: 'Preparing', color: 'text-blue-500', bg: 'bg-blue-100', text: 'Chef is preparing your food' };
                    case 'ready': return { icon: Check, label: 'Ready!', color: 'text-emerald-500', bg: 'bg-emerald-100', text: 'Order is ready to be served' };
                    default: return { icon: Clock, label: 'Processing', color: 'text-gray-500', bg: 'bg-gray-100', text: 'Fetching status...' };
                  }
                };
                
                const meta = getStatusMeta(ord.status);
                const Icon = meta.icon;

                return (
                  <div key={ord.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                    {/* Order Head */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">Order #{ord.short_id || ord.id.slice(0,6).toUpperCase()}</span>
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                            {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Table {tableNumber}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-lg text-primary">₹{formatPrice(ord.total_amount)}</span>
                      </div>
                    </div>

                    {/* Order Status Pill */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${meta.bg}`}>
                      <div className={`p-2 rounded-full bg-white/60 shadow-sm ${meta.color}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className={`font-bold text-sm ${meta.color}`}>{meta.label}</p>
                        <p className={`text-xs opacity-80 ${meta.color}`}>{meta.text}</p>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="pt-3 border-t border-border/50">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items</p>
                      <ul className="space-y-2">
                        {ord.order_items?.map((item: any, i: number) => (
                          <li key={i} className="flex justify-between text-sm">
                            <span><span className="font-medium">{item.quantity}x</span> {item.item_name}</span>
                            <span className="text-muted-foreground">₹{formatPrice(item.unit_price * item.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
              
              {activeOrders.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No active orders</p>
                  <p className="text-sm mt-1">Orders will appear here once placed.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OTP Login Modal */}
      <OTPLoginModal
        isOpen={showOTPModal}
        onClose={() => setShowOTPModal(false)}
        onSuccess={handleOTPSuccess}
        onGuestCheckout={() => {
          setIsGuestMode(true);
          setShowOTPModal(false);
          setShowReviewModal(true);
        }}
      />
    </div>
  );
}
