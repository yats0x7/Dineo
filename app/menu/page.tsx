'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Plus, Minus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isVeg: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

const CATEGORIES = ['All', 'Starters', 'Main Course', 'Beverages', 'Desserts'];

export default function MenuPage() {
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
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
  }, [router]);

  const fetchMenu = async () => {
    try {
      const { data, error } = await supabase.from('menus').select('*');
      if (error) throw error;

      if (data) {
        const mappedItems: MenuItem[] = data.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.image_url, // Mapping from DB column name
          category: item.category,
          isVeg: item.is_veg, // Mapping from DB column name
        }));
        setMenuItems(mappedItems);
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
      // Fallback or empty state could be handled here
    } finally {
      setIsLoaded(true);
    }
  };

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
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const placeOrder = async () => {
    if (!tableNumber) return;
    setIsPlacingOrder(true);

    try {
      const finalTotal = totalPrice * 1.1; // Including tax

      // 1. Insert Order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            table_number: tableNumber,
            status: 'received',
            total_amount: finalTotal,
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('No order data returned');

      const orderId = orderData.id;

      // 2. Insert Order Items
      const orderItems = cart.map((item) => ({
        order_id: orderId,
        menu_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Save to localStorage & Redirect
      // Storing relevant details for the Order Status page
      const activeOrder = {
        id: orderId,
        tableNumber,
        status: 'received',
        totalPrice: finalTotal,
        items: cart, // Keeping items for display
        timestamp: new Date().toISOString()
      };

      localStorage.setItem('dineo_active_order', JSON.stringify(activeOrder));
      localStorage.removeItem('dineo_cart');
      setCart([]);
      setShowReviewModal(false);
      router.push('/order-status');

    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
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
                      <span className="font-bold text-primary text-lg">
                        ₹{item.price.toFixed(2)}
                      </span>

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
                onClick={() => setShowReviewModal(true)}
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
                    ₹{(item.price * item.quantity).toFixed(2)}
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
              onClick={() => setShowReviewModal(true)}
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
                            ₹{item.price.toFixed(2)} each
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
    </div>
  );
}
