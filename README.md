# 📱 Dineo — Customer App

**QR-based dine-in ordering app for restaurant customers — scan, browse, order, pay.**

Built with **Next.js 16**, **Supabase**, **Tailwind CSS**, and **Razorpay**.

---

## ✨ Features

### 📷 QR Code Ordering
- **Scan & go** — scan the table QR to instantly open the restaurant menu
- **Auto table detection** — table number and restaurant are embedded in the QR URL
- **No app install required** — works in any mobile browser
- **Clean URL routing** — `/r/[restaurant_id]/t/[table_number]`

### 🍽️ Digital Menu
- **Browse by category** — Starters, Main Course, Beverages, Desserts
- **Search** — find dishes instantly with keyword search
- **Veg/Non-Veg/Egg indicators** — dietary preference badges on every item
- **Sold-out items** — greyed out with clear "Sold Out" label
- **Item-level offers** — discounted prices displayed where applicable
- **Restaurant branding** — logo and name loaded dynamically per restaurant

### 🛒 Cart & Checkout
- **Add/remove items** — intuitive quantity controls
- **Special instructions** — add notes for the kitchen
- **Bill breakdown** — subtotal, GST (CGST + SGST), service charge, discounts
- **Bill-level offers** — automatic discounts based on minimum order value
- **Review before placing** — full order summary modal

### 💳 Payments
- **Razorpay integration** — secure online payments
- **Cash on table** — pay by cash option for traditional billing
- **Payment confirmation** — real-time payment status tracking

### 📊 Order Tracking
- **Realtime status updates** — Received → Preparing → Ready
- **Visual progress indicator** — step-by-step order status with icons
- **Supabase Realtime** — instant updates without page refresh

### 🔐 Authentication (Optional)
- **OTP-based login** — phone number verification via Supabase Auth
- **Guest mode** — place orders without creating an account
- **Persistent session** — returning customers see their active orders

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth (OTP) |
| Payments | Razorpay |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase project (shared with chef-portal)

### Installation

```bash
# Clone the repo
git clone <repository-url>
cd customer-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create `.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_RAZORPAY_KEY_ID=<your-razorpay-key>
NEXT_PUBLIC_CUSTOMER_APP_URL=https://dine0.vercel.app
```

### Development

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
customer-app/
├── app/
│   ├── menu/                          # Main menu page (browse + cart + checkout)
│   ├── order-status/                  # Realtime order tracking
│   ├── table-entry/                   # Manual table number entry (fallback)
│   ├── r/[restaurant_id]/t/[table_number]/  # QR redirect route
│   ├── page.tsx                       # Root redirect (→ menu or table-entry)
│   ├── layout.tsx                     # Root layout + Razorpay script
│   └── globals.css                    # Global styles
├── components/
│   └── OTPLoginModal.tsx              # Phone OTP authentication modal
└── lib/supabase/
    └── client.ts                      # Supabase browser client
```

---

## 🔄 User Flow

```
QR Scan → /r/{restaurant_id}/t/{table_number}
           ↓
    Store to localStorage
           ↓
    Redirect to /menu
           ↓
    Browse → Add to Cart → Review Order
           ↓
    Choose Payment (Online / Cash)
           ↓
    Order Confirmed → /order-status
           ↓
    Realtime Updates (Received → Preparing → Ready)
```

---

## 📱 Mobile-First Design

The entire app is designed for mobile-first usage:
- Responsive layouts optimized for phone screens
- Touch-friendly tap targets and swipe interactions
- Sticky cart button with item count badge
- Full-screen modals for cart review and checkout
- Offline detection with user-friendly banner

---

## 🔗 Related

- **[Chef Portal](../chef-portal/)** — Restaurant management dashboard (orders, menus, QR codes)
- **Live App** — [dine0.vercel.app](https://dine0.vercel.app)

---

## 📄 License

Private — All rights reserved.
