# @motionmeet/mobile

MotionMeet mobile application built with React Native and Expo. This mobile app mirrors the web application's functionality, providing users with a native mobile experience for the MotionMeet social platform.

## Features

- **Feed**: View posts and stories from connections
- **Messages**: Chat with connections in real-time
- **Connections**: Manage followers, following, and connections
- **Discover**: Find and connect with new people
- **Profile**: View and edit your profile
- **Create Post**: Share posts with text and images

## Project Structure

```
src/
├── api/              # API client configuration
├── app/              # Redux store configuration
├── assets/           # Shared assets and dummy data
├── components/       # Reusable UI components
│   ├── Loading.js    # Loading indicator
│   ├── PostCard.js   # Post display card
│   └── UserCard.js   # User profile card
├── features/         # Redux slices
│   ├── user/         # User state management
│   ├── connections/  # Connections state
│   └── messages/     # Messages state
├── navigation/       # React Navigation setup
│   └── RootNavigator.js
└── pages/            # Screen components
    ├── Login.js
    ├── Feed.js
    ├── Messages.js
    ├── ChatBox.js
    ├── Connections.js
    ├── Discover.js
    ├── Profile.js
    └── CreatePost.js
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

This will start the Expo development server. You can then:
- Press `a` to open on Android emulator
- Press `i` to open on iOS simulator  
- Press `w` to open in web browser
- Scan QR code with Expo Go app on your device

## Available Scripts

```bash
# Start development server
npm run dev

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on Web
npm run web

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Dependencies

### Core
- `expo` - Development framework
- `react-native` - Mobile UI framework
- `react` - Core React library

### Navigation
- `@react-navigation/native` - Navigation core
- `@react-navigation/native-stack` - Stack navigation
- `@react-navigation/bottom-tabs` - Tab navigation
- `react-native-screens` - Native screen support
- `react-native-safe-area-context` - Safe area handling

### State Management
- `@reduxjs/toolkit` - Redux state management
- `react-redux` - React Redux bindings

### Utilities
- `axios` - HTTP client
- `moment` - Date/time formatting

## Shared Code with Web

The mobile app shares the following with the web application:
- **Data structures**: Same user, post, message, and connection models
- **API endpoints**: Same backend API calls
- **Redux state**: Similar state management patterns
- **Assets**: Shared dummy data for development

## Testing

```bash
npm test
```

## Assets

Add the following assets to the `assets/` folder:
- `icon.png` - App icon (1024x1024)
- `splash.png` - Splash screen
- `adaptive-icon.png` - Android adaptive icon
- `favicon.png` - Web favicon


