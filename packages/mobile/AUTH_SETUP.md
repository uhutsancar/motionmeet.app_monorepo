# Authentication Setup Guide

## Overview
MotionMeet Mobile uses **Clerk** for authentication, matching the web app's implementation. Users can sign in with Google or GitHub OAuth providers.

## Setup Complete ✅

### 1. Packages Installed
```json
"@clerk/clerk-expo": "^2.9.1",
"expo-secure-store": "~14.0.0",
"expo-web-browser": "~14.0.1"
```

### 2. Files Created/Updated

#### App.js
- Wrapped app with `ClerkProvider`
- Configured `tokenCache` using `expo-secure-store`
- Uses `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` from environment

#### .env
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cmF0aW9uYWwtaW1wYWxhLTgxLmNsZXJrLmFjY291bnRzLmRldiQ
```

#### src/navigation/AuthNavigator.js
- Root navigator component
- Uses `useAuth()` hook from Clerk
- Manages auth state (loading, signed in, signed out)
- Sets auth token in API client when signed in
- Fetches user data from backend on sign in
- Shows loading screen while initializing
- Conditionally renders `AppNavigator` (authenticated) or `Login` (not authenticated)

#### src/pages/Login.js
- OAuth login screen
- Google sign-in button (red theme)
- GitHub sign-in button (dark theme)
- Uses `useOAuth()` hook with strategies
- WebBrowser integration for OAuth flow
- Branding with logo, app name, user stats
- Terms of service text

#### src/api/client.js
- Added `setAuthToken()` function
- Request interceptor adds Bearer token to all API calls
- Token is cleared on sign out

#### src/pages/Profile.js
- Added "Sign Out" button
- Uses `useAuth()` hook's `signOut()` method
- Confirmation alert before signing out

## How It Works

### Authentication Flow

1. **App Launch**
   - `ClerkProvider` initializes with publishable key
   - `AuthNavigator` checks auth status
   - Shows loading screen while checking

2. **Not Authenticated**
   - Displays `Login` screen
   - User clicks Google or GitHub button
   - OAuth flow opens in WebBrowser
   - User authorizes in browser
   - Returns to app with token
   - Clerk stores token in SecureStore

3. **Authenticated**
   - `AuthNavigator` detects sign in
   - Gets token from Clerk: `await getToken()`
   - Sets token in API client: `setAuthToken(token)`
   - Dispatches `fetchUser()` to load user data
   - Renders `AppNavigator` (main app)

4. **Sign Out**
   - User clicks "Sign Out" in Profile
   - Confirmation alert shown
   - Calls `await signOut()`
   - Token cleared from API client
   - Returns to Login screen

### API Integration

All API requests automatically include the Clerk token:

```javascript
// In client.js
api.interceptors.request.use(async (config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});
```

Backend receives token and verifies with Clerk:

```javascript
// Backend middleware
const { clerkClient } = require('@clerk/clerk-sdk-node');

async function authenticateUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = await clerkClient.verifyToken(token);
  req.userId = user.sub;
  next();
}
```

## Testing Authentication

### Prerequisites
- iOS Simulator or Android Emulator (OAuth requires device/simulator)
- OR physical device with Expo Go app
- Backend server running with Clerk configured

### Steps

1. **Start Metro Bundler**
   ```bash
   cd packages/mobile
   npm start
   ```

2. **Run on Device/Simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - OR scan QR code with Expo Go on physical device

3. **Test Login Flow**
   - App should show Login screen
   - Click "Continue with Google" or "Continue with GitHub"
   - Browser opens for OAuth
   - Authorize the app
   - Returns to app
   - Should see loading then main app (Feed page)

4. **Test Authenticated State**
   - Navigate to Profile tab
   - Should see your user info
   - Click "Sign Out"
   - Confirm in alert
   - Should return to Login screen

5. **Test Token Integration**
   - While signed in, try creating a post
   - Backend should receive valid token
   - Check backend logs for token verification
   - Post should create successfully

## Environment Variables

Required in `.env`:

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Get this from:
1. Go to https://dashboard.clerk.com
2. Select your project
3. Navigate to "API Keys"
4. Copy "Publishable Key"
5. Add to `.env` with `EXPO_PUBLIC_` prefix

## OAuth Providers

### Google
- Configured in Clerk dashboard
- Scopes: email, profile
- Redirect URL handled by Clerk

### GitHub
- Configured in Clerk dashboard
- Scopes: user:email, read:user
- Redirect URL handled by Clerk

## Troubleshooting

### "Expo_Public_Clerk_Publishable_Key is not defined"
- Make sure `.env` file exists in `packages/mobile/`
- Restart Metro bundler after adding `.env`
- Clear cache: `npm start -- --clear`

### OAuth Opens But Doesn't Return to App
- On physical device: Make sure you're using Expo Go
- On simulator: Try restarting simulator
- Check that `expo-web-browser` is installed

### "Token verification failed"
- Check backend has same Clerk project
- Verify backend secret key matches project
- Check token hasn't expired (default 1 hour)

### App Stuck on Loading Screen
- Check console for errors
- Verify Clerk publishable key is correct
- Try signing out from Clerk dashboard and re-signing in

### API Calls Fail After Sign In
- Check `setAuthToken()` is called in AuthNavigator
- Verify token is in request headers (check network tab)
- Check backend auth middleware is working

## Security Notes

- ✅ Tokens stored in `expo-secure-store` (encrypted)
- ✅ HTTPS only for OAuth redirects
- ✅ Token automatically refreshed by Clerk
- ✅ Token cleared on sign out
- ✅ Backend verifies every token
- ✅ No passwords stored (OAuth only)

## Next Steps

### Optional Enhancements

1. **Add Profile Photo from OAuth**
   ```javascript
   // In AuthNavigator after sign in
   const { imageUrl } = user;
   dispatch(updateUser({ profile_photo: imageUrl }));
   ```

2. **Add Email Display**
   ```javascript
   const { emailAddresses } = user;
   const email = emailAddresses[0]?.emailAddress;
   ```

3. **Add Session Management**
   ```javascript
   // Refresh token every 30 minutes
   useEffect(() => {
     const interval = setInterval(async () => {
       const token = await getToken();
       setAuthToken(token);
     }, 30 * 60 * 1000);
     return () => clearInterval(interval);
   }, []);
   ```

4. **Add Biometric Auth**
   ```bash
   npx expo install expo-local-authentication
   ```

5. **Add Remember Me**
   - Already handled by Clerk's token cache
   - Users stay signed in until they sign out

## Backend Sync

When a user signs in for the first time, the backend should:

1. Check if user exists in MongoDB
2. If not, create user document with Clerk ID
3. Sync profile data from Clerk (name, email, photo)
4. Return user data to mobile app

Example backend code:

```javascript
router.post('/auth/sync', async (req, res) => {
  const { userId } = req.auth; // From Clerk middleware
  const clerkUser = await clerkClient.users.getUser(userId);
  
  let user = await User.findOne({ clerk_id: userId });
  
  if (!user) {
    user = await User.create({
      clerk_id: userId,
      username: clerkUser.username,
      email: clerkUser.emailAddresses[0].emailAddress,
      full_name: `${clerkUser.firstName} ${clerkUser.lastName}`,
      profile_photo: clerkUser.imageUrl,
    });
  }
  
  res.json(user);
});
```

## Support

If you encounter issues:

1. Check Clerk dashboard for errors
2. Review backend logs for token verification
3. Check mobile app console for errors
4. Verify environment variables are set
5. Try clearing app data and re-signing in

## Resources

- [Clerk Expo Documentation](https://clerk.com/docs/quickstarts/expo)
- [Clerk Dashboard](https://dashboard.clerk.com)
- [OAuth Flow Guide](https://clerk.com/docs/authentication/social-connections)
- [Token Management](https://clerk.com/docs/references/react/use-auth)
