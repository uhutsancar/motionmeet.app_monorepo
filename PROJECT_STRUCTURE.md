# MotionMeet — kapsamlı proje yapısı ve mimari referansı

> Son kaynak incelemesi: 2 Ağustos 2026
>
> Repository türü: pnpm workspace + Turborepo monorepo
>
> Ana amaç: antrenman takibi ile sosyal fitness deneyimini web ve mobil istemcilerde aynı API sözleşmesi üzerinden sunmak

Bu belge MotionMeet repository'sine ilk kez bakan bir geliştiricinin projenin ne
yaptığını, hangi parçanın neden var olduğunu, verinin nerede tutulduğunu, bir
isteğin sistemde nasıl ilerlediğini, yerel ve production ortamlarının nasıl
çalıştığını tek kaynaktan anlayabilmesi için hazırlanmıştır. Buradaki açıklamalar
yalnız klasör adlarına değil, mevcut kaynak kodun gerçek davranışına dayanır.

## 1. Ürünün amacı ve kapsamı

MotionMeet, fitness takibini sosyal ağ özellikleriyle birleştiren uçtan uca
TypeScript bir uygulamadır. Kullanıcılar:

- hesap oluşturabilir, giriş yapabilir, oturumlarını yenileyebilir ve parola
  sıfırlayabilir;
- profil, kapak görseli, fiziksel bilgiler ve gizlilik tercihlerini yönetebilir;
- egzersiz kataloğunu arayabilir, filtreleyebilir ve izin verilen planlarda kendi
  egzersizlerini oluşturabilir;
- sıralı egzersiz ve setlerden rutin hazırlayabilir;
- antrenman kaydedebilir; süre, hacim, tekrar, set, kas dağılımı, seri ve kişisel
  rekor istatistiklerini görebilir;
- metin, görsel, video veya antrenman bağlantılı gönderi paylaşabilir;
- gönderileri beğenebilir, yorumlayabilir ve görünürlük kurallarına göre feed
  görüntüleyebilir;
- 24 saatlik hikâyeler oluşturabilir ve görüntüleyebilir;
- kullanıcıları takip edebilir, bağlantı isteği gönderebilir ve kabul edebilir;
- gerçek zamanlı mesajlaşabilir, yazıyor ve çevrim içi durumlarını görebilir;
- plan özellikleri ve kotalarına göre ürün yeteneklerini kullanabilir;
- verilerini JSON olarak dışa aktarabilir ve hesabını ilişkili verilerle birlikte
  silebilir.

Ürün üç çalıştırılabilir uygulama ve iki destek paketi etrafında kuruludur:

1. `packages/backend`: REST API, Socket.IO, PostgreSQL veri katmanı, Redis,
   medya ve background job'lar.
2. `packages/web`: tarayıcı uygulaması.
3. `packages/mobile`: Expo/React Native Android, iOS ve sınırlı web istemcisi.
4. `packages/shared`: istemciler ile sunucunun ortak tipleri ve API sabitleri.
5. `tools/database-migration`: eski MongoDB verisini PostgreSQL'e tek seferlik,
   çevrim dışı taşıma ve doğrulama aracı.

## 2. Büyük resim

```mermaid
flowchart LR
    WEB[React web\nVite + MUI] -->|HTTPS REST| API[Express 5 API]
    MOBILE[Expo / React Native] -->|HTTPS REST| API
    WEB <-->|WSS Socket.IO| SOCKET[Socket.IO sunucusu]
    MOBILE <-->|WSS Socket.IO| SOCKET
    API --> PG[(PostgreSQL 18\nkalıcı kaynak)]
    SOCKET --> PG
    API -. cache / rate limit / lock .-> REDIS[(Redis 7.4\ngeçici katman)]
    SOCKET -. pub/sub adapter .-> REDIS
    API -->|presigned PUT / HEAD / range read / delete| S3[(AWS S3\nmedya nesneleri)]
    WEB -->|presigned PUT| S3
    MOBILE -->|presigned PUT| S3
    S3 --> CDN[ImageKit/CDN\ndönüştürülmüş public URL]
    API --> SMTP[Brevo SMTP\nparola ve bağlantı e-postaları]
    SHARED[@motionmeet/shared] --> WEB
    SHARED --> MOBILE
    SHARED --> API
```

Temel mimari kararı şudur:

- **PostgreSQL tek kalıcı uygulama veri kaynağıdır.**
- **Redis kalıcı kayıt deposu değildir.** Cache, rate limit, Socket.IO pub/sub ve
  kısa süreli dağıtık lock için kullanılır.
- **Binary medya PostgreSQL'e yazılmaz.** S3'te nesne olarak kalır; PostgreSQL
  yalnızca object key, public URL, MIME türü, boyut ve ilişkisel metadata tutar.
- **Web ve mobile doğrudan veritabanına bağlanmaz.** Bütün erişim Express REST API
  ve Socket.IO üzerinden yapılır.
- **İstemciler DB satır tiplerini bilmez.** Dış sözleşmeler `@motionmeet/shared`
  paketinde tanımlanır.
- **Eski MongoDB production runtime'ın parçası değildir.** MongoDB sürücüsü
  yalnızca izole migration workspace'inde eski veriyi okumak için bulunur.

## 3. Ana dizin ağacı

```text
motionmeet.app_monorepo/
├─ .github/workflows/ci.yml       # GitHub Actions doğrulama hattı
├─ docs/                          # DB, production, OpenAPI ve responsive notları
├─ exercises-dataset-main/        # Yerel/ignore edilen egzersiz veri snapshot'ı
├─ packages/
│  ├─ backend/                    # Express + Socket.IO + PostgreSQL uygulaması
│  ├─ web/                        # React/Vite tarayıcı uygulaması
│  ├─ mobile/                     # Expo/React Native uygulaması
│  └─ shared/                     # Ortak route, limit ve TypeScript sözleşmeleri
├─ patches/                       # pnpm patchedDependencies yamaları
├─ scripts/local-network.mjs      # LAN IP tespiti ve üç servisi yerelde başlatma
├─ tools/database-migration/      # MongoDB -> PostgreSQL offline taşıma aracı
├─ docker-compose.yml             # Development stack
├─ docker-compose.test.yml        # İzole PostgreSQL integration-test servisi
├─ docker-compose.prod.yml        # Production backend + web container'ları
├─ package.json                   # Kök komutlar ve Node/pnpm sürüm sözleşmesi
├─ pnpm-workspace.yaml            # Workspace kapsamı, override ve pnpm yamaları
├─ pnpm-lock.yaml                 # Tek kilit dosyası
├─ turbo.json                     # Build/lint/typecheck/test görev grafiği
├─ tsconfig.json                  # Ortak strict TypeScript tabanı
├─ redocly.yaml                   # OpenAPI lint kuralları
├─ README.md                      # Hızlı başlangıç
├─ MIGRATION_REPORT.md            # Mongo -> PostgreSQL/TypeScript geçiş raporu
└─ PROJECT_STRUCTURE.md           # Bu kapsamlı mimari referans
```

### 3.1 Kök dosyaların sorumlulukları

| Dosya/dizin | Sorumluluk |
| --- | --- |
| `package.json` | Kök `dev`, `build`, `lint`, `typecheck`, `test`, Docker ve LAN komutları. Node `>=22.22.0`, pnpm `11.10.0`. |
| `pnpm-workspace.yaml` | `packages/*` ve `tools/*` workspace kapsamı; güvenlik override'ları; `minimatch@3.1.5` uyumluluk yaması. |
| `turbo.json` | Paketler arası görev sırası. `build` üst bağımlılıkları önce derler; `dev` persistent ve cache dışıdır. |
| `tsconfig.json` | `strict: true`, `allowJs: false`, ES2022 ve bundler çözümleme temeli. Backend kendi config'inde NodeNext emit yapar. |
| `docs/openapi.yaml` | HTTP API'nin belgelenen dış sözleşmesi; runtime gerçeğinin son kaynağı yine route/controller kodudur. |
| `.dockerignore` | Dependency, secret, build çıktısı ve lisansı netleşmemiş exercise dataset'ini Docker context dışında bırakır. |
| `.gitignore` | `.env*`, dependency, build, Expo ve mobil `dist-*` artifact'lerini takip dışı bırakır; izin verilen environment örnekleri istisnadır. |
| `patches/minimatch@3.1.5.patch` | `brace-expansion` CommonJS/export biçimiyle uyumluluk sağlar. |

## 4. Teknoloji matrisi

| Katman | Ana teknolojiler |
| --- | --- |
| Monorepo | pnpm 11.10 workspaces, Turborepo 2.5, TypeScript 5.8 |
| Runtime | Geliştirme/CI için Node.js 22.22+, container build/runtime için Node.js 24 Alpine |
| Backend | Express 5.1, Kysely 0.29, `pg` 8.22, Socket.IO 4.8, JWT, bcryptjs, Helmet, CORS, Multer |
| Kalıcı veri | PostgreSQL 18, `pgcrypto`, `citext`, UUID, enum, FK, check, trigger ve composite/partial index'ler |
| Geçici altyapı | Redis 7.4, Redis rate-limit store, Socket.IO Redis adapter |
| Medya | AWS SDK v3 S3, multipart upload, presigned PUT, ImageKit URL dönüşümü |
| E-posta | Nodemailer 9, Brevo SMTP relay (`smtp-relay.brevo.com:587`) |
| Web | React 19.2, React Router 8, Vite 7, MUI 7, Emotion, Redux Toolkit 2, Axios, Recharts, i18next, Socket.IO client |
| Mobile | Expo SDK 54, React Native 0.81.5, React 19.1, React Navigation 7, React Native Paper 5, SecureStore, AsyncStorage, Expo Image/Video/ImagePicker |
| Production web | Multi-stage Vite build + unprivileged Nginx Alpine |
| Test/kalite | ESLint 9, strict TypeScript, Node test runner üzerinden `tsx --test`, Docker PostgreSQL integration testi, pnpm audit |

## 5. Workspace bağımlılık ve build modeli

`packages/shared`, üç uygulamanın ortak derleme bağımlılığıdır. Paket `src` içinden
doğrudan publish edilmez; `tsc` ile `dist/index.js` ve declaration dosyalarına
derlenir. Bu nedenle güvenli build sırası şöyledir:

```text
@motionmeet/shared build
        ├──> @motionmeet/backend build
        ├──> @motionmeet/web build
        └──> @motionmeet/mobile export
```

Turborepo `^build` bağımlılığı bu sırayı kök `pnpm build` sırasında uygular.
Backend CommonJS değil ESM/NodeNext çıktı üretir ve production'da
`dist/server.js` çalışır. Web statik Vite bundle üretir. Mobile'ın standart
`build` komutu Expo ile Android/iOS/web export üretir; mağaza için native imzalı
binary oluşturma ayrı Expo/EAS veya native Gradle/Xcode sürecidir.

## 6. Backend mimarisi (`packages/backend`)

### 6.1 Klasör yapısı

```text
packages/backend/
├─ configs/       # Environment, PostgreSQL, Redis, AWS, ImageKit, SMTP, Multer
├─ controllers/   # HTTP input/output adaptörleri
├─ db/
│  ├─ migrations/ # PostgreSQL schema sürümleri
│  ├─ migrator.ts # Kysely migration registry/runner
│  └─ types.ts    # 35 uygulama tablosunun tipli DB sözleşmesi
├─ middlewares/   # JWT auth, DB user bağlama, RBAC, request ID, error handling
├─ realtime/      # Socket.IO auth sonrası mesaj/presence/typing işleyicileri
├─ repositories/  # SQL okuma/hydration ve DB entity -> API entity dönüşümü
├─ routes/        # Express endpoint tanımları ve endpoint bazlı limiter'lar
├─ scripts/       # Migration, seed, admin promote ve exercise S3 upload görevleri
├─ services/      # Transaction ve domain kuralları
├─ tests/         # Unit/contract/concurrency testleri
├─ types/         # Express request genişletmeleri
├─ utils/         # Token, doğrulama, pagination, medya, plan ve metrik yardımcıları
├─ workers/       # Cron tabanlı bakım ve durable job tüketicileri
└─ server.ts      # Composition root ve process yaşam döngüsü
```

### 6.2 Başlangıç sırası

`server.ts` aşağıdaki sırayı uygular:

1. Environment yüklenir ve zorunlu değerler doğrulanır.
2. PostgreSQL pool üzerinden `select 1` ile bağlantı kurulur.
3. `RUN_MIGRATIONS=false` değilse Kysely migration'ları son sürüme taşınır.
4. Beklenen tablo/migration contract'ı kontrol edilir.
5. Free/Pro/Premium planları, kas grupları ve ekipman lookup kayıtları idempotent
   biçimde bootstrap edilir.
6. Redis bağlantısı denenir. Redis yoksa süreç durmaz; PostgreSQL tabanlı ana
   işlevler devam eder.
7. Express middleware zinciri ve REST route'ları bağlanır.
8. Socket.IO kurulur; Redis hazırsa pub/sub adapter eklenir.
9. Background cron görevleri ayara göre başlatılır.
10. HTTP + Socket.IO aynı Node HTTP server üzerinde `0.0.0.0:PORT` dinler.

PostgreSQL bağlantısı veya schema contract'ı başarısızsa API başlamaz. Redis
başarısızlığı ise readiness yanıtını `degraded: true` yapar fakat HTTP readiness
PostgreSQL hazır olduğu sürece 200 dönebilir.

### 6.3 HTTP request hattı

```text
İstemci
  -> Helmet güvenlik başlıkları
  -> requestContext (sunucu üretimli X-Request-Id ve süre ölçümü)
  -> CORS allowlist
  -> API content-type allowlist (JSON/multipart) ve 500 KB JSON sınırı
  -> /api global rate limit
  -> route bazlı limiter
  -> protect (Bearer access token)
  -> attachDbUser / authorizeRole gerektiğinde
  -> controller doğrulaması
  -> service transaction/domain kuralı
  -> repository/Kysely
  -> PostgreSQL
  -> tipli JSON yanıtı
```

Her tamamlanan HTTP isteği structured logger ile request ID, method, path,
status ve duration bilgisiyle kaydedilir. Hatalar tek error middleware'inde HTTP
status'a çevrilir; PostgreSQL unique violation `409`, bilinmeyen server hataları
`500` olur. Production'da stack trace istemciye veya log metadata'sına eklenmez.

### 6.4 REST API alanları

| Alan | Endpoint'ler | Görev |
| --- | --- | --- |
| Health | `GET /`, `GET /health/live`, `GET /health/ready` | Process liveness; PostgreSQL, Redis ve capability readiness. |
| Auth | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`; `GET /me` | Hesap, access/refresh session ve parola yenileme. |
| User | `GET /api/user/data`, `/privacy`, `/export`, `/connections`, `/recent-messages`, `/suggested`; `PATCH /privacy`; `POST /update`, `/discover`, `/follow`, `/unfollow`, `/connect`, `/accept`, `/profiles`; `DELETE /account`, `/connection` | Profil, privacy, sosyal grafik, data export ve hesap silme. |
| Post | `POST /api/post/add`, `/like`, `/comment/add`, `/delete`; `GET /feed`, `/:postId/comments`; `PUT /:postId/like`; `DELETE /:postId/like`, `/:postId`, `/delete/:postId` | Feed, gönderi, medya, like/comment ve geriye uyumlu alias'lar. |
| Story | `POST /api/story/create`; `GET /api/story/get`; `DELETE /api/story/delete/:storyId` | 24 saatlik içerik ve görüntüleme durumu. |
| Message | `POST /api/message/send`, `/get`, `/seen`; `GET /conversations`, `/recent`; `DELETE /delete/:messageId` | HTTP mesaj fallback'i, conversation, unread/seen ve silme. |
| Workout | `GET/POST /api/workout`, `GET /api/workout/stats` | Antrenman yazma, geçmiş ve aggregate istatistikler. |
| Routine | `GET/POST /api/routine`, `PUT/DELETE /api/routine/:id` | Kullanıcı rutinleri ve plan kotası. |
| Exercise | `GET/POST /api/exercise`, `GET /records`, `GET /:id`, `GET /:id/stats` | Katalog, custom exercise ve analitik. |
| Plan | `GET /api/plans`, `POST /api/plans/update` | Aktif planları okuma ve mevcut kullanıcı planını değiştirme. |
| Lookup | `GET /api/muscle-groups`, `GET /api/equipment` | Aktif master data. |
| Media | `POST /api/media/presign` | Kullanıcı ve plan limitleriyle S3 upload rezervasyonu. |
| Admin | `GET /api/admin/users`, `PUT /users/:id/role`, `PUT /users/:id/plan` | Yalnız `superadmin`; kullanıcı/rol/plan yönetimi. |

`docs/openapi.yaml` temel dış sözleşmeyi belgeler ve `redocly.yaml` ile lint
edilebilir. Runtime'daki geriye uyumlu route alias'larının tamamı OpenAPI'de
bulunmayabilir; uyuşmazlık durumunda `routes/` ve controller kodu gerçek çalışma
davranışıdır, ardından OpenAPI güncellenmelidir.

### 6.5 Kimlik doğrulama ve oturum modeli

- Parolalar bcrypt ile cost 12 kullanılarak hash'lenir.
- Kayıtta e-posta normalize edilir, `citext` unique kuralıyla case-insensitive
  tutulur; username `^[a-z0-9._-]{3,30}$` biçimindedir.
- Yeni parola 10–72 UTF-8 byte aralığında olmalıdır. 72 byte sınırı bcrypt'in
  sessiz truncation davranışına karşı açık bir güvenlik kuralıdır.
- Access token HS256 JWT'dir; issuer `motionmeet-api`, audience
  `motionmeet-clients`, ömrü 15 dakikadır. Payload `id` ve session `sid` taşır.
- Refresh token `session UUID.random-secret` biçimindedir. Secret'ın yalnız
  SHA-256 hash'i PostgreSQL `sessions` tablosunda tutulur.
- Refresh session 30 gün geçerlidir ve her refresh'te secret rotate edilir.
- Web refresh token'ı `HttpOnly`, `SameSite=Lax`, `/api/auth` path'li cookie'de
  taşır; production'da `Secure` bayrağı zorunludur. Access token bellekte kalır,
  localStorage'daki eski token temizlenir.
- Cookie kullanan web refresh/logout istekleri exact Origin/Referer allowlist'i
  ve `X-CSRF-Protection: 1` header'ı ile CSRF'e karşı doğrulanır.
- Native mobile access/refresh token ve expiry değerlerini Expo SecureStore'da
  saklar; isteklerde `X-Client-Platform: mobile` ile refresh token'ın response
  body'de verilmesini ister.
- İstemciler token bitimine 60 saniye kala tek bir in-flight refresh promise'i
  paylaşır; paralel refresh fırtınası engellenir.
- Logout session'ı revoke eder. Parola sıfırlama başarılı olduğunda kullanıcının
  bütün aktif session'ları revoke edilir.
- Forgot-password endpoint'i hesap enumeration'ını önlemek için kullanıcı var
  olsun veya olmasın aynı `202` cevabını döndürür. Reset token 30 dakika yaşar,
  hash'li tutulur ve tek kullanımlıdır.

Auth limiter'ları Redis varsa dağıtıktır: login 15 dakikada 10 başarısız deneme,
register saatte 5, refresh 15 dakikada 60, password reset saatte 5. Global API
limiti varsayılan 15 dakikada 1000 istektir ve environment ile 100–10000
aralığında ayarlanır.

### 6.6 Yetkilendirme, gizlilik ve plan kotaları

`protect` geçerli Bearer token'ı doğrular. `attachDbUser` gerektiğinde kullanıcıyı
planıyla yükler ve plansız eski kayıtları Free plana bağlar. RBAC rolleri `user`,
`admin`, `superadmin` enum'udur; admin API şu an yalnız superadmin'e açıktır ve
superadmin kendi rolünü düşüremez.

Gizlilik alanları:

- `publicProfile`
- `showWorkoutsOnFeed`
- `allowFollowers`
- `showInSearch`
- `allowMessages`

Profil erişimi, takip, discovery ve mesaj izni service katmanında bu alanlara ve
ilişki durumuna göre kontrol edilir.

Bootstrap edilen planlar:

| Plan | Durum | Antrenman/ay | Rutin | Upload | Öne çıkan yetenekler |
| --- | --- | ---: | ---: | ---: | --- |
| Free | aktif | 5 | 2 | 20 MB | Custom exercise açık; herkese mesaj/analytics kapalı. |
| Pro | aktif | sınırsız | sınırsız | 50 MB | 7 gün trial, analytics, premium içerik, ad-free, herkese mesaj. |
| Premium | başlangıçta pasif | sınırsız | sınırsız | 100 MB | 14 gün trial ve priority support dahil. |

`-1` sınırsız kota anlamına gelir. Kota rezervasyonları `usage_counters`
tablosunda transaction içinde atomik artırılır; aynı anda gelen istekler limiti
aşamaz. Workout aylık, post/story günlük, rutin lifetime bucket kullanır.
Repository'de Stripe customer/subscription ve price ID alanları hazırdır; ancak
bu repository'de Stripe SDK, checkout veya webhook implementasyonu yoktur. Plan
değişimi şu an API/admin uygulama mantığıyla yapılır.

### 6.7 Domain service'leri ve önemli transaction sınırları

- **Workout:** workout, exercise snapshot ve set satırları aynı transaction'da
  yazılır; kota rezerve edilir, günlük analytics ve personal record güncellenir,
  kullanıcının toplam sayaçları artırılır.
- **Routine:** rutin ve sıralı child satırları transaction'da yeniden oluşturulur;
  ownership ve plan kotası kontrol edilir.
- **Post:** operation ID ile retry-safe oluşturma, görünürlük kontrolü, workout
  sahipliği, media reservation commit'i ve günlük kota aynı domain akışındadır.
- **Like/comment:** composite key ile duplicate like engellenir; like/comment
  sayaçları edge kaydıyla aynı transaction'da değişir.
- **Story:** expiry, visibility, view edge ve medya lifecycle birlikte yönetilir.
- **Follow/connection:** self-edge ve duplicate pair engellenir; iki kullanıcıya
  ait sayaçlar aynı transaction'da güncellenir. Connection request ayrıca
  durable outbox event üretir.
- **Message:** iki kullanıcı için canonical `pair_key`, tek conversation,
  participant unread sayaçları ve last-message pointer aynı transaction'da
  güncellenir.
- **Profile update:** public author snapshot'larının sonradan güncellenmesi için
  `user.profile.updated` outbox event'i oluşturulur.
- **Account delete:** ilgili S3 key'leri durable silme kuyruğuna eklenir, başka
  kullanıcılardaki like/comment/follow/connection sayaçları düzeltilir,
  conversation'lar ve kullanıcı cascade ile silinir.
- **Account export:** büyük JSON tek seferde belleğe alınmaz; tablolar 200 satırlık
  stream'lerle response'a yazılır ve backpressure dikkate alınır.

### 6.8 Pagination ve idempotency

Feed, comments, messages, conversations, stories, workouts ve routines için
stable cursor yaklaşımı kullanılır. Cursor çoğunlukla `date + UUID` bilgisinin
base64url kodlanmış halidir. Exercise listesi alfabetik `name_normalized + id`
cursor'ı kullanır. Offset uyumluluğu kalan endpoint'lerde üst sınırlandırılır.

Mobile/web yazma retry'ları için `createOperationId()` `prefix:UUID` üretir.
PostgreSQL'deki partial unique index'ler şu eşleşmeleri korur:

- `(user_id, operation_id)` — routines, workouts, posts, stories
- `(from_user_id, operation_id)` — messages

Yalnız `operation_id IS NOT NULL` satırlar unique kapsamdadır; legacy/null
kayıtlar birbirleriyle çakışmaz.

### 6.9 Socket.IO gerçek zamanlı katmanı

Socket handshake `auth.token` alanında access JWT ister. Token doğrulandıktan ve
kullanıcı PostgreSQL'den bulunduğunda socket `user:<uuid>` odasına katılır.

Client -> server olayları:

- `send_message`
- `typing_start`
- `typing_stop`

Server -> client olayları:

- `message_received`, `message_sent`, `message_deleted`, `message_error`
- `online_users`, `user_online`, `user_offline`
- `typing_start`, `typing_stop`

Mesajlar önce PostgreSQL'e durable olarak yazılır, sonra ilgili user room'larına
emit edilir. Socket mesaj limiti kullanıcı başına dakikada 30, typing limiti
dakikada 60'tır. Mesajlaşma privacy/plan izni 30 saniyelik socket-local cache ile
tekrar sorgu maliyetini azaltır.

Redis adapter hazırsa farklı backend instance'larındaki odalar birbirine pub/sub
ile ulaşır. Redis yoksa aynı instance içindeki Socket.IO çalışır ancak çoklu
instance realtime yayını ve global presence bütünlüğü kaybolur; kalıcı mesaj
kaydı PostgreSQL sayesinde korunur.

### 6.10 Background job ve durable queue modeli

`RUN_SCHEDULED_JOBS=false` değilse:

| Sıklık | Görev |
| --- | --- |
| Her dakika | `outbox_events` işler. |
| Her 5 dakika | Süresi dolan story'leri siler, medyayı kuyruğa alır. |
| Her 10 dakika | `media_deletion_jobs` üzerinden S3 silmelerini işler. |
| Her 15 dakika | Tamamlanmamış/süresi geçen upload reservation'larını temizler. |
| Her saatin 17. dakikası | Süresi dolan usage counter'ları siler. |

Expired story/upload/usage scan'leri Redis lease kullanır. Redis yoksa görev
çalışmaya devam eder; birden fazla instance aynı scheduler'ı çalıştırıyorsa DB
`FOR UPDATE SKIP LOCKED`/claim kuralları dayanıklılığı sağlar fakat gereksiz
tarama oluşabilir.

Outbox ve media deletion işleri PostgreSQL'de kalıcıdır. Worker satırı atomik
claim token ve `claim_until` ile alır. Hata olursa exponential backoff uygulanır;
bekleme en fazla 24 saattir. Process job ortasında ölürse lease süresi sonunda
başka worker işi yeniden alabilir.

### 6.11 Health ve kontrollü kapanış

- `/health/live`: Node process çalışıyor mu?
- `/health/ready`: PostgreSQL sorgulanabiliyor mu, Redis durumu ne, media/e-mail/
  scheduled job capability'leri açık mı?
- SIGTERM/SIGINT: cron durur, Socket.IO kapanır, HTTP yeni bağlantı almayı bırakır,
  PostgreSQL ve Redis bağlantıları kapatılır.
- Kapanış 10 saniyede bitmezse force-exit koruması devreye girer.

## 7. PostgreSQL veri mimarisi

### 7.1 Neden PostgreSQL?

MongoDB/Mongoose production veri katmanı tamamen kaldırılmıştır. Sosyal grafik,
sayaç, idempotency, quota ve antrenman analytics akışları çok satırlı atomik
işlemler ve güçlü integrity constraint'leri gerektirdiği için PostgreSQL kalıcı
sınır olarak seçilmiştir. Kysely compile-time tablo/kolon tiplerini sağlarken
asıl veri bütünlüğü PostgreSQL FK, unique, check, enum ve transaction'larındadır.

### 7.2 Extension ve enum'lar

- `pgcrypto`: `gen_random_uuid()` ile DB tarafında UUID üretimi.
- `citext`: email, username, plan slug/name ve lookup code alanlarında
  case-insensitive eşitlik/unique davranışı.
- Enum'lar: `user_role`, `plan_status`, `billing_interval`, `set_type`,
  `post_type`, `post_visibility`, `media_type`, `story_media_type`,
  `connection_status`, `message_type`, `upload_purpose`, `outbox_status`,
  `outbox_type`.

### 7.3 35 uygulama tablosu

#### Plan ve kullanıcı

| Tablo | Ana alanlar ve amaç |
| --- | --- |
| `plans` | Plan fiyatı, trial, aktiflik ve bütün ürün feature/kota değerleri. |
| `plan_billing_cycles` | Plan başına monthly/yearly fiyat ve gelecekteki Stripe price ID. Composite PK `(plan_id, interval)`. |
| `users` | Kimlik, password hash, profil/kapak key ve URL'leri, rol, plan, privacy, sosyal ve workout toplam sayaçları. |

#### Egzersiz master data

| Tablo | Ana alanlar ve amaç |
| --- | --- |
| `equipment` | Aktif ekipman lookup'ı; code unique, display order. |
| `muscle_groups` | Aktif kas grubu lookup'ı; code unique, display order. |
| `exercises` | Global veya kullanıcıya ait custom egzersiz; isim, target, kategori, equipment ve medya key/URL'leri. |
| `exercise_secondary_muscles` | Egzersizin sıralı ikincil kasları; `(exercise_id, position)` PK. |
| `exercise_instructions` | Egzersiz başına dil, özet ve `text[]` adımlar; `(exercise_id, language)` PK. |

#### Rutin ve antrenman

| Tablo | Ana alanlar ve amaç |
| --- | --- |
| `routines` | Kullanıcı rutini, klasör ve retry-safe operation ID. |
| `routine_exercises` | Rutin içindeki sıralı egzersiz; nullable master `exercise_id` yanında immutable isim/kas/equipment snapshot'ı. |
| `routine_sets` | Rutin egzersizinin sıralı set tipi, tekrar, ağırlık ve completed değeri. |
| `workouts` | Başlangıç/bitiş, duration, volume, total sets/reps ve metrics version. |
| `workout_exercises` | Antrenmandaki sıralı egzersiz ve immutable snapshot. |
| `workout_sets` | Gerçekleşen sıralı setler. |

#### Sosyal içerik

| Tablo | Ana alanlar ve amaç |
| --- | --- |
| `posts` | İçerik, tür, visibility, author display snapshot'ları, sayaçlar ve opsiyonel workout bağlantısı. |
| `post_media` | En fazla dört sıralı medya; URL, S3 key, tür, MIME, byte/ölçü/süre metadata'sı. |
| `post_likes` | Duplicate like'ı engelleyen `(post_id, user_id)` composite PK. |
| `post_comments` | Kullanıcı yorumu ve cursor sırası. |
| `stories` | Text/image/video içerik, media key/URL, arka plan ve `expires_at`. |
| `story_views` | Story-kullanıcı unique view edge'i. |

#### Sosyal grafik ve mesajlaşma

| Tablo | Ana alanlar ve amaç |
| --- | --- |
| `user_follows` | Yönlü follower/followee edge'i; self-follow check'i. |
| `connections` | Canonical `pair_key`, requester/recipient ve pending/accepted durum. |
| `conversations` | İki kullanıcı için unique pair, son mesaj ID/zamanı. |
| `conversation_participants` | Kullanıcının conversation üyeliği ve unread counter'ı. |
| `messages` | Sender/recipient, text/image, media key/URL, seen ve operation ID. |

#### Auth, quota, medya ve async işler

| Tablo | Ana alanlar ve amaç |
| --- | --- |
| `sessions` | Hash'li refresh secret, expiry/revocation, user-agent ve IP audit alanları. |
| `password_reset_tokens` | Hash'li, expiring ve consumed reset token. |
| `upload_reservations` | Presigned upload'ın kullanıcı/purpose/MIME/limit/expiry kaydı. |
| `media_deletion_jobs` | S3 object silme retry kuyruğu, attempt/backoff/claim lease. |
| `usage_counters` | Plan kota bucket'ları ve expiry. |
| `outbox_events` | Profil snapshot yayılımı ve connection e-mail event'leri için durable outbox. |

#### Analytics

| Tablo | Ana alanlar ve amaç |
| --- | --- |
| `personal_records` | Kullanıcı-egzersiz başına en iyi ağırlık, tekrar, workout ve kayıt tarihi. |
| `user_daily_workout_stats` | Günlük workout/duration/volume/set/rep aggregate'i. |
| `user_daily_muscle_stats` | Günlük aggregate'e bağlı kas başına set sayısı. |
| `user_exercise_daily_stats` | Kullanıcı-gün-egzersiz başına volume, rep, set, session ve max weight. |

Kysely'nin kendi migration metadata tabloları bu 35 uygulama tablosuna dahil
değildir.

### 7.4 Normalizasyon ve bilinçli denormalizasyon

Mongo'daki embedded exercise/set/media dizileri ordered child tablolara ayrıldı.
Bu yapı child öğeler üzerinde constraint, FK ve index uygulanmasını sağlar.

Bazı alanlar performans için bilinçli denormalized tutulur:

- `posts.author_*`: feed sırasında her satırda user join zorunluluğunu azaltır;
  outbox profil değişikliklerini mevcut postlara yayar.
- user follower/following/connection ve workout toplamları: profil özetlerini
  hızlandırır; edge değişiklikleriyle aynı transaction'da güncellenir.
- post like/comment sayaçları ve conversation unread/last message bilgisi:
  liste sorgularını sınırlar.
- günlük workout/exercise/muscle tabloları: grafiklerde ham workout setlerini
  tekrar tekrar taramak yerine yazma anında materialize edilir.
- routine/workout exercise isim-kas-ekipman snapshot'ları: master exercise
  değişse veya custom exercise silinse geçmişi korur.

### 7.5 Foreign key ve silme kararları

- Kullanıcının sahip olduğu post, story, routine, workout, session, token,
  analytics ve sosyal edge'ler kullanıcı silinince cascade olur.
- Post media/like/comment post ile; workout/routine child'ları parent ile;
  conversation participant/message'ları conversation ile cascade olur.
- Plan silinirse `users.plan_id`, postun workout'ı silinirse `posts.workout_id`,
  message silinirse conversation'ın `last_message_id` alanı `SET NULL` olur.
- Custom exercise silindiğinde routine/workout `exercise_id` alanı `SET NULL`
  olur; snapshot alanları durur.
- Genel soft-delete katmanı yoktur. Kullanıcı tarafından istenen silme gerçek
  relational delete'tir; S3 gibi transaction dışı etkiler durable job'a çevrilir.

### 7.6 Constraint ve index stratejisi

- UUID PK'ler, case-insensitive unique identity alanları ve self-edge check'leri.
- Set/exercise position ve sayıları, weight/reps/duration, counter ve media
  metadata'sı için range check'leri.
- Feed/profile/workout/message/comment/story cursor'ları için
  `(owner/filter, created_at veya start_time, id)` composite index'leri.
- User discovery için username + full name üzerinde GIN text-search index'i.
- Exercise prefix/filter/custom-owner index'leri.
- Follow/connection yönleri ve conversation participants için ters erişim
  index'leri.
- Session, reset token, story, upload reservation ve usage expiry index'leri.
- Outbox/media job claim ve analytics history/rank index'leri.
- `updated_at` destekleyen tablolarda ortak PostgreSQL trigger'ı.

### 7.7 Migration sürümleri

1. `001_initial_postgresql`: extension, 13 enum, 35 tablo, FK/check/unique/index ve
   `updated_at` trigger'ları.
2. `002_partial_idempotency_indexes`: routine/workout/post/story/message operation
   ID'lerini yalnız dolu değerlerde unique yapan beş partial index.
3. `003_detached_exercise_snapshots`: routine/workout exercise FK'lerini nullable
   `ON DELETE SET NULL` yaparak geçmiş snapshot'ı korur.

Migration komutu:

```bash
corepack pnpm --filter @motionmeet/backend migrate:postgres
```

Server başlangıcında da aynı migrator çalışır; `RUN_MIGRATIONS=false` ile ayrı
release job modeline geçilebilir. Çoklu instance başlatmada Kysely/PostgreSQL
migration lock sıralaması kullanılır.

## 8. Redis mimarisi

Redis'in dört görevi vardır:

1. **Cache:** feed 30 sn, profile 60 sn, exercise list 300 sn, exercise detail
   900 sn gibi kısa TTL'li JSON cache'leri. Key prefix'i `motionmeet:v1:`.
2. **Rate limit:** global, auth, account, media presign ve custom exercise
   limiter'ları. Prefix `motionmeet:rate-limit:*`.
3. **Realtime:** Socket.IO publisher/subscriber adapter ve instance'lar arası room
   yayını.
4. **Koordinasyon:** cron lease'leri ve socket message/typing sayaçları.

Write işlemleri ilgili cache prefix'lerini invalidate eder. Prefix silme `SCAN`
ile 200'lük gruplar halinde yapılır; production Redis'i bloklayacak `KEYS`
kullanılmaz.

Redis opsiyoneldir. Bağlantı yoksa:

- cache doğrudan PostgreSQL'e düşer;
- Express limiter adaptive store içindeki process-local memory fallback'i kullanır;
- socket limitleri process-local Map'e düşer;
- cron lock görevi doğrudan çalıştırır;
- Socket.IO yalnız aynı instance içinde realtime yayın yapar;
- PostgreSQL'deki kalıcı veri ve durable job'lar kaybolmaz.

Production'da `rediss://`, kullanıcı/parola ve TLS beklenir. Yalnız güvenilir özel
self-hosted ağ için `ALLOW_INSECURE_REDIS_TLS=true` istisnası vardır.

## 9. AWS S3, ImageKit ve medya yaşam döngüsü

### 9.1 Servis rolleri

- **AWS S3:** orijinal profil, kapak, post, story, message ve exercise binary
  nesnelerinin source-of-truth deposu.
- **ImageKit:** S3 key'den public CDN URL ve image transform URL'si üretir. Profil
  512 px WebP, kapak 1280 px WebP; diğer image türleri kalite/format dönüşümü
  kullanır. Video URL'si transform uygulanmadan üretilir.
- **PostgreSQL:** nesne key'i, public URL, MIME/size ve ilgili entity bağlantısını
  saklar.

Repository AWS altyapısını provision etmez. Terraform, CDK veya CloudFormation
yoktur; bucket, IAM, CORS, lifecycle, CDN origin ve secret yönetimi deployment
ortamında ayrıca hazırlanmalıdır. AWS SDK standart credential provider chain'i
kullanır; tipik environment değerleri `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME`'dir.

### 9.2 Önerilen presigned upload akışı

```text
Web/Mobile dosyayı seçer ve MIME/size doğrular
  -> POST /api/media/presign
  -> backend kullanıcı + plan + purpose limitini kontrol eder
  -> S3 PutObject için 5 dakikalık signed URL üretir
  -> upload_reservations satırını 1 saat expiry ile yazar
  -> istemci binary'yi doğrudan S3'e PUT eder
  -> istemci entity create/update isteğinde yalnız object key gönderir
  -> backend reservation sahipliği/expiry/purpose kontrolü yapar
  -> S3 HEAD ile size ve Content-Type doğrular
  -> ilk 32 byte range read ile gerçek dosya imzasını doğrular
  -> ImageKit public URL'sini üretir
  -> entity + reservation commit aynı DB transaction'ında tamamlanır
```

Bu yaklaşım büyük dosyanın API process belleğinden geçmesini engeller. Eski veya
fallback multipart endpoint'ler için Multer memory storage hâlâ bulunur; profile/
message image 5 MB, post/story doğrudan multipart dosya başına 20 MB ile
sınırlıdır.

### 9.3 Purpose ve format kuralları

| Purpose | Adet | Üst sınır | İzin verilen türler |
| --- | ---: | ---: | --- |
| `profiles` | 1 | 5 MB ve plan limiti | JPEG, PNG, WebP, GIF, HEIC, HEIF |
| `covers` | 1 | 5 MB ve plan limiti | Aynı image türleri |
| `messages` | 1 | 5 MB ve plan limiti | Aynı image türleri |
| `posts` | 4 | dosya başına en fazla 100 MB ve plan limiti | Image türleri + MP4, WebM, QuickTime |
| `stories` | 1 | en fazla 100 MB ve plan limiti | Image türleri + MP4, WebM, QuickTime |

Presign endpoint'inde ayrıca 15 dakikada 60 istek ve kullanıcı başına saatte 30
dağıtık authorization limiti vardır. Object key:

```text
<purpose>/<userId>/<timestamp>-<uuid>-<sanitize-edilmiş-dosya-adı>
```

Server yalnız `Content-Type` beyanına güvenmez. JPEG/PNG/GIF/WebP/HEIC/HEIF,
MP4/QuickTime ve WebM magic byte/container imzasını kontrol eder. Mobile client
da mümkünse Blob'un ilk byte'larını okuyup picker metadata'sını normalize eder.

### 9.4 Silme ve hata dayanıklılığı

Entity veya hesap silme sırasında S3 çağrısı DB transaction'ı içinde yapılmaz.
Key önce unique `media_deletion_jobs` satırına yazılır, ardından worker silmeyi
dener. Başarısızlık attempt, last error ve exponential backoff ile korunur.
Geçersiz/path traversal içeren key (`/`, `..`, 1024+ karakter) S3'e gönderilmez.

Süresi dolmuş ama kullanılmamış reservation worker tarafından job'a çevrilir.
Bu tasarım DB commit başarılı/S3 delete başarısız gibi iki sistemli hata
durumlarında nesnenin sonsuza kadar orphan kalmasını önler.

### 9.5 Exercise dataset ve AWS upload

`exercises-dataset-main` repository tarafından ignore edilir ve Docker image'a
girmez. `seedExercises.ts` metadata'yı 200'lük transaction gruplarıyla
PostgreSQL'e upsert eder. `uploadExercisesToS3.ts` yerel `images` ve `videos`
klasörlerini `exercises/images/*` ve `exercises/videos/*` key'leriyle S3'e yollar.

Dataset metadata lisansı, görsel/video yeniden dağıtım hakkını otomatik vermez.
Production seed öncesi medya lisansı ayrıca doğrulanmalı veya orijinal/lisanslı
asset kullanılmalıdır. `CDN_URL` seed sırasında public exercise URL kökünü
belirler.

## 10. E-posta altyapısı

Nodemailer, Brevo SMTP relay üzerinde 587 portunu kullanır. Zorunlu credential'lar
`SMTP_USER`, `SMTP_PASS`, `SENDER_EMAIL`'dir. `EMAIL_ENABLED=true` yapılmadan
production capability açılmaz.

Kullanım alanları:

- 30 dakikalık parola sıfırlama linki;
- connection request outbox event'inden üretilen bildirim e-postası.

Kullanıcı kaynaklı isim/username ve URL'ler HTML'e yerleştirilmeden önce escape
edilir. E-mail gönderme hatası outbox'ta retry edilir; forgot-password tarafında
hesap enumeration'ını önleyen generic cevap korunur.

## 11. Web uygulaması (`packages/web`)

### 11.1 Klasör ve katmanlar

```text
packages/web/src/
├─ api/          # Axios client, endpoint wrappers, presigned media upload
├─ app/          # Redux store ve typed hook'lar
├─ assets/       # Import edilen statik görseller
├─ components/   # Feed/story/post/profile/routine ortak UI parçaları
├─ config/       # Vite environment URL çözümleme
├─ context/      # Auth, Socket ve Theme provider'ları
├─ features/     # User, connection ve message Redux slice'ları
├─ hooks/        # Aktif workout, lookup ve socket hook'ları
├─ locales/      # İngilizce ve Türkçe çeviriler
├─ pages/        # Route seviyesindeki ekranlar
├─ services/     # Exercise/message/user domain API adaptörleri
├─ theme/        # MUI tema tanımı
├─ App.tsx       # Lazy route haritası ve global realtime davranışı
└─ main.tsx      # Provider composition root
```

Provider sırası: MUI styled engine/global layers -> Theme -> Auth ->
BrowserRouter -> Redux -> App -> Socket. Route-level sayfalar `React.lazy` ve
`Suspense` ile bölünür.

### 11.2 Web route haritası

- Public: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`,
  `/features`, `/pricing`, `/about`.
- Auth redirect alias'ları: `/sign-in`, `/sign-up`.
- Authenticated layout: `/feed`, `/messages`, `/messages/:userId`, `/routines`,
  `/exercises`, `/profile`, `/profile/:profileId`, `/settings`.
- Workout/analytics: `/active-workout`, `/workout-summary`, `/workout-share`,
  `/statistics`, `/statistics/history`, `/statistics/records`,
  `/statistics/muscle-distribution`, `/statistics/monthly-report` ve alt detay
  route'ları.
- Bilinmeyen path kullanıcı durumuna göre feed veya ana sayfaya yönlendiren 404
  ekranına düşer.

### 11.3 Web state ve auth

Redux store user, connections ve messages slice'larını taşır. Auth session
React context'tedir; access token yalnız bellekte tutulur, refresh cookie
`withCredentials: true` Axios instance ile kullanılır. Uygulama ilk açılışta
refresh çağrısı yapar. SocketProvider access token ile bağlanır; yeni mesaj Redux
store'a eklenir, kullanıcı messages route'unda değilse unread badge ve toast
üretilir. Logout veya session kaybında kullanıcıya ait Redux state'i de tamamen
başlangıç durumuna döndürülür.

`VITE_BASEURL` REST origin'ini, `VITE_SOCKET_URL` Socket origin'ini belirler.
Development'ta sayfa `127.0.0.1`, API `localhost` gibi farklı loopback hostlarıyla
açılmışsa refresh cookie'nin same-site kalması için host otomatik hizalanır.
Production'da explicit API URL veriliyorsa HTTPS olmak zorundadır. Boş
`VITE_BASEURL` aynı-origin `/api` kullanımına izin verir.

### 11.4 Web build ve servis

Vite production build:

- target `esnext`;
- Terser minification;
- sourcemap yalnız `VITE_BUILD_SOURCEMAP=true` ise;
- React/MUI, state ve network bağımlılıklarını ayrı manual chunk'lara ayırır;
- chart bağımlılıklarını yalnız onları kullanan lazy route'ların import zincirinde
  tutar;
- production artefaktında source map/secret ve gzip başlangıç bütçesini test eder.

Production Nginx:

- non-root, 8080 portunda çalışır;
- SPA fallback uygular;
- `/api`, `/health` ve `/socket.io` isteklerini backend'e proxy eder;
- account export için proxy buffering'i kapatır;
- immutable asset'lere 1 yıl cache, HTML'e `no-store` uygular;
- CSP, HSTS, X-Frame-Options, nosniff, referrer ve permissions policy başlıkları
  ekler;
- gzip açar ve Socket.IO upgrade header'larını iletir.

`vercel.json` statik SPA rewrite ve benzer güvenlik header'larını içerir; ayrı
Vercel dağıtımında API/Socket origin'i external HTTPS/WSS olmalıdır.

## 12. Mobile uygulaması (`packages/mobile`)

### 12.1 Uygulama kimliği ve teknoloji

- Expo SDK 54, React Native 0.81.5, React 19.1.
- Uygulama adı/slug: `MotionMeet` / `motionmeet`.
- Deep-link scheme: `motionmeet`.
- Android package ve iOS bundle ID: `app.motionmeet.mobile`.
- Android `versionCode: 1`, iOS `buildNumber: 1`, uygulama sürümü `1.0.0`.
- Portrait orientation, automatic light/dark UI, custom icon/splash.
- iOS tablet desteği açık.
- Android keyboard layout mode `resize`; uygulama backup'ı kapalı, legacy harici
  depolama izinleri engelli ve ImagePicker mikrofon izni kapalıdır.

### 12.2 Provider ve state ağacı

```text
Redux Provider
  -> ThemeProvider
    -> SafeAreaProvider
      -> AuthProvider
        -> PaperProvider
          -> AuthNavigator
             -> signed-out: Login
             -> signed-in: SocketProvider + AppNavigator
          -> Expo StatusBar
          -> global AppToast
```

Mobile Redux store user, posts, stories, connections ve messages slice'larını
taşır. API token provider her istekte güncel access token'ı alır. Auth ile domain
state ayrıdır; logout/session kaybı SecureStore tokenlarını ve kullanıcıya ait
bütün Redux state'ini birlikte temizler. Native tokenlar iOS'ta
`WHEN_UNLOCKED_THIS_DEVICE_ONLY` erişilebilirlik sınıfıyla saklanır.

### 12.3 Navigasyon

Alt tab'lar:

1. Home/Feed
2. Routines
3. Exercises
4. Messages
5. Profile

Root stack; ChatBox, profile edit, settings, connections, exercise detail,
active workout, workout detail/summary, statistics, advanced statistics, muscle
distribution, monthly report detayları, notifications, privacy, support,
pricing, main exercise ve leaderboard ekranlarını açar. Messages badge başlangıçta
conversation unread toplamından hesaplanır ve Socket.IO `message_received` ile
canlı güncellenir.

`navigation/types.ts` exercise/workout/stat route parametrelerini ve ortak
navigation prop sözleşmelerini merkezileştirir.

### 12.4 Responsive ve kullanıcı geri bildirimi

- `KeyboardAwareScrollView` input'u klavyenin üstünde tutar.
- Full-screen oluşturma akışları ve bottom-sheet seçim/form akışları safe-area,
  status/navigation bar ve güncel pencere yüksekliğini dikkate alır.
- `useResponsiveLayout` cihaz genişliğinden değil kullanılabilir içerik
  genişliği ile font scale'den karar verir.
- Dar telefonlarda riskli grid tek sütun, yeterli genişlikte iki sütundur.
- Global `AppToast` başarı/bilgi/hata mesajlarını gösterir; destructive kararlar
  native confirm dialog kullanır.
- Türkçe ve İngilizce i18next kaynakları vardır.
- Light/dark React Native Paper temaları aynı ThemeContext üzerinden yönetilir.

### 12.5 Mobile environment ve bağlantı modları

`EXPO_PUBLIC_API_URL` REST/Socket origin'idir; `EXPO_PUBLIC_WEB_URL` terms,
privacy veya web'e açılan bağlantıların origin'idir.

Development fallback:

- Android emulator: `http://10.0.2.2:4000`
- iOS/web: `http://localhost:4000`

Production bundle'da API URL zorunludur ve API/web origin'leri HTTPS olmalıdır.
Fiziksel cihaz `localhost` ile bilgisayarı göremez. Normal Expo Go/LAN geliştirme
için kök `dev:local:*` komutları aktif fiziksel IPv4 adresini otomatik enjekte
eder. USB üzerinden özel local APK testinde ADB reverse kullanılabilir:

```powershell
adb -s <cihaz-serisi> reverse tcp:4000 tcp:4000
adb -s <cihaz-serisi> reverse tcp:5173 tcp:5173
```

ADB reverse eşleşmesi USB kopunca veya cihaz yeniden başlayınca tekrar kurulmalıdır.
Release/store build ise gerçek public HTTPS backend/web origin'iyle üretilmelidir.

### 12.6 Mobile medya

Expo ImagePicker asset'i Blob'a çevrilir. İstemci mümkünse gerçek magic byte'tan
MIME türünü algılar, dosya uzantısını bu türle eşler, presign alır ve S3'e doğrudan
PUT eder. Bu özellikle Android üreticilerinin yanlış/eksik MIME metadata
döndürdüğü durumlarda backend signature rejection'ını önler.

### 12.7 Metro ve native artifact notları

`metro.config.js`, monorepo root ile native Gradle entry path uyuşmazlığını
önlemek için `unstable_serverRoot` değerini mobile paketine sabitler. Babel,
Expo'nun beklediği CommonJS `babel.config.js` biçiminde kalır. Bunlar uygulama JS
kaynağı değil tool config dosyalarıdır.

`packages/mobile/dist-*` Git tarafından ignore edilir. Yerel APK/Expo export
artifact'leri source code değildir ve release signing secret'ları repository'ye
konmaz. Son fiziksel Android kontrolünde arm64-v8a release APK Reeder P13 Blue
Max, Android 9/API 28 üzerinde açılmış; login ekranı render edilmiş, USB reverse
üzerinden backend auth cevabı alınmış ve fatal React Native/AndroidRuntime hatası
görülmemiştir. Bu bir yerel smoke testtir; mağaza imzası ve production HTTPS
dağıtımının yerine geçmez.

## 13. Shared paket (`packages/shared`)

Bu paket backend, web ve mobile arasındaki compile-time anlaşmadır. İçerdiği ana
gruplar:

- auth input/response tipleri;
- ortak success/failure, cursor/offset page ve timestamp tipleri;
- user, plan, privacy, role, connection ve follow tipleri;
- exercise, set, workout, routine, stats ve personal record tipleri;
- post, comment, media, story, message, conversation ve notification tipleri;
- Socket.IO `ClientToServerEvents` / `ServerToClientEvents` event map'leri;
- `API_ROUTES` endpoint sabitleri;
- auth/content/pagination limitleri;
- privacy default'ları;
- operation ID ve public media URL yardımcıları.

Önemli limitler:

- yorum 1000, mesaj 2000, post 5000, story 2000 karakter;
- post başına 4 medya;
- routine adı 120, exercise adı shared istemci contract'ında 80 karakter;
- varsayılan sayfa boyları feed/comment 30; exercise/message/conversation/routine/
  story 50; workout 30.

Shared paket DB tablosu veya server-only secret tipi yayınlamaz. Yeni endpoint
veya response eklerken önce shared sözleşmesi, sonra backend ve iki istemci aynı
değişiklik içinde güncellenmelidir.

## 14. Eski MongoDB'den PostgreSQL'e migration aracı

`tools/database-migration` production backend'den izole bir operator aracıdır.
Bu pakette `mongodb` dependency bulunması MongoDB'nin uygulamada hâlâ kullanıldığı
anlamına gelmez. Sadece eski kaynağı read-only okuyup PostgreSQL'e taşır.

Zorunlu değişkenler:

- `MONGODB_URL`
- `MONGODB_DB_NAME`
- `DATABASE_URL`

Akış:

1. Mongo ve PostgreSQL'e en fazla 5 bağlantılı pool açılır.
2. Mongo collection'ları `_id` sırasıyla bounded cursor/batch kullanarak okunur.
3. Legacy ID'lerden domain-salted SHA-256 ile deterministic UUIDv5 benzeri UUID
   üretilir; mevcut UUID user ID'leri korunur.
4. PostgreSQL satırları `legacy_mongo_id` conflict key'iyle upsert edilir.
5. Embedded routine/workout exercise/set ve post media kayıtları normalize edilir.
6. Batch transaction başarısızsa tek kayıt transaction'ına düşülerek hatalı legacy
   ID raporlanır.
7. Conversation/message gibi bağımlı yapılarda eksik parent gerektiğinde
   deterministic synthetic kayıt üretilir.
8. Son reconciliation aşaması derived sayaçları ve last-message bağlantılarını
   tamamlar.

Komutlar:

```bash
corepack pnpm --filter @motionmeet/database-migration typecheck
corepack pnpm --filter @motionmeet/database-migration migrate
corepack pnpm --filter @motionmeet/database-migration verify
```

`verify` collection/table count'larını, legacy mapping örneklerini, orphan FK
olasılıklarını, self-edge'leri, kritik user alanlarını, natural-key edge'lerini
ve S3 object key kapsamını karşılaştırıp tek JSON raporda `valid` üretir. Migration
öncesinde her iki sistemin doğrulanmış backup'ı alınmalı; Mongo kaynak salt
okunur tutulmalı ve final doğrulama bitmeden eski kaynak silinmemelidir.

## 15. Temel uçtan uca veri akışları

### 15.1 Kayıt ve login

```text
Web/Mobile form doğrulaması
 -> auth endpoint rate limit
 -> server-side normalize + validation
 -> bcrypt hash/compare
 -> users + Free plan
 -> sessions tablosunda hash'li refresh secret
 -> 15 dakikalık access JWT
 -> web: HttpOnly cookie / mobile: SecureStore refresh token
 -> AuthProvider
 -> authenticated route + SocketProvider
```

### 15.2 Antrenman kaydetme

```text
Active workout draft
 -> shared operationId
 -> POST /api/workout
 -> input/time/set/exercise sahipliği doğrulaması
 -> plan monthly quota reservation
 -> workouts + workout_exercises + workout_sets
 -> daily workout/exercise/muscle aggregate
 -> personal record upsert
 -> user total counters
 -> tek transaction commit
 -> history ve chart ekranları aggregate tablolardan okur
```

### 15.3 Medyalı gönderi

```text
Picker/File
 -> MIME + size doğrulama
 -> /api/media/presign
 -> upload_reservations
 -> istemci -> S3 PUT
 -> /api/post/add(object keys + operationId)
 -> S3 HEAD + range signature kontrolü
 -> ImageKit URL
 -> posts + post_media + quota + reservation commit transaction
 -> feed cache invalidation
```

### 15.4 Mesaj

```text
Socket send_message veya HTTP /api/message/send
 -> token + privacy/plan izni + rate limit
 -> canonical pair_key
 -> conversation/participants oluştur veya bul
 -> messages insert + unread + last message transaction
 -> recipient ve sender user room'larına emit
 -> web/mobile Redux ve unread badge güncellemesi
```

### 15.5 Hesap silme

```text
Authenticated ve rate-limited delete request
 -> profile/post/story/message/upload S3 key'lerini deletion queue'ya yaz
 -> dış kullanıcı sayaçlarını düzelt
 -> ilgili conversation'ları ve user satırını sil
 -> FK cascade ile sahip olunan veriyi temizle
 -> cache prefix'lerini invalidate et
 -> media worker S3 nesnelerini retry ederek siler
```

## 16. Environment değişkenleri

### 16.1 Backend

| Değişken | Zorunluluk/amaç |
| --- | --- |
| `NODE_ENV` | `development`, `test`, `production`. |
| `PORT` | API/Socket portu; varsayılan 4000. |
| `DATABASE_URL` | Zorunlu PostgreSQL URL. Production'da TLS'li managed bağlantı önerilir. |
| `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX` | Pool boyutu; tüm replica toplamı DB kapasitesine göre hesaplanır. |
| `DATABASE_CONNECTION_TIMEOUT_MS`, `DATABASE_IDLE_TIMEOUT_MS` | Pool timeout değerleri. |
| `REDIS_URL` | Opsiyonel; production'da authenticated `rediss://`. |
| `ALLOW_INSECURE_REDIS_TLS` | Yalnız güvenilir private self-hosted istisna. |
| `JWT_SECRET` | Zorunlu; production'da en az 32 karakter/random byte seviyesi. |
| `FRONTEND_URL` | Browser origin ve e-mail link kökü; production HTTPS. |
| `CORS_ORIGINS` | Virgülle ayrılmış tam origin allowlist'i. |
| `RUN_MIGRATIONS` | Startup migration kontrolü; varsayılan açık. |
| `RUN_SCHEDULED_JOBS` | Cron worker'ları açar/kapatır. |
| `GLOBAL_RATE_LIMIT_PER_15_MIN` | 100–10000 arasında global API limiti. |
| `MEDIA_UPLOADS_ENABLED` | S3/ImageKit capability feature flag'i. |
| `EMAIL_ENABLED` | SMTP/outbox e-mail capability flag'i. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME` | S3 erişimi. Production'da mümkünse static key yerine workload role tercih edilmelidir. |
| `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` | Public media URL/transform servisi. |
| `SMTP_USER`, `SMTP_PASS`, `SENDER_EMAIL` | Brevo/Nodemailer e-posta bilgileri. |
| `CDN_URL` | Exercise seed public medya kökü. |
| `ALLOW_DEFAULT_USER_SEED`, `SEED_DEFAULT_USER_EMAIL`, `SEED_DEFAULT_USER_PASSWORD` | Yalnız açıkça onaylı development seed'i. |

Production environment loader; insecure URL, zayıf JWT, eksik capability
credential'ı ve uyumsuz pool değerlerinde fail-fast davranır. Secret'lar `.env`
veya secret manager'da kalmalı, örnek dosyalara gerçek parola yazılmamalıdır.

### 16.2 Web

| Değişken | Amaç |
| --- | --- |
| `VITE_BASEURL` | API origin; boşsa Nginx same-origin proxy. |
| `VITE_SOCKET_URL` | Socket origin; boşsa API veya current origin. |
| `VITE_BUILD_SOURCEMAP` | Production sourcemap üretimi. |

Vite değişkenleri build-time'dır; secret içermemelidir.

### 16.3 Mobile

| Değişken | Amaç |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | API ve Socket origin'i; public bundle içine gömülür. |
| `EXPO_PUBLIC_WEB_URL` | Web/terms/privacy origin'i; public bundle içine gömülür. |
| `EXPO_NO_DEPENDENCY_VALIDATION` | Expo CLI online version lookup'ını kapatır. |
| `REACT_NATIVE_PACKAGER_HOSTNAME` | LAN Metro host'u; local-network script'i üretir. |

`EXPO_PUBLIC_*` değerleri secret değildir ve uygulama binary'sinden okunabilir.

### 16.4 LAN helper

| Değişken | Amaç |
| --- | --- |
| `MOTIONMEET_LAN_IP` | Otomatik adapter seçimini override eder. |
| `MOTIONMEET_BACKEND_PORT` | Varsayılan 4000. |
| `MOTIONMEET_WEB_PORT` | Varsayılan 5173. |
| `MOTIONMEET_EXPO_PORT` | Varsayılan 8081. |

## 17. Yerel geliştirme

### 17.1 Ön koşullar

- Node.js 22.22 veya üstü
- Corepack
- pnpm 11.10
- PostgreSQL 18 ve isteğe bağlı Redis ya da Docker Desktop
- Android için Android Studio/SDK; iOS native build için macOS/Xcode

Kurulum ve kalite zinciri:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

### 17.2 Servis komutları

```bash
# Turbo ile bütün dev servisleri
pnpm dev

# Tek servis
pnpm dev:backend
pnpm dev:web
pnpm dev:mobile

# Fiziksel Expo cihazı için otomatik LAN adresi
pnpm local:ip
pnpm dev:local

# Ayrı terminallerde LAN servisleri
pnpm dev:local:backend
pnpm dev:local:web
pnpm dev:local:mobile
```

`local-network.mjs` Wi-Fi'ye en yüksek, fiziksel Ethernet'e ikinci önceliği
verir; WSL, Hyper-V, VirtualBox, VMware, Docker, VPN, tunnel ve loopback
adapter'larını dışlar. Portu başlatmadan önce dinlenebilirliği kontrol eder.
`all` modunda servislerden biri durursa kalan child process'leri de kontrollü
durdurur.

Varsayılan portlar:

| Servis | Port |
| --- | ---: |
| Backend HTTP + Socket.IO | 4000 |
| Web/Vite | 5173 |
| Expo/Metro | 8081 |
| PostgreSQL | 5432 |
| Redis | 6379; bazı yerel kurulumlarda host override kullanılabilir |

## 18. Docker ortamları

### 18.1 Development Compose

`docker-compose.yml` şu servisleri kurar:

- PostgreSQL 18 Alpine, kalıcı `postgres_dev_data` volume;
- Redis 7.4 Alpine, AOF açık, `noeviction`, kalıcı `redis_dev_data`;
- backend dev image, source bind mount ve health dependency;
- Vite web dev image;
- `mobile` profile seçilirse Expo LAN servisi.

PostgreSQL ve Redis health check başarılı olmadan backend; backend readiness
başarılı olmadan web/mobile başlatılmaz.

```bash
docker compose up --build --wait
docker compose --profile mobile up --build
```

### 18.2 Test Compose

`docker-compose.test.yml` host 5433'e açılan, data dizini tmpfs olan izole
`postgres-test` sağlar. Test bitiminde veri kalıcı değildir.

```bash
docker compose -f docker-compose.test.yml up -d --wait
DATABASE_URL='postgresql://postgres:motionmeet-test@127.0.0.1:5433/motionmeet_test' \
  pnpm --filter @motionmeet/backend migrate:postgres
DATABASE_URL='postgresql://postgres:motionmeet-test@127.0.0.1:5433/motionmeet_test' \
  pnpm --filter @motionmeet/backend test:integration
docker compose -f docker-compose.test.yml down
```

### 18.3 Production Compose

Production Compose yalnız backend ve web'i paketler. PostgreSQL ve Redis image'ı
bilinçli olarak içermez; authenticated, TLS, backup/failover özellikli managed
servis URL'leri beklenir.

- Backend multi-stage build'de shared ve backend TypeScript derlenir; runtime'a
  production dependency ve `dist` dışında kaynak taşınmaz.
- Runtime `node` user'ı ve `tini` ile çalışır.
- Web Vite build'i unprivileged Nginx ile servis edilir.
- Container'lar read-only filesystem, tmpfs, `no-new-privileges` ve tüm Linux
  capability'lerini drop ederek çalışır.
- Backend dışarı doğrudan publish edilmez; edge network'te web proxy arkasındadır.

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

TLS termination Nginx container'ın önünde yapılmalı; forwarded host/protocol
korunmalıdır.

## 19. Test, CI ve kalite güvence

### 19.1 Mevcut otomatik kontroller

- Backend unit testleri: auth validation, environment validation, pagination,
  security helpers, workout metrics ve DB contract.
- PostgreSQL concurrency integration: retry idempotency, sayaç yarışları, quota,
  conversation uniqueness, analytics ve durable media deletion davranışı.
- Shared contract testleri.
- Web: lint, strict typecheck, production Vite build, public artefakt güvenlik
  taraması ve gzip başlangıç/chunk bütçesi.
- Mobile: lint, strict typecheck, Expo export/build ve backup/permission config
  güvenlik testi; export bundle/source-map/secret ve büyüme bütçesi.
- Kök: Turbo üzerinden bütün paketlerde lint/typecheck/test/build.
- CI: production dependency audit (`high` seviyesi), frozen install ve production
  Compose config kontrolü; izole PostgreSQL başlatma, migration ve test.
- OpenAPI: `redocly.yaml` mevcut; lint komutu kök script'e henüz bağlanmamıştır.
- Responsive native davranış için `docs/mobile-responsive-audit.md` içinde cihaz,
  dp, font scale, keyboard, safe-area ve modal regresyon matrisi bulunur.

### 19.2 Manuel release smoke kapsamı

Production sonrası en az registration, login/logout, password reset, profile,
privacy, workout, stats, routines, feed visibility, follow/connect, posts,
stories, messages, media upload, export ve account deletion ayrı QA hesaplarıyla
doğrulanmalıdır. S3 testinde presign, PUT, signature verify, public URL ve delete
job tamamlanması birlikte kontrol edilmelidir.

## 20. Güvenlik modeli

- Strict environment validation ve production HTTPS zorunluluğu.
- Helmet, explicit CORS allowlist ve trust-proxy ayarı.
- Nginx/Vercel CSP, HSTS, frame deny, nosniff, referrer ve permissions policy.
- Cookie refresh/logout için exact-origin + custom-header CSRF doğrulaması.
- JSON/multipart content-type allowlist'i, 500 KB JSON body ve endpoint bazlı
  Multer dosya/adet/alan limitleri.
- Global, auth, account, media ve custom exercise rate limitleri.
- Password hash, hash'li refresh/reset secret; kısa access token; refresh rotation.
- Role, ownership, privacy ve plan-feature kontrolleri.
- SQL identifier/legacy import doğrulaması ve Kysely parameter binding.
- S3 key sanitization, MIME allowlist, HEAD ve magic-byte doğrulaması.
- Public error response'ta stack/DB detail/secret yok; sunucu üretimli request ID
  ile correlation.
- Production container non-root, read-only ve capability'siz.
- `.env`, key/certificate, dataset ve build artifact'leri source control dışında.

## 21. Operasyon ve gözlemlenebilirlik

Production'da izlenmesi gerekenler:

- `/health/live` ve `/health/ready`;
- HTTP 4xx/5xx oranı, request latency ve request ID korelasyonu;
- PostgreSQL pool saturation, connection timeout ve slow query planları;
- Redis ready/degraded durumu ve reconnect olayları;
- Socket bağlantı sayısı ve instance'lar arası adapter sağlığı;
- outbox pending/attempt/lag;
- media deletion backlog ve S3 hata oranı;
- abandoned upload ve expired story temizleme gecikmesi;
- disk değil managed PostgreSQL point-in-time backup ve düzenli restore testi;
- JWT, DB, Redis, AWS/ImageKit ve SMTP credential rotation.

Yüksek maliyetli sorgular production benzeri veri üzerinde
`EXPLAIN (ANALYZE, BUFFERS)` ile ölçülmelidir. Index ekleme ölçülen query planına
dayanmalı, varsayımla yapılmamalıdır.

## 22. Bilinen boşluklar ve teknik borçlar

Bu bölüm mevcut kaynak durumunu dürüstçe kaydeder:

1. `.github/workflows/ci.yml` PostgreSQL test servisi, migration ve test akışına
   güncellenmiştir; değişikliğin GitHub-hosted runner üzerindeki ilk gerçek koşusu
   bu yerel incelemenin kapsamı dışındadır.
2. Kök `.env.development.example` içinde eski `MONGO_PORT` satırı vardır; güncel
   development Compose bu değeri kullanmaz.
3. `packages/backend/Dockerfile` düz dosyası `server.js` başlatmaya çalışır ve
   strict TypeScript geçişi sonrası canonical değildir. Compose tarafından
   kullanılan `Dockerfile.dev` ve `Dockerfile.prod` güncel yollardır.
4. `packages/web/Dockerfile` düz varyantı shared build adımını açıkça çalıştırmaz;
   production için canonical dosya `Dockerfile.prod`'dur.
5. OpenAPI temel endpoint'leri kapsar; runtime'daki bazı legacy alias ve
   idempotent like route'larıyla düzenli olarak senkron kontrol edilmelidir.
6. Stripe alanları schema/plan modelinde vardır fakat billing provider,
   checkout, webhook ve subscription reconciliation implementasyonu yoktur.
7. Notification tipi ve mobil Notifications ekranı vardır; ayrı kalıcı
   `notifications` tablosu veya push notification provider'ı yoktur.
8. Shared tiplerde `SavedItem/Favorite` sözleşmesi bulunur; backend'de saved-post
   veya favorite tablosu/route'u yoktur.
9. AWS kaynakları repository içinde IaC ile provision edilmez. Bucket/IAM/CORS/
   lifecycle/CDN ve secret manager ayarları dış deployment sorumluluğudur.
10. Web/mobile için tam otomatik browser/device E2E framework'ü yoktur; mevcut
    güvence typecheck/build, backend integration ve manuel smoke test ağırlıklıdır.
11. Exercise medya lisansı production dağıtımı öncesi ayrıca çözülmelidir.

Bu maddeler çalışan production path'i tarif eden bölümlerle karıştırılmamalı;
teknik borç kapatıldığında hem kod hem bu belge birlikte güncellenmelidir.

## 23. Yeni geliştirme eklerken izlenecek yol

Yeni bir domain özelliği eklerken önerilen sıra:

1. Dış request/response ve event sözleşmesini `packages/shared` içinde tanımla.
2. Gerekliyse ileri yönlü, idempotent PostgreSQL migration ekle; rollback ve veri
   koruma davranışını yaz.
3. `db/types.ts` tablo tipini güncelle.
4. SQL erişimini repository/service sınırında tut; multi-table değişikliği tek
   Kysely transaction'a al.
5. Ownership, privacy, role, quota, idempotency ve pagination kurallarını service
   katmanında uygula.
6. Controller'ı yalnız HTTP doğrulama/adaptasyon ve doğru status code için kullan.
7. Route'a limiter/auth/RBAC middleware'lerini açıkça bağla.
8. Cache key ve invalidation kapsamını belirle; Redis yokken doğru PostgreSQL
   fallback'ini koru.
9. Dış yan etki varsa outbox veya durable job kullan; DB transaction içinde S3/
   SMTP gibi remote çağrıya güvenme.
10. Web ve mobile istemcilerini aynı shared sözleşmeye geçir.
11. Unit/contract/concurrency testlerini ve OpenAPI'yi güncelle.
12. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` ve ilgili manuel smoke
    matrisini çalıştır.

## 24. Hızlı kaynak rehberi

| Sorunun cevabı | Bakılacak ana kaynak |
| --- | --- |
| API nerede başlıyor? | `packages/backend/server.ts` |
| Bir endpoint gerçekten var mı? | `packages/backend/routes/*.ts`, ardından controller |
| Domain kuralı/transaction nerede? | `packages/backend/services/*.ts` |
| SQL satırı API tipine nasıl dönüşüyor? | `packages/backend/repositories/*.ts` |
| DB'de hangi tablo/constraint/index var? | `db/migrations/001_*`, `002_*`, `003_*` ve `db/types.ts` |
| Ortak API route ve tipler? | `packages/shared/src/index.ts`, `src/types/*` |
| Web route'ları? | `packages/web/src/App.tsx` |
| Mobile route/tab/stack? | `packages/mobile/src/navigation/*` |
| Auth token davranışı? | Backend `utils/authTokens.ts`; web/mobile `AuthProvider.tsx` |
| Redis fallback'i? | `packages/backend/configs/redis.ts` |
| S3 upload ve delete? | `services/mediaUploadService.ts`, `mediaDeletionService.ts`, `utils/s3Utils.ts` |
| Cron/outbox? | `workers/cronJobs.ts`, `services/outboxService.ts` |
| Eski veriyi nasıl taşırım? | `tools/database-migration` ve `docs/database.md` |
| Production nasıl yayınlanır? | `docker-compose.prod.yml`, `docs/production.md` |
| API sözleşme dökümanı? | `docs/openapi.yaml` |
| Mobile responsive kontrolü? | `docs/mobile-responsive-audit.md` |

## 25. Tek cümlelik mimari özeti

MotionMeet; ortak TypeScript sözleşmeleri kullanan React web ve Expo mobile
istemcilerini, Express/Socket.IO backend'e bağlayan; bütün kalıcı ve ilişkisel
veriyi PostgreSQL'de, geçici hızlandırma ve koordinasyonu Redis'te, binary medyayı
AWS S3 + ImageKit üzerinde tutan; transaction, idempotency, durable outbox/job,
strict validation ve güvenli production container prensipleriyle tasarlanmış bir
sosyal fitness monoreposudur.
