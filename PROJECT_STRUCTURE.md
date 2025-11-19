# MotionMeet Project Structure

```
motionmeet.app/
├── package.json                 # Root workspace configuration
├── .gitignore                  # Git ignore rules
├── README.md                   # Main project documentation
├── PROJECT_STRUCTURE.md        # This file
│
└── packages/                   # All packages in the monorepo
    │
    ├── backend/                # Express.js + MongoDB backend
    │   ├── package.json
    │   ├── server.js           # Entry point
    │   ├── jest.config.js      # Jest configuration
    │   ├── README.md
    │   ├── src/
    │   │   ├── app.js          # Express app setup
    │   │   ├── config/
    │   │   │   └── database.js # MongoDB connection
    │   │   └── routes/
    │   │       └── index.js    # API routes
    │   └── tests/
    │       └── app.test.js     # Backend tests
    │
    ├── web/                    # React web application
    │   ├── package.json
    │   ├── index.html
    │   ├── vite.config.js      # Vite configuration
    │   ├── vitest.config.js    # Vitest configuration
    │   ├── tailwind.config.js  # Tailwind CSS config
    │   ├── postcss.config.js   # PostCSS config
    │   ├── README.md
    │   ├── src/
    │   │   ├── main.jsx        # React entry point
    │   │   ├── App.jsx         # Main App component
    │   │   ├── index.css       # Global styles
    │   │   └── components/
    │   │       └── Hello.jsx   # Example component
    │   └── tests/
    │       ├── App.test.jsx    # Web tests
    │       └── setup.js        # Test setup
    │
    ├── mobile/                 # React Native Expo app
    │   ├── package.json
    │   ├── App.js              # Main App component
    │   ├── app.json            # Expo configuration
    │   ├── babel.config.js     # Babel configuration
    │   ├── jest.config.js      # Jest configuration
    │   ├── README.md
    │   ├── assets/             # App assets (icons, images)
    │   ├── src/
    │   │   └── components/
    │   │       └── Hello.js    # Example component
    │   └── tests/
    │       └── App.test.js     # Mobile tests
    │
    └── shared/                 # Shared utilities and configs
        ├── package.json
        ├── index.js            # Main entry point
        ├── jest.config.js      # Jest configuration
        ├── README.md
        ├── config/
        │   ├── index.js        # General config
        │   ├── api.js          # API configuration
        │   └── tailwind.config.js # Shared Tailwind config
        ├── api/
        │   ├── index.js        # API exports
        │   └── client.js       # Axios API client
        ├── database/
        │   ├── index.js        # Database exports
        │   └── connection.js   # MongoDB connection utilities
        └── tests/
            └── api.test.js     # Shared package tests
```

## Key Features

- **Monorepo**: All packages managed in a single repository using npm workspaces
- **Shared Code**: Common configurations, API clients, and database utilities in `packages/shared`
- **Testing**: Each package has its own test setup and test files
- **Single Command**: Run all services with `npm run all`
- **Separate Components**: Web and mobile components are in separate directories

## Running the Project

1. Install dependencies: `npm install`
2. Start all services: `npm run all`
3. Or start individually:
   - Backend: `npm run dev:backend`
   - Web: `npm run dev:web`
   - Mobile: `npm run dev:mobile`

