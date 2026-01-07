# Deployment Guide

## Overview

This project uses:
- **Expo EAS** for mobile app builds and distribution
- **Vercel** for web/admin app and backend deployment
- **Sentry** for error tracking and performance monitoring
- **GitHub Actions** for CI/CD automation

## Environment Configuration

### Environment Variables

Create environment-specific `.env` files:

- `.env.development` - Local development
- `.env.staging` - Staging environment
- `.env.production` - Production environment

See `.env.example` for required variables.

### Setting Up Secrets

#### GitHub Secrets

Add these secrets in GitHub repository settings:

- `EXPO_TOKEN` - Expo access token
- `EAS_PROJECT_ID` - Expo EAS project ID
- `SENTRY_DSN` - Sentry DSN for error tracking
- `SENTRY_ORG` - Sentry organization slug
- `SENTRY_PROJECT` - Sentry project slug
- `SENTRY_AUTH_TOKEN` - Sentry authentication token
- `VERCEL_TOKEN` - Vercel deployment token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID (admin app)
- `VERCEL_BACKEND_PROJECT_ID` - Vercel project ID (backend)
- `PRODUCTION_API_URL` - Production API URL
- `STAGING_API_URL` - Staging API URL
- `PRODUCTION_SOCKET_URL` - Production Socket URL
- `STAGING_SOCKET_URL` - Staging Socket URL

#### Expo EAS Setup

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Initialize EAS:
```bash
cd packages/customer-app
eas build:configure
```

4. Link project:
```bash
eas init
```

## Mobile App Deployment (Expo EAS)

### Build Profiles

- **development** - Development client builds
- **preview** - Internal testing builds (APK/IPA)
- **staging** - Staging environment builds
- **production** - Production App Store/Play Store builds

### Building for iOS

```bash
# Preview build
eas build --platform ios --profile preview

# Production build
eas build --platform ios --profile production
```

### Building for Android

```bash
# Preview build
eas build --platform android --profile preview

# Production build
eas build --platform android --profile production
```

### Submitting to App Stores

```bash
# iOS App Store
eas submit --platform ios --profile production

# Google Play Store
eas submit --platform android --profile production
```

### Environment-Specific Builds

Builds automatically use environment variables based on the profile:
- `preview` → `EXPO_PUBLIC_ENV=staging`
- `production` → `EXPO_PUBLIC_ENV=production`

## Web/Backend Deployment (Vercel)

### Prerequisites

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

### Manual Deployment

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Automatic Deployment

Deployment happens automatically via GitHub Actions on:
- `main` branch → Production
- `develop` branch → Staging

### Environment Variables in Vercel

Set environment variables in Vercel dashboard:
- Production environment
- Preview environment
- Development environment

## Error Monitoring (Sentry)

### Setup

1. Create Sentry account at https://sentry.io
2. Create a new project (React Native)
3. Get DSN from project settings
4. Add DSN to environment variables

### Configuration

Sentry is automatically initialized in `App.js`. Configuration in `src/utils/sentry.ts`:
- Error tracking enabled
- Performance monitoring enabled (20% sample rate in production)
- Auto session tracking
- Screenshot attachment

### Using Sentry in Code

```tsx
import { captureException, trackEvent, setSentryUser } from './utils/sentry';

// Track errors
try {
  // risky operation
} catch (error) {
  captureException(error, { context: 'additional info' });
}

// Track events
trackEvent('user_action', { action: 'button_click' });

// Set user context
setSentryUser({ id: '123', email: 'user@example.com' });
```

## CI/CD Pipeline

### GitHub Actions Workflows

#### Main CI Pipeline (`.github/workflows/ci.yml`)

Runs on every push/PR:
1. **Lint & Test** - Runs linters and unit tests
2. **Build Customer App** - Builds mobile app with EAS (on push only)
3. **Build Admin App** - Builds and deploys admin app to Vercel
4. **Deploy Backend** - Deploys backend to Vercel

#### E2E Tests (`.github/workflows/e2e.yml`)

Runs on:
- Push to main/develop
- Pull requests
- Daily schedule (2 AM UTC)

Tests:
- iOS E2E tests
- Android E2E tests

### Workflow Triggers

- **Push to `main`** → Production builds and deployments
- **Push to `develop`** → Staging builds and deployments
- **Pull Request** → Lint, test, and preview builds only

## Performance Monitoring

### Metrics Tracked

1. **Screen Load Times** - Automatic tracking
2. **API Request Durations** - Track API performance
3. **Custom Operations** - Measure any async operation
4. **App Startup Time** - Track initial load
5. **Memory Usage** - Monitor memory consumption

### Using Performance Tracking

```tsx
import { trackScreenLoad, measureAsync, trackApiRequest } from './utils/performance';

// Track screen load
useEffect(() => {
  const startTime = performance.now();
  // ... load screen
  trackScreenLoad('MenuScreen', performance.now() - startTime);
}, []);

// Measure async operation
const data = await measureAsync('fetchMenu', async () => {
  return await fetch('/api/menus');
});

// Track API request
const startTime = performance.now();
const response = await fetch('/api/orders');
trackApiRequest('/api/orders', performance.now() - startTime, response.ok);
```

## Deployment Checklist

### Before Production Deployment

- [ ] All environment variables set
- [ ] Secrets configured in GitHub
- [ ] EAS project linked
- [ ] Vercel projects created
- [ ] Sentry project configured
- [ ] App Store/Play Store accounts ready
- [ ] Testing completed in staging
- [ ] Performance monitoring verified

### Post-Deployment

- [ ] Verify production builds are available
- [ ] Check Sentry dashboard for errors
- [ ] Monitor performance metrics
- [ ] Test critical user flows
- [ ] Verify analytics tracking
- [ ] Check error rates

## Rollback Procedures

### Mobile App

1. **Expo EAS**: Use previous build from EAS dashboard
2. **App Stores**: Submit previous version via App Store Connect / Play Console

### Web/Backend

1. **Vercel**: Use deployment history to rollback
   ```bash
   vercel rollback <deployment-url>
   ```

### GitHub Actions

- Failed deployments won't affect production
- Monitor workflow status in GitHub Actions tab

## Monitoring and Alerts

### Sentry Alerts

Configure alerts in Sentry dashboard:
- Error rate thresholds
- Performance degradation
- New error types
- Spike in issues

### Performance Metrics

Monitor in Sentry Performance:
- P50, P75, P95, P99 latencies
- Throughput
- Error rates
- User sessions

## Troubleshooting

### Build Failures

1. Check EAS build logs in Expo dashboard
2. Verify environment variables are set
3. Check for dependency conflicts
4. Review recent code changes

### Deployment Failures

1. Check GitHub Actions logs
2. Verify Vercel configuration
3. Check environment variables
4. Review `vercel.json` configuration

### Sentry Issues

1. Verify DSN is correct
2. Check Sentry project configuration
3. Verify network access from app
4. Check for rate limiting

## Resources

- [Expo EAS Documentation](https://docs.expo.dev/build/introduction/)
- [Vercel Documentation](https://vercel.com/docs)
- [Sentry React Native](https://docs.sentry.io/platforms/react-native/)
- [GitHub Actions](https://docs.github.com/en/actions)
