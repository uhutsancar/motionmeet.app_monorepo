# MotionMeet proje mimarisi

MotionMeet; pnpm workspaces ve Turborepo kullanan, uçtan uca strict TypeScript
bir sosyal fitness monoreposudur.

## Backend (`packages/backend`)

Express 5 HTTP API ve Socket.IO sunucusudur. Veri erişimi Kysely üzerinden
PostgreSQL'e yapılır. Katmanlar:

- `configs/`: ortam doğrulaması, PostgreSQL pool, Redis, S3, e-posta ve upload
- `db/`: tipli tablo sözleşmeleri, migration'lar ve migration runner
- `repositories/`: SQL sorguları ve API entity dönüşümleri
- `services/`: transaction, kota, cache invalidation ve domain kuralları
- `controllers/` ve `routes/`: HTTP sözleşmesi, doğrulama ve yetkilendirme
- `realtime/`: Socket.IO olayları ve Redis adapter
- `workers/`: outbox, süresi dolan story/upload ve medya silme işleri

PostgreSQL; kullanıcılar, planlar, egzersizler, rutinler, antrenmanlar,
gönderiler, hikâyeler, sosyal ilişkiler, konuşmalar, mesajlar, oturumlar,
analitik tablolar ve dayanıklı arka plan işlerinin tek kalıcı veri kaynağıdır.
Redis yalnızca cache, rate limit ve koordinasyon içindir. Görsel/video binary
içeriği S3/CDN'de kalır; veritabanında object key, URL ve metadata tutulur.

## Web (`packages/web`)

React 19, Vite, MUI, Redux Toolkit ve React Router tabanlı `.ts/.tsx`
uygulamasıdır. `src/api` ortak HTTP istemcisini, `src/features` tipli store
slicelarını, `src/context` auth/socket/theme durumlarını içerir.

## Mobile (`packages/mobile`)

Expo SDK, React Native, React Navigation, React Native Paper ve Redux Toolkit
kullanan `.ts/.tsx` istemcidir. API, auth, socket, upload ve navigation
sözleşmeleri tiplenmiştir. Kamera/galeri medyası imzalı upload akışıyla S3'e
gönderilir.

## Shared (`packages/shared`)

Backend, web ve mobile tarafından kullanılan API route'ları, domain/API tipleri,
limitler, görünürlük kuralları ve medya URL yardımcılarını yayınlar. Paket önce
`dist` dizinine derlenir; diğer workspace build'leri bu çıktıya bağlıdır.

## Altyapı

- Development Compose: PostgreSQL 18, Redis, backend ve web; mobile opsiyonel.
- Production Compose: derlenmiş backend ve statik web imajları; yönetilen
  PostgreSQL/Redis servisleri `DATABASE_URL` ve `REDIS_URL` ile bağlanır.
- Backend başlangıcında migration'lar idempotent uygulanır ve readiness endpointi
  PostgreSQL durumunu, Redis fallback durumundan ayrı raporlar.

Temel environment değişkenleri `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`,
`FRONTEND_URL`, `CORS_ORIGINS` ve opsiyonel S3/ImageKit/SMTP değerleridir.
