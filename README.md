# MotionMeet

A social media app for athletes to share custom workouts, upload images and videos, and connect with others.

## Architecture

This is a monorepo containing:
- **Backend**: Node.js + Express.js + MongoDB
- **Web Frontend**: React
- **Mobile App**: React Native with Expo
- **Shared**: Common configurations, API utilities, and database connections

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB (local or cloud instance)

### Installation

```bash
npm install
```

This will install all dependencies for all packages in the monorepo.

### Running the Application

To run all services (backend, web, and mobile) simultaneously:

```bash
npm run all
```

Or run individually:
- `npm run dev:backend` - Start backend server
- `npm run dev:web` - Start web frontend
- `npm run dev:mobile` - Start mobile app (Expo)

### Testing

Run all tests:
```bash
npm test
```

Run tests for specific packages:
- `npm run test:backend`
- `npm run test:web`
- `npm run test:mobile`

## Project Structure

```
motionmeet.app/
├── packages/
│   ├── backend/          # Express.js backend
│   ├── web/              # React web application
│   ├── mobile/           # React Native Expo app
│   └── shared/           # Shared configurations and utilities
└── package.json          # Root workspace configuration
```

## Technologies

- **Backend**: Node.js, Express.js, MongoDB
- **Web**: React, Vite
- **Mobile**: React Native, Expo
- **Styling**: Tailwind CSS (shared config)
- **Monorepo**: npm workspaces

