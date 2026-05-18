# Quick Start: PWA Update Button

## What Was Added

A floating "Check for Updates" button in the bottom-right corner of your app that:
- ✅ Lets users manually check for app updates
- ✅ Shows a notification when updates are available
- ✅ Installs updates with one click
- ✅ Automatically reloads the app with new content

## Files Added

```
src/
├── hooks/
│   └── usePWAUpdate.ts          # Hook managing service worker updates
├── components/
│   └── UpdateButton.tsx         # Update button UI component
public/
└── sw-custom.js                 # Service worker message handler
```

## Files Modified

- `src/app/layout.tsx` - Added UpdateButton component
- `next.config.ts` - Changed skipWaiting to false for manual control

## How to Test

### Development
The update feature is **disabled in development mode** (by design in next.config.ts).

### Production Testing

1. **Build and run production:**
   ```bash
   npm run build
   npm start
   ```

2. **Open in browser:**
   - Navigate to http://localhost:3000
   - Install as PWA (if not already)

3. **Make a change:**
   - Edit any file (e.g., change a color or text)
   - Keep the app open in browser

4. **Build again:**
   ```bash
   npm run build
   ```

5. **In the browser:**
   - Click "🔄 Check Updates" button (bottom-right)
   - Button should change to "⬇️ Install Update" (green, pulsing)
   - Click "Install Update"
   - App reloads with your changes

## Visual States

### State 1: No Update Available
```
┌─────────────────────┐
│  🔄 Check Updates   │  ← Small, subtle button
└─────────────────────┘
```

### State 2: Checking for Updates
```
┌─────────────────────┐
│  ⟳ Checking...      │  ← Spinning icon
└─────────────────────┘
```

### State 3: Update Available
```
┌─────────────────────┐
│  ⬇️ Install Update  │  ← Green, pulsing, prominent
└─────────────────────┘

        ┌──────────────────────────┐
        │ 🎉 New update available! │  ← Toast at top
        └──────────────────────────┘
```

### State 4: Installing Update
```
┌─────────────────────┐
│  ⟳ Updating...      │  ← Spinning, then reloads
└─────────────────────┘
```

## User Instructions

Tell your users:

> **"To get the latest version of the app:**
> 1. Look for the update button in the bottom-right corner
> 2. Tap 'Check Updates'
> 3. If an update is available, tap 'Install Update'
> 4. The app will refresh automatically"

## Deployment Workflow

When you deploy updates:

1. **Deploy your changes** to your hosting platform
2. **Notify users** (optional): "New version available! Tap the update button to refresh"
3. **Users click** the update button
4. **App updates** automatically

## Customization

### Change Button Position

Edit `src/components/UpdateButton.tsx`, line 32:

```tsx
// Bottom-left instead of bottom-right
<div className="fixed bottom-6 left-6 z-50">

// Top-right
<div className="fixed top-6 right-6 z-50">

// Top-left
<div className="fixed top-6 left-6 z-50">
```

### Auto-Check on App Open

Edit `src/hooks/usePWAUpdate.ts`, add to the main useEffect:

```typescript
useEffect(() => {
  // ... existing code ...
  
  // Auto-check when app opens
  checkForUpdate();
}, []);
```

### Change Button Text

Edit `src/components/UpdateButton.tsx`:

```tsx
// Line 48 - Change "Check Updates" text
Check for Updates

// Line 38 - Change "Install Update" text
Update Now
```

## Troubleshooting

**Button not showing?**
- Build in production mode: `npm run build && npm start`
- Check browser console for errors

**Update not detected?**
- Ensure files actually changed
- Clear service worker: DevTools > Application > Service Workers > Unregister
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

**Button shows but update doesn't work?**
- Check `next.config.ts` has `skipWaiting: false`
- Verify `sw-custom.js` exists in public folder
- Check browser console for service worker errors

## Need Help?

See `UPDATE_FEATURE.md` for detailed technical documentation.
