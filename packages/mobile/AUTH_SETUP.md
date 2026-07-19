# Authentication

MotionMeet Mobile uses a custom JWT-based authentication system. Session tokens are stored with `expo-secure-store`, attached to API requests via Axios interceptors, and passed to Socket.IO connections.

## Configuration

Required environment variables in `.env.local` / `.env.production`:

```env
EXPO_PUBLIC_BASEURL=http://localhost:5001
```

## How It Works

1. `AuthProvider` restores the saved JWT from `expo-secure-store`.
2. A request is made to `/auth/me` to fetch the user profile and validate the token.
3. The Axios interceptor automatically attaches the `Bearer` token for API requests.
4. On login/register, the new token is saved.
5. On logout, the token is cleared from secure storage.

## Run and verify

From the repository root:

```bash
corepack pnpm --filter @motionmeet/mobile start
corepack pnpm --filter @motionmeet/mobile typecheck
corepack pnpm --filter @motionmeet/mobile build
```

For a clean Metro restart, append `--clear` to the start command. Test OAuth on the target simulator/device and confirm that an authenticated API request and a Socket.IO reconnect both succeed.

