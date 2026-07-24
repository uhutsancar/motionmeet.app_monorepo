# Production deployment

Create an untracked `.env.production` beside `docker-compose.prod.yml`. Do not
reuse development credentials. The API refuses to boot if `MONGODB_URL`,
`JWT_SECRET`, `REDIS_URL`, and an allowed browser origin are unavailable.
MongoDB must run as a replica set (Atlas qualifies) because permanent account
deletion uses a transaction to keep cross-collection erasure atomic.

Required values:

```dotenv
MONGODB_URL=mongodb+srv://...
MONGODB_DB_NAME=motionmeet
JWT_SECRET=<at-least-32-random-bytes>
FRONTEND_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
AWS_BUCKET_NAME=...
IMAGEKIT_PUBLIC_KEY=...
IMAGEKIT_PRIVATE_KEY=...
IMAGEKIT_URL_ENDPOINT=...
SMTP_USER=...
SMTP_PASS=...
SENDER_EMAIL=...
```

`REDIS_URL` defaults to the private Redis service in the production Compose
file. Terminate TLS at the public load balancer or reverse proxy; refresh
cookies are `Secure` in production.

The S3 bucket must allow browser/mobile `PUT` requests from the application
origins and expose `Content-Type` to clients. Keep the bucket private: clients
receive five-minute, single-object signed URLs and reads go through ImageKit.

Before the first deployment of this version:

1. Back up MongoDB.
2. Build the backend image with
   `docker compose -f docker-compose.prod.yml build backend`.
3. Run
   `docker compose -f docker-compose.prod.yml run --rm backend node scripts/migrateDataIntegrity.js`
   and resolve any reported email, username, or connection-pair conflicts.
   The report also shows legacy embedded post interactions that will be moved.
   Assign or remove any reported custom exercises without an owner; they stay
   hidden from users until ownership is resolved.
4. Run
   `docker compose -f docker-compose.prod.yml run --rm backend node scripts/migrateDataIntegrity.js --apply`.
   This also creates the production indexes after data conflicts are resolved.
5. Deploy and verify `/health/ready`.

Rotate any credential that has appeared in terminal output, logs, chat, issue
trackers, or other non-secret storage. Rotation must be performed in the
respective MongoDB, AWS, ImageKit, SMTP, and deployment control planes; editing
an environment file alone does not revoke an exposed credential.
