'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, ChefHat } from 'lucide-react';

interface Order {
  id: string;
  tableNumber: string;
  items: any[];
  totalPrice: number;
  status: 'received' | 'cooking' | 'made';
  timestamp: string;
}

export default function OrderStatusPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [currentStatus, setCurrentStatus] = useState<'received' | 'cooking' | 'made'>('received');
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('dineo_active_order');
    if (!stored || stored === 'null') {
      router.push('/');
      return;
    }

    const orderData: Order = JSON.parse(stored);
    setOrder(orderData);
    setCurrentStatus('received');

    // Simulate status progression
    const timer1 = setTimeout(() => setCurrentStatus('cooking'), 3000);
    const timer2 = setTimeout(() => setCurrentStatus('made'), 6000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [router]);

  if (!order) return null;

  const statusSteps = [
    { status: 'received' as const, label: 'Order Received', icon: Check, color: 'text-primary' },
    { status: 'cooking' as const, label: 'Cooking', icon: ChefHat, color: 'text-primary' },
    { status: 'made' as const, label: 'Ready', icon: Check, color: 'text-primary' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Main Content */}
      <div className="w-full max-w-md">
        {/* Status Card */}
        <div className="rounded-3xl bg-card shadow-lg p-8 border border-border mb-6">
          {/* Order ID */}
          <div className="text-center mb-8">
            <p className="text-muted-foreground text-sm uppercase tracking-wider">Order Number</p>
            <p className="text-2xl font-bold text-foreground mt-1">{order.id}</p>
            <p className="text-muted-foreground text-sm mt-2">Table #{order.tableNumber}</p>
          </div>

          {/* Status Timeline */}
          <div className="space-y-4 mb-8">
            {statusSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = statusSteps.findIndex(s => s.status === currentStatus) >= index;
              const isCurrentStep = step.status === currentStatus;

              return (
                <div key={step.status}>
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                        } ${isCurrentStep ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    >
                      <Icon size={20} />
                    </div>

                    {/* Label */}
                    <div className="flex-1">
                      <p
                        className={`font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                      >
                        {step.label}
                      </p>
                      {isCurrentStep && (
                        <p className="text-xs text-primary font-medium">In Progress</p>
                      )}
                    </div>

                    {/* Status Indicator */}
                    {isCurrentStep && (
                      <div className="flex items-center gap-1 text-primary">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Connector Line */}
                  {index < statusSteps.length - 1 && (
                    <div
                      className={`ml-5 h-6 w-0.5 transition-colors ${isActive ? 'bg-primary' : 'bg-border'
                        }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Estimated Time */}
          <div className="rounded-xl bg-secondary p-4 text-center">
            {currentStatus === 'received' && (
              <div>
                <p className="text-sm text-muted-foreground">Estimated Time</p>
                <p className="text-lg font-bold text-foreground mt-1">~15 minutes</p>
              </div>
            )}
            {currentStatus === 'cooking' && (
              <div>
                <p className="text-sm text-muted-foreground">Currently Cooking</p>
                <p className="text-lg font-bold text-foreground mt-1">~8 minutes remaining</p>
              </div>
            )}
            {currentStatus === 'made' && (
              <div>
                <p className="text-lg font-bold text-primary">Your order is ready!</p>
                <p className="text-sm text-muted-foreground mt-1">Please collect from counter</p>
              </div>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl bg-card shadow-lg p-6 border border-border mb-6">
          <h3 className="font-bold text-foreground mb-4">Order Summary</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
            {order.items.map((item) => (
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
          <div className="border-t border-border pt-3">
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span className="text-primary">₹{order.totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {currentStatus === 'made' && (
          <div className="space-y-3">
            {/* Button 1: Order Again */}
            <button
              onClick={() => {
                // Keep table, clear order & cart
                localStorage.removeItem('dineo_active_order');
                localStorage.removeItem('dineo_cart');
                router.push('/menu');
              }}
              className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              Order Again
            </button>

            {/* Button 2: Go Home */}
            <button
              onClick={() => {
                // Clear everything
                localStorage.removeItem('dineo_table_number');
                localStorage.removeItem('dineo_cart');
                localStorage.removeItem('dineo_active_order');
                router.push('/');
              }}
              className="w-full rounded-lg bg-secondary px-4 py-3 font-bold text-foreground transition-transform hover:scale-105 active:scale-95"
            >
              Go Home
            </button>
          </div>
        )}

        {/* While cooking/received - allow adding more items */}
        {currentStatus !== 'made' && (
          <button
            onClick={() => router.push('/menu')}
            className="w-full rounded-lg bg-secondary px-4 py-3 font-bold text-foreground transition-transform hover:scale-105 active:scale-95"
          >
            Add More Items
          </button>
        )}
      </div>
    </div>
  );
}
