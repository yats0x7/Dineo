'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Plus, Minus, X } from 'lucide-react';
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

export default function MenuPage() {
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const router = useRouter();

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

  const checkAuthStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsAuthenticated(!!user);
  };

  const fetchMenu = async () => {
    try {
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
        `);

      // Also fetch items without offers
      const { data: itemsWithoutOffers, error: noOffersError } = await supabase
        .from('menu_items')
        .select('*');

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

  useEffect(() => {
    // Load state from localStorage on mount
    const storedTable = localStorage.getItem('dineo_table_number');
    const storedCart = localStorage.getItem('dineo_cart');

    if (!storedTable) {
      router.push('/table-entry');
      return;
    }

    setTableNumber(storedTable);

    if (storedCart) {
      try {
        setCart(JSON.parse(storedCart));
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }

    fetchMenu();
    checkAuthStatus();
  }, [router]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('dineo_cart', JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  const resetSession = () => {
    if (confirm('Are you sure you want to end your session? This will clear your cart and table data.')) {
      localStorage.removeItem('dineo_table_number');
      localStorage.removeItem('dineo_cart');
      localStorage.removeItem('dineo_active_order');
      router.push('/');
    }
  };

  const filteredMenu =
    selectedCategory === 'All'
      ? menuItems
      : menuItems.filter((item) => item.category === selectedCategory);

  const addToCart = (item: MenuItem) => {
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
  const totalBeforeOffers = cart.reduce((sum, item) => sum + safePrice(item.price) * item.quantity, 0);
  const totalItemDiscounts = itemsWithDiscounts.reduce((sum, item) => sum + item.itemDiscount * item.quantity, 0);
  const totalPrice = itemsWithDiscounts.reduce((sum, item) => sum + item.discountedPrice * item.quantity, 0);

  const handleOTPSuccess = (userId: string) => {
    setShowOTPModal(false);
    setIsAuthenticated(true);
    // Immediately show review modal after successful OTP
    setShowReviewModal(true);
  };

  const handlePlaceOrderClick = async () => {
    // Check if user is authenticated before showing review modal
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Not authenticated, show OTP modal first
      setShowOTPModal(true);
    } else {
      // Already authenticated, proceed to review modal
      setShowReviewModal(true);
    }
  };

  const placeOrder = async () => {
    if (!tableNumber) return;
    setIsPlacingOrder(true);

    try {
      // 1. CRITICAL: Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // This shouldn't happen if flow is correct, but safety check
        throw new Error('Please login to place order');
      }

      // 2. Fetch restaurant settings for tax calculation
      const { data: settingsData, error: settingsError } = await supabase
        .from('restaurant_settings')
        .select('gst_percent, service_charge_percent, tax_enabled')
        .single();

      if (settingsError) {
        console.warn('No settings found, using defaults');
      }

      const gstPercent = settingsData?.gst_percent || 10;
      const servicePercent = settingsData?.service_charge_percent || 0;
      const taxEnabled = settingsData?.tax_enabled ?? true;

      // 3. Calculate with proper order: item discounts → bill offer → tax
      // Step 1 & 2: Already calculated in itemsWithDiscounts (totalPrice = subtotal after item discounts)
      const subtotal = totalPrice;

      // Step 3: Fetch and apply bill offer
      const { data: billOfferData } = await supabase
        .from('bill_offers')
        .select('*')
        .eq('active', true)
        .gte('end_date', new Date().toISOString())
        .lte('start_date', new Date().toISOString())
        .single();

      let billDiscount = 0;
      if (billOfferData && subtotal >= billOfferData.min_order_value) {
        billDiscount = billOfferData.discount_type === 'percent'
          ? (subtotal * billOfferData.discount_value) / 100
          : billOfferData.discount_value;
      }

      const subtotalAfterBillDiscount = subtotal - billDiscount;

      // Step 4: Apply tax to final amount
      const gstAmount = taxEnabled ? (subtotalAfterBillDiscount * (gstPercent / 100)) : 0;
      const serviceAmount = taxEnabled ? (subtotalAfterBillDiscount * (servicePercent / 100)) : 0;
      const finalTotal = subtotalAfterBillDiscount + gstAmount + serviceAmount;

      // 3. Fetch a valid chef_id to satisfy DB constraint
      const { data: chefData, error: chefError } = await supabase
        .from('menus')
        .select('chef_id')
        .limit(1)
        .single();

      if (chefError || !chefData?.chef_id) {
        throw new Error('System Error: No available chef found (RLS or empty table).');
      }

      // 4. Insert Order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            table_number: tableNumber,
            status: 'received',
            total_amount: finalTotal,
            chef_id: chefData.chef_id,
            special_instructions: specialInstructions || null,
            user_id: user?.id || null, // Link to authenticated user if exists
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('No order data returned');

      const orderId = orderData.id;

      // 5. Insert Order Items
      const orderItems = cart.map((item) => ({
        order_id: orderId,
        menu_item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 6. Save to localStorage & Redirect
      const activeOrder = {
        id: orderId,
        tableNumber,
        status: 'received',
        totalPrice: finalTotal,
        items: cart,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem('dineo_active_order', JSON.stringify(activeOrder));
      localStorage.removeItem('dineo_cart');
      setCart([]);
      setSpecialInstructions('');
      setShowReviewModal(false);

      window.location.href = '/order-status';

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
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                D
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  The Golden Fork
                </h1>
                <p className="text-xs text-muted-foreground">
                  Table #{tableNumber}
                </p>
              </div>
            </div>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Ordering with Dineo
          </p>
        </div>

      </header >

      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        {/* Category Pills */}
        <div className="mb-6 flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 md:mx-0 md:px-0">
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
                    <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold">
                      {item.isVeg ? '🌱' : '🍖'}
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
                              ₹{safePrice(item.price).toFixed(2)}
                            </span>
                            <span className="font-bold text-primary text-lg">
                              ₹{(() => {
                                const discount = item.offer.discount_type === 'percent'
                                  ? (item.price * item.offer.discount_value) / 100
                                  : item.offer.discount_value;
                                return Math.max(0, item.price - discount).toFixed(2);
                              })()}
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-primary text-lg">
                            ₹{safePrice(item.price).toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Add / Quantity Controls */}
                      {quantity === 0 ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                        >
                          <Plus size={16} />
                          Add
                        </button>
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
                  <span>₹{totalPrice.toFixed(2)}</span>
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
                    ₹{(safePrice(item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 mb-3">
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span className="text-primary">₹{totalPrice.toFixed(2)}</span>
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
                            ₹{safePrice(item.price).toFixed(2)} each
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
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-semibold text-foreground">
                      ₹{totalPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (10%):</span>
                    <span className="font-semibold text-foreground">
                      ₹{(totalPrice * 0.1).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
                    <span className="text-foreground">Total:</span>
                    <span className="text-primary">
                      ₹{(totalPrice * 1.1).toFixed(2)}
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

                {/* Place Order Button or Offline Warning */}
                {isOffline ? (
                  <div className="w-full rounded-xl bg-destructive/10 p-3 text-center text-destructive font-bold border border-destructive/20">
                    ⚠️ You are offline. Check connection.
                  </div>
                ) : (
                  <button
                    onClick={placeOrder}
                    disabled={cart.length === 0 || isPlacingOrder}
                    className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPlacingOrder ? 'Placing Order...' : 'Place Order'}
                  </button>
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

      {/* OTP Login Modal */}
      <OTPLoginModal
        isOpen={showOTPModal}
        onClose={() => setShowOTPModal(false)}
        onSuccess={handleOTPSuccess}
      />
    </div>
  );
}
