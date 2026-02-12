# Progressive Web App (PWA) Implementation

This document describes the PWA features that have been implemented for the Family Bookkeeping application, making it installable on iOS (iPhone/iPad) and other devices.

## Features Implemented

### 1. Web App Manifest (`/static/manifest.json`)
The manifest file provides metadata about the application:
- **name**: "Family Bookkeeping"
- **short_name**: "Bookkeeping"
- **display**: "standalone" (runs like a native app)
- **theme_color**: "#9fbec9" (matches app design)
- **background_color**: "#BBCDD3"
- **icons**: Multiple sizes (192x192, 512x512, 180x180) for different devices

### 2. iOS-Specific Meta Tags (`/src/app.html`)
Added to the HTML head for iPhone/iPad compatibility:
- `apple-mobile-web-app-capable`: Enables standalone mode
- `apple-mobile-web-app-status-bar-style`: Controls status bar appearance
- `apple-mobile-web-app-title`: Sets the name shown on home screen
- `apple-touch-icon`: Provides the app icon for iOS home screen
- `theme-color`: Sets the theme color for browsers

### 3. Service Worker (`/static/service-worker.js`)
Enables offline functionality and caching:
- Caches essential app resources
- Provides offline access to cached pages
- Implements cache-first strategy for better performance
- Automatically cleans up old caches

### 4. App Icons
Generated multiple icon sizes for different platforms:
- `apple-touch-icon.png` (180x180) - iOS home screen icon
- `icon-192.png` (192x192) - Android and PWA standard
- `icon-512.png` (512x512) - High-resolution displays

## How to Install on iPhone

1. Open Safari on your iPhone (not Chrome or other browsers)
2. Navigate to the app URL
3. Tap the Share button (square with arrow pointing up)
4. Scroll down and tap "Add to Home Screen"
5. Tap "Add" in the top right corner
6. The app icon will appear on your home screen

## Testing PWA Features

### Check Manifest
```bash
curl http://localhost:3000/manifest.json
```

### Check Service Worker
```bash
curl http://localhost:3000/service-worker.js
```

### Check Icons
```bash
curl -I http://localhost:3000/apple-touch-icon.png
curl -I http://localhost:3000/icon-192.png
curl -I http://localhost:3000/icon-512.png
```

## Generating Icons

If you need to regenerate the icons from the source favicon:
```bash
npm run generate-icons
```

This will create all required icon sizes from `/static/favicon.png`.

## Browser Support

- ✅ iOS Safari (iPhone/iPad)
- ✅ Android Chrome
- ✅ Desktop Chrome/Edge
- ✅ Desktop Safari
- ⚠️ iOS Chrome/Firefox (limited - must use Safari for full PWA features)

## Technical Details

### Viewport Settings
The viewport meta tag includes `viewport-fit=cover` for proper display on devices with notches (iPhone X and newer).

### Service Worker Registration
The service worker is automatically registered in `/src/routes/+layout.svelte` when the app loads. Check browser console for registration status.

### Cache Strategy
- **Install**: Caches essential resources (/, /dashboard, icons)
- **Fetch**: Cache-first with network fallback
- **Activate**: Cleans up old caches when a new version is deployed

## Future Enhancements

Consider adding:
- Push notifications support
- Background sync for offline data
- App shortcuts for common actions
- More sophisticated caching strategies
- Splash screens for iOS
