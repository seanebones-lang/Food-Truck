# Food Truck Management System

A comprehensive full-stack monorepo application for managing food truck operations, including customer mobile app, admin web dashboard, and backend API. Built with React Native (Expo), React (Vite), Node.js/Express, and real-time communication via Socket.io.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Testing](#testing)
- [Development Workflow](#development-workflow)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)

## 🎯 Overview

This is a monorepo built with Yarn workspaces containing three main packages:

1. **Customer App** - React Native mobile app (Expo) for customers to browse menus, place orders, track trucks, and receive notifications
2. **Admin App** - React web dashboard (Vite) for administrators to manage menus, track orders, view analytics, and coordinate teams
3. **Shared Package** - Common TypeScript types, utilities, and offline sync functionality
4. **Backend Server** - Node.js/Express API with Socket.io for real-time updates

## 🏗️ Architecture

### Monorepo Structure

```
Food-Truck/
├── packages/
│   ├── customer-app/       # React Native (Expo) mobile app
│   ├── admin-app/          # React (Vite) web dashboard
│   └── shared/             # Shared types and utilities
├── server.js               # Express backend API
├── vercel.json             # Vercel deployment config
├── eas.json                # Expo EAS build config
└── .github/workflows/      # CI/CD pipelines
```

### Technology Stack

**Frontend (Mobile):**
- React Native 0.75.2 with Expo ~54.0
- React Navigation 6.1.9
- Redux Toolkit + Redux Persist 6.0.2
- Zustand 4.4.7 (cart state)
- React i18next 14.1.0 (internationalization)
- Expo Notifications (push notifications)
- React Native Maps (location services)
- Socket.io Client (real-time updates)

**Frontend (Web/Admin):**
- React 19.0.0 with Vite
- Ant Design 5.15.0
- Recharts 2.12.7 (analytics charts)
- Socket.io Client
- Firebase Cloud Messaging (web notifications)
- Papa Parse 5.4.1 (CSV export)

**Backend:**
- Node.js with Express
- Socket.io 4.7.2 (WebSocket server)
- JWT authentication (jsonwebtoken 9.0.2)
- bcryptjs 2.4.3 (password hashing)
- Sentry 8.10.0 (error tracking)

**DevOps & Tools:**
- Expo EAS (mobile builds)
- Vercel (web/backend deployment)
- GitHub Actions (CI/CD)
- Jest 29.7.0 (unit tests)
- Detox 20.3.0 (e2e tests)
- ESLint + Prettier
- Husky (git hooks)

## ✨ Features

### Customer App Features

#### 1. Authentication & User Management
- **Login/Signup** - Email and password authentication
- **Guest Mode** - Browse and order without account
- **Profile Management** - Update user information
- **Secure Token Storage** - JWT tokens stored in AsyncStorage
- **Session Management** - Automatic token refresh

#### 2. Menu Browsing & Search
- **Menu Display** - Browse all available menu items
- **Search Functionality** - Filter menu items by name
- **Category Filtering** - Filter by categories (Burgers, Sides, Drinks, etc.)
- **Stock Availability** - Real-time stock updates
- **Item Details** - View descriptions, prices, and customizations

#### 3. Shopping Cart
- **Add to Cart** - Add items with customizations
- **Quantity Management** - Update item quantities
- **Customizations** - Add options and modifications
- **Special Instructions** - Add notes to items
- **Persistent Cart** - Cart saved across app restarts (Zustand + AsyncStorage)
- **Stock Validation** - Real-time stock checking before adding

#### 4. Order Management
- **Order Placement** - Create orders with payment integration
- **Order Tracking** - View order status in real-time
- **Order History** - View past orders
- **Status Updates** - Real-time order status notifications
- **Offline Order Queue** - Queue orders when offline, sync when online

#### 5. Location Services
- **Truck Finder** - Find nearby food trucks on map
- **GPS Integration** - Get user location with permissions
- **Real-time Tracking** - Track truck locations via Socket.io
- **Distance Calculation** - See distance to trucks
- **Wait Time Estimates** - Estimated wait times per truck

#### 6. Notifications
- **Push Notifications** - Expo Notifications for iOS/Android
- **Order Status Alerts** - Get notified when order is ready
- **Promotional Alerts** - Receive special offers
- **Truck Nearby Alerts** - Get notified when trucks are close
- **Notification Preferences** - Customize notification settings
- **Offline Queue Alerts** - Notify about queued actions

#### 7. Offline Support
- **Offline Mode** - Full functionality when offline
- **Action Queue** - Queue orders and updates offline
- **Automatic Sync** - Sync queued actions when connection restored
- **Conflict Resolution** - Handle data conflicts intelligently
- **Persistent Storage** - Redux Persist for critical data
- **Connectivity Detection** - NetInfo for network status

#### 8. Internationalization (i18n)
- **Multi-language Support** - English, Spanish, French, Arabic
- **RTL Support** - Right-to-left layout for Arabic
- **Language Switching** - Change language on-the-fly
- **Localized Content** - All UI strings translated

#### 9. Accessibility
- **Screen Reader Support** - Full VoiceOver/TalkBack support
- **ARIA Labels** - Comprehensive accessibility labels
- **Touch Targets** - Minimum 44x44pt touch targets
- **Color Contrast** - WCAG AA compliant
- **Keyboard Navigation** - Full keyboard support

### Admin App Features

#### 1. Dashboard
- **Real-time Metrics** - Live order and revenue statistics
- **Order Management** - View and update order statuses
- **Quick Actions** - Quick access to common tasks
- **Real-time Updates** - Socket.io powered live updates

#### 2. Analytics Dashboard
- **Revenue Analytics** - Revenue trends and breakdowns
- **Order Analytics** - Order statistics by status
- **Top Selling Items** - Best performing menu items
- **Payment Analytics** - Payment status breakdown
- **Inventory Metrics** - Stock levels and availability
- **Date Range Filtering** - Filter analytics by date range
- **CSV Export** - Export analytics data to CSV
- **Interactive Charts** - Recharts visualizations (Area, Bar, Pie charts)

#### 3. Menu Management
- **CRUD Operations** - Create, read, update, delete menu items
- **Image Upload** - Add images to menu items
- **Stock Management** - Update inventory levels
- **Availability Toggle** - Enable/disable items
- **Category Organization** - Organize by categories
- **Real-time Updates** - Changes broadcast to customers

#### 4. Order Management
- **Order List** - View all orders
- **Status Updates** - Update order status (pending → ready)
- **Payment Tracking** - Monitor payment status
- **Order Details** - View complete order information
- **Real-time Notifications** - Get notified of new orders

#### 5. Location Management
- **Truck Tracking** - Update truck locations
- **GPS Integration** - Set locations via coordinates
- **Schedule Management** - Set truck schedules
- **Real-time Broadcast** - Broadcast location updates

#### 6. Team Coordination
- **Team Messaging** - Send messages to team members
- **Priority Levels** - Urgent, high, normal, low priorities
- **Role Targeting** - Target messages by role (drivers, chefs, all)
- **Message History** - View recent team messages

#### 7. Promotional Alerts
- **Send Promos** - Broadcast promotional messages
- **Target Audience** - All customers or specific groups
- **Real-time Delivery** - Instant delivery via Socket.io

#### 8. Payments Dashboard
- **Transaction View** - View all payment transactions
- **Payment Status** - Track payment statuses
- **Revenue Tracking** - Monitor revenue streams
- **Export Capabilities** - Export payment data

### Backend Features

#### 1. Authentication API
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

#### 2. Menu API
- `GET /api/menus` - Get all menu items
- `GET /api/menus/:id` - Get single menu item
- `POST /api/menus` - Create menu item (admin)
- `PUT /api/menus/:id` - Update menu item (admin)
- `DELETE /api/menus/:id` - Delete menu item (admin)

#### 3. Order API
- `POST /api/orders` - Create new order
- `GET /api/orders` - Get user's orders
- `GET /api/orders/all` - Get all orders (admin)
- `GET /api/orders/:id` - Get single order
- `PUT /api/orders/:id/status` - Update order status (admin)

#### 4. Truck/Location API
- `GET /api/trucks/nearby` - Find nearby trucks
- `POST /api/trucks/location` - Update truck location (admin)
- `GET /api/trucks` - Get all trucks
- `GET /api/trucks/:id` - Get single truck

#### 5. Analytics API
- `GET /api/analytics/dashboard` - Get dashboard metrics
- `GET /api/analytics/export` - Export orders to CSV
- `GET /api/analytics/orders` - Get filtered orders for analytics

#### 6. Notification API
- `POST /api/notifications/register` - Register push token
- `POST /api/notifications/send-promo` - Send promotional alert (admin)
- `POST /api/notifications/team-coordination` - Send team message (admin)

#### 7. Payment API
- `POST /api/payments/create-intent` - Create Stripe payment intent
- `POST /api/payments/webhook` - Stripe webhook handler

### Real-time Features (Socket.io)

#### Events Emitted by Server:
- `order:created` - New order placed
- `order:status:updated` - Order status changed
- `order:payment:succeeded` - Payment completed
- `menu:created` - New menu item added
- `menu:updated` - Menu item updated
- `menu:deleted` - Menu item deleted
- `stock:update` - Stock levels changed
- `notification:user` - User-specific notification
- `promo:alert` - Promotional alert
- `team:coordination` - Team coordination message
- `truck:location:updated` - Truck location changed

#### Events Listened by Clients:
- All above events for real-time UI updates
- Automatic reconnection on disconnect
- Room-based subscriptions (optional)

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **Yarn** 1.22.0 or higher
- **Expo CLI** (for mobile development)
- **iOS Simulator** (for iOS testing) or **Android Emulator** (for Android testing)
- **Git**

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd Food-Truck
```

2. **Install dependencies:**
```bash
yarn install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start the backend server:**
```bash
yarn server:start
# or for development with auto-reload
yarn server:dev
```

5. **Start the customer app:**
```bash
cd packages/customer-app
yarn start
```

6. **Start the admin app:**
```bash
cd packages/admin-app
yarn dev
```

## 🔧 Environment Configuration

### Backend Environment Variables

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
SENTRY_DSN=your-sentry-dsn
```

### Customer App Environment Variables

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_SOCKET_URL=http://localhost:3001
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_CLIENT_ID=default
```

### Admin App Environment Variables

```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_SENTRY_DSN=your-sentry-dsn
VITE_FIREBASE_API_KEY=your-firebase-key
VITE_FIREBASE_AUTH_DOMAIN=your-firebase-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_VAPID_KEY=your-vapid-key
```

## 📱 Mobile App Setup

### iOS Development

1. Install iOS dependencies:
```bash
cd packages/customer-app/ios
pod install
```

2. Run on iOS simulator:
```bash
cd packages/customer-app
yarn ios
```

### Android Development

1. Ensure Android Studio is installed
2. Start an emulator or connect a device
3. Run on Android:
```bash
cd packages/customer-app
yarn android
```

### Building for Production

**Using Expo EAS:**

```bash
cd packages/customer-app
eas build --platform ios --profile production
eas build --platform android --profile production
```

**Submit to App Stores:**
```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

## 🌐 Web App Setup

### Development

```bash
cd packages/admin-app
yarn dev
```

### Production Build

```bash
cd packages/admin-app
yarn build
```

The built files will be in `packages/admin-app/dist/`

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
cd packages/customer-app
yarn test

# Run with coverage
yarn test:coverage

# Watch mode
yarn test:watch
```

### E2E Tests

```bash
# Build for testing
yarn test:e2e:build-ios
yarn test:e2e:build-android

# Run tests
yarn test:e2e
```

### Coverage Goals

- **Branches**: 80%+
- **Functions**: 80%+
- **Lines**: 80%+
- **Statements**: 80%+

## 🚢 Deployment

### Mobile App (Expo EAS)

1. **Configure EAS:**
```bash
cd packages/customer-app
eas build:configure
```

2. **Build for production:**
```bash
eas build --platform all --profile production
```

3. **Submit to stores:**
```bash
eas submit --platform all --profile production
```

See `DEPLOYMENT.md` for detailed deployment guide.

### Web App & Backend (Vercel)

1. **Install Vercel CLI:**
```bash
npm install -g vercel
```

2. **Deploy:**
```bash
vercel --prod
```

Or use GitHub Actions for automatic deployments (see `.github/workflows/ci.yml`).

## 📊 Monitoring & Analytics

### Sentry Integration

- **Error Tracking** - Automatic error capture and reporting
- **Performance Monitoring** - Track app performance metrics
- **User Context** - Associate errors with users
- **Release Tracking** - Track errors by app version

### Performance Metrics

- Screen load times
- API request durations
- App startup time
- Memory usage
- Custom operation timings

## 🔐 Security Features

- JWT authentication with refresh tokens
- Password hashing with bcryptjs
- Secure token storage (AsyncStorage)
- Input validation with Zod schemas
- Rate limiting on notifications
- HTTPS in production
- CORS configuration
- Environment variable management

## 🌍 Internationalization

### Supported Languages

- **English (en)** - LTR
- **Spanish (es)** - LTR
- **French (fr)** - LTR
- **Arabic (ar)** - RTL

### Adding New Languages

1. Create translation file in `packages/customer-app/src/i18n/locales/[lang].json`
2. Add to i18n config in `packages/customer-app/src/i18n/config.ts`
3. Update RTL languages array if needed

## ♿ Accessibility

### Features

- Screen reader support (VoiceOver/TalkBack)
- ARIA labels on all interactive elements
- Minimum touch target sizes (44x44pt)
- WCAG AA color contrast compliance
- Keyboard navigation support
- RTL layout support

### Testing

- Use VoiceOver (iOS) or TalkBack (Android)
- Test with accessibility inspector tools
- Verify all actions are accessible
- Test keyboard navigation

## 📦 Package Structure

### Customer App (`packages/customer-app`)

```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
├── hooks/              # Custom React hooks
├── services/           # API and business logic
├── store/              # Redux store and slices
├── utils/              # Utility functions
├── i18n/               # Internationalization
└── config/             # App configuration
```

### Admin App (`packages/admin-app`)

```
src/
├── components/         # React components
├── pages/             # Page components
├── services/          # API services
├── utils/             # Utilities
└── i18n/              # Translations
```

### Shared Package (`packages/shared`)

```
src/
├── auth.ts            # Authentication types
├── menu.ts            # Menu types
├── order.ts           # Order types
├── truck.ts           # Truck types
├── offline.ts         # Offline utilities
└── index.ts           # Exports
```

## 🔄 Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches

### Commit Convention

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Build/tooling changes

### Code Quality

- ESLint for code linting
- Prettier for code formatting
- Husky for pre-commit hooks
- TypeScript for type safety
- 80%+ test coverage requirement

## 🛠️ Available Scripts

### Root Level

```bash
yarn customer:start     # Start customer app
yarn admin:dev         # Start admin app dev server
yarn admin:build       # Build admin app
yarn server:start      # Start backend server
yarn server:dev        # Start backend with nodemon
yarn lint              # Lint all packages
yarn format            # Format all code
```

### Customer App

```bash
yarn start             # Start Expo dev server
yarn android           # Run on Android
yarn ios               # Run on iOS
yarn test              # Run tests
yarn test:coverage     # Run tests with coverage
yarn test:e2e          # Run e2e tests
```

### Admin App

```bash
yarn dev               # Start dev server
yarn build             # Build for production
yarn preview           # Preview production build
yarn lint              # Lint code
```

## 📚 API Documentation

### Authentication Endpoints

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Signup
```http
POST /api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "password123"
}
```

### Menu Endpoints

#### Get All Menus
```http
GET /api/menus
Authorization: Bearer <token>
```

#### Create Menu Item (Admin)
```http
POST /api/menus
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Burger",
  "description": "Delicious burger",
  "price": 12.99,
  "category": "Burgers",
  "stock": 50,
  "isAvailable": true
}
```

### Order Endpoints

#### Create Order
```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "menuItemId": "1",
      "quantity": 2,
      "customizations": [],
      "specialInstructions": "No onions"
    }
  ],
  "pickupLocation": "123 Main St"
}
```

#### Update Order Status (Admin)
```http
PUT /api/orders/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "ready"
}
```

### Analytics Endpoints

#### Get Dashboard Analytics
```http
GET /api/analytics/dashboard?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin-token>
```

#### Export Analytics
```http
GET /api/analytics/export?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin-token>
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Maintain 80%+ code coverage
- Follow ESLint rules
- Update documentation
- Add TypeScript types
- Test on both iOS and Android (for mobile features)

## 📄 License

This project is private and proprietary.

## 🆘 Support

For issues and questions:
- Open an issue on GitHub
- Check documentation in `DEPLOYMENT.md`, `TESTING.md`, and `ACCESSIBILITY.md`
- Review API documentation above

## 🎯 Roadmap

### Planned Features

- [ ] Stripe payment integration (full implementation)
- [ ] Push notification delivery via Expo Push API
- [ ] Database integration (PostgreSQL/MySQL)
- [ ] Image upload to Cloudinary
- [ ] Advanced analytics and reporting
- [ ] Customer reviews and ratings
- [ ] Loyalty program
- [ ] Multi-truck management dashboard
- [ ] Driver mobile app
- [ ] Inventory management system

## 📞 Contact

For support: support@foodtruck.com

---

Built with ❤️ using React Native, React, Node.js, and modern web technologies.
