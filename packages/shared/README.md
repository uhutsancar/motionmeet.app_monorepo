# @motionmeet/shared

Shared utilities, configurations, and common code for the MotionMeet monorepo.

## Structure

- `config/` - Shared configurations (Tailwind, API settings)
- `api/` - API client and endpoint definitions
- `database/` - Database connection utilities

## Usage

Import shared utilities in your packages:

```javascript
const { api, database, config } = require('@motionmeet/shared');
```

