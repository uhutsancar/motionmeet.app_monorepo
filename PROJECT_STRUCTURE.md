# MotionMeet — kapsamlı proje yapısı ve mimari referansı

> Son kaynak incelemesi: 23 Ağustos 2026
>
> Repository türü: pnpm workspace + Turborepo monorepo
>
> Ana amaç: antrenman takibi ile sosyal fitness deneyimini web ve mobil istemcilerde aynı API sözleşmesi üzerinden sunmak
>
> Bu sürümdeki en büyük eklemeler:
>
> - **Tek marka kaynağı.** Launcher ikonu, splash, favicon ve uygulama içi logo
>   artık iki SVG dosyasından üretilir; ikinci bir logo varlığı repository'de
>   bulunmaz. **13A** bölümü.
> - **Hikâye sisteminin yeniden yazımı.** Konumlanabilir metin/konum katmanları,
>   galeri-önce akış, sürükle-bırak silme ve iki istemcide birebir aynı
>   yerleşim. **14B** bölümü.
> - **Keşfet sekmesi ve kişi arama.** **14C** bölümü.
> - **Yeni mobil navigasyon.** Mesajlar sekmeden çıkıp feed başlığına taşındı.
>   **12.3** bölümü.
> - **Performans ve ölçeklenme sertleştirmesi.** Cache invalidation prefix
>   taramasından owner-addressed hash'e geçti ve artık yalnız yazan üyenin
>   cache'ini düşürüyor; feed miss'i single-flight ile korunuyor; kişi araması
>   indekslendi; medya CDN'den ekran boyutunda isteniyor. **8.1**, **8.3**,
>   **7.6**, **9.6** bölümleri ve `docs/PERFORMANCE_AUDIT.md`.
>
> Bir önceki sürümün büyük eklemesi olan profil konumu ve yakındakiler
> özellikleri **14A** bölümünde anlatılır.

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
- egzersiz kataloğunu arayabilir, filtreleyebilir ve kendi egzersizlerini
  oluşturabilir;
- sıralı egzersiz ve setlerden rutin hazırlayabilir;
- antrenman kaydedebilir; süre, hacim, tekrar, set, kas dağılımı, seri ve kişisel
  rekor istatistiklerini görebilir;
- metin, görsel, video veya antrenman bağlantılı gönderi paylaşabilir;
- gönderileri beğenebilir, yorumlayabilir ve görünürlük kurallarına göre feed
  görüntüleyebilir;
- 24 saatlik hikâyeler oluşturabilir: galeriden bir görsel/video seçer, üzerine
  taşınabilir, ölçeklenebilir ve döndürülebilir metin ile konum etiketi
  yerleştirir, kimlerin görüntülediğini görür, başkalarının hikâyesine doğrudan
  mesajla yanıt verir;
- Keşfet sekmesinde topluluğun görselli gönderilerini üç sütunlu bir ızgarada
  gezebilir ve kullanıcı adına ya da ada göre kişi arayabilir;
- kullanıcıları takip edebilir, bağlantı isteği gönderebilir ve kabul edebilir;
- gerçek zamanlı mesajlaşabilir, yazıyor ve çevrim içi durumlarını görebilir;
- plan özellikleri ve kotalarına göre ürün yeteneklerini kullanabilir;
- profiline dünya genelinde doğrulanmış bir konum (şehir/ilçe/ülke) seçebilir ve
  bunu kimlerin göreceğini belirleyebilir;
- açık izniyle yakınındaki sporcuları bulabilir; mesafeler yalnız kilometre
  ölçekli aralık olarak gösterilir, kesin konum hiç kimseye açılmaz;
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
- **Konum için üçüncü taraf servise sorgu başına ödeme yapılmaz.** Ülke/şehir
  verisi bir kez PostgreSQL'e alınır, yakınlık hesabı da veritabanında yapılır;
  Google Places veya benzeri bir geocoding API'si çağrılmaz.
- **Hassas koordinat asla istemciye dönmez.** GPS fix'i ayrı bir tabloda kalır ve
  dışarıya yalnız kilometre ölçekli bir mesafe bandı olarak yansır.

## 3. Ana dizin ağacı

```text
motionmeet.app_monorepo/
├─ .github/workflows/ci.yml       # GitHub Actions doğrulama hattı
├─ brand/                         # Marka işaretinin TEK kaynağı (iki SVG + README)
│  ├─ motionmeet-mark.svg         # Yuvarlatılmış kare zeminli tam işaret
│  └─ motionmeet-glyph.svg        # Zeminsiz glif (maskeleyen platformlar için)
├─ docs/                          # DB, production, OpenAPI, lisans ve responsive notları
│  ├─ LICENSES.md                 # Konum ve egzersiz veri setlerinin lisans yükümlülükleri
│  ├─ PERFORMANCE_AUDIT.md        # Ölçülmüş darboğaz denetimi ve yapılan optimizasyonlar
│  └─ mobile-qa-apk.md            # Yerel backend'e bakan sideload APK tarifi
├─ exercises-dataset-main/        # Yerel/ignore edilen egzersiz veri snapshot'ı
├─ packages/
│  ├─ backend/                    # Express + Socket.IO + PostgreSQL uygulaması
│  ├─ web/                        # React/Vite tarayıcı uygulaması
│  ├─ mobile/                     # Expo/React Native uygulaması
│  └─ shared/                     # Ortak route, limit ve TypeScript sözleşmeleri
├─ patches/                       # pnpm patchedDependencies yamaları
├─ scripts/
│  ├─ local-network.mjs           # LAN IP tespiti ve üç servisi yerelde başlatma
│  └─ generate-brand-assets.mjs   # brand/*.svg -> bütün platform rasterleri
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
| `docs/PERFORMANCE_AUDIT.md` | Ölçülmüş performans denetimi: darboğazlar, kanıtları, yapılan optimizasyonlar ve önce/sonra sayıları. Bu belge mimariyi anlatır, o belge o mimarinin nerede ne kadar hızlı olduğunu ölçer. |
| `.dockerignore` | Dependency, secret, build çıktısı ve lisansı netleşmemiş exercise dataset'ini Docker context dışında bırakır. |
| `.gitignore` | `.env*`, dependency, build, Expo ve mobil `dist-*` artifact'lerini takip dışı bırakır; izin verilen environment örnekleri istisnadır. |
| `patches/minimatch@3.1.5.patch` | `brace-expansion` CommonJS/export biçimiyle uyumluluk sağlar. |
| `brand/` | Marka işaretinin tek kaynağı. Uygulamaların gönderdiği her ikon buradan türetilir; elle düzenlenmiş bir PNG repository'de bulunmaz. Ayrıntı: **13A**. |
| `scripts/generate-brand-assets.mjs` | `pnpm brand`. İki SVG'den Android launcher/adaptive/splash ikonlarını, web favicon setini, apple-touch ikonunu ve web logosunu üretir. |
| `docs/mobile-qa-apk.md` | Fiziksel cihazda yerel backend'e bakan release APK üretme tarifi; `EXPO_PUBLIC_*` değerlerinin neden `.env.local`'a yazılması gerektiğini de açıklar. |

## 4. Teknoloji matrisi

| Katman | Ana teknolojiler |
| --- | --- |
| Monorepo | pnpm 11.10 workspaces, Turborepo 2.5, TypeScript 5.8 |
| Runtime | Geliştirme/CI için Node.js 22.22+, container build/runtime için Node.js 24 Alpine |
| Backend | Express 5.1, Kysely 0.29, `pg` 8.22, Socket.IO 4.8, JWT, bcryptjs, Helmet, CORS, Multer |
| Kalıcı veri | PostgreSQL 18, `pgcrypto`, `citext`, `pg_trgm`, opsiyonel `postgis`, UUID, enum, FK, check, trigger ve composite/partial/GIN/GiST index'ler |
| Konum verisi | Countries States Cities Database `v3.2-export.7` (ODbL v1.0), PostgreSQL'e sınırlı alan seti olarak import edilir |
| Geçici altyapı | Redis 7.4, Redis rate-limit store, Socket.IO Redis adapter |
| Medya | AWS SDK v3 S3, multipart upload, presigned PUT, ImageKit URL dönüşümü |
| E-posta | Nodemailer 9, Brevo SMTP relay (`smtp-relay.brevo.com:587`) |
| Web | React 19.2, React Router 8, Vite 7, MUI 7, Emotion, Redux Toolkit 2, Axios, Recharts, dayjs, i18next, Socket.IO client (dinamik import) |
| Mobile | Expo SDK 54, React Native 0.81.5, React 19.1, React Navigation 7, React Native Paper 5, SecureStore, AsyncStorage, Expo Image/Video/ImagePicker/Location/Localization |
| Production web | Multi-stage Vite build + unprivileged Nginx Alpine |
| Marka varlıkları | Kaynak SVG + `sharp` 0.35 (yalnız kök devDependency; build-time raster üretimi, runtime'da kullanılmaz) |
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
│  └─ types.ts    # 41 uygulama tablosunun tipli DB sözleşmesi
├─ middlewares/   # JWT auth, DB user bağlama, RBAC, request ID, error handling
├─ realtime/      # Socket.IO auth sonrası mesaj/presence/typing işleyicileri
├─ repositories/  # SQL okuma/hydration ve DB entity -> API entity dönüşümü
├─ routes/        # Express endpoint tanımları ve endpoint bazlı limiter'lar
├─ scripts/       # Migration, seed, admin promote ve exercise S3 upload görevleri
├─ services/      # Transaction ve domain kuralları
│                 #   feedCache.ts = cache invalidation politikasının tek sahibi (8.1)
├─ tests/         # Unit/contract/concurrency testleri
├─ types/         # Express request genişletmeleri
├─ utils/         # Token, doğrulama, pagination, medya, plan ve metrik yardımcıları
│                 #   singleFlight.ts = cache miss'i tek sorguya indirger (8.3)
├─ workers/       # Cron tabanlı bakım ve durable job tüketicileri
└─ server.ts      # Composition root ve process yaşam döngüsü
```

### 6.2 Başlangıç sırası

`server.ts` aşağıdaki sırayı uygular:

1. Environment yüklenir ve zorunlu değerler doğrulanır.
2. PostgreSQL pool üzerinden `select 1` ile bağlantı kurulur.
3. `RUN_MIGRATIONS=false` değilse Kysely migration'ları son sürüme taşınır.
   Migration'lar istek havuzunu değil `createMaintenanceDatabase()` ile açılan
   ayrı, tek bağlantılı ve `statement_timeout`'suz bir havuzu kullanır: büyük bir
   tabloda index oluşturmak istek trafiği için konmuş 15 saniyelik tavanın çok
   üstünde sürer ve yarıda kesilmesi yavaş bir boot'tan kötüdür.
4. Beklenen tablo/migration contract'ı kontrol edilir.
5. Kas grupları ve ekipman lookup kayıtları idempotent biçimde bootstrap edilir.
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
| Story | `POST /api/story/create`; `GET /api/story/get`; `DELETE /api/story/delete/:storyId`; `POST /api/story/:storyId/view`; `GET /api/story/:storyId/viewers` | 24 saatlik içerik, üstüne yerleştirilen metin/konum katmanları (`overlays`), görüntüleme makbuzu ve yalnız yazarına açık izleyici listesi. Ayrıntı: **14B**. |
| Message | `POST /api/message/send`, `/get`, `/seen`; `GET /conversations`, `/recent`; `DELETE /delete/:messageId` | HTTP mesaj fallback'i, conversation, unread/seen ve silme. |
| Workout | `GET/POST /api/workout`, `GET /api/workout/stats` | Antrenman yazma, geçmiş ve aggregate istatistikler. |
| Routine | `GET/POST /api/routine`, `PUT/DELETE /api/routine/:id` | Kullanıcı rutinleri ve kullanım kotası. |
| Exercise | `GET/POST /api/exercise`, `GET /records`, `GET /:id`, `GET /:id/stats` | Katalog, custom exercise ve analitik. |
| Emekli | `/api/plans`, `/api/payments` (her metot ve alt yol) | Ücretli plan satışı kaldırıldı; gövde okunmadan `410 Gone` (`middlewares/retiredBilling.ts`). |
| Lookup | `GET /api/muscle-groups`, `GET /api/equipment` | Aktif master data. |
| Location | `GET /api/locations/search`, `/countries`, `/recent`, `/attribution`, `/:kind/:id`; `POST /api/locations/resolve` | Dünya ülke/bölge/şehir referans verisinde arama, tekil kayıt okuma, koordinattan öneri üretme ve ODbL attribution metni. |
| Profil konumu | `GET/PUT/PATCH/DELETE /api/user/location` | Dataset kaydına referansla profil konumu okuma, kaydetme, görünürlük değiştirme ve kaldırma. |
| Nearby | `GET/PATCH /api/nearby/settings`; `PUT/DELETE /api/nearby/position`; `GET /api/nearby/users` | Yakındakiler tercihleri, GPS fix yazma/silme ve mesafe bandıyla yakın kullanıcı listesi. |
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

### 6.6 Yetkilendirme, gizlilik ve kullanım kotaları

`protect` geçerli Bearer token'ı doğrular. `attachDbUser` gerektiğinde kullanıcıyı
veritabanından yükler. RBAC rolleri `user`, `admin`, `superadmin` enum'udur;
admin API şu an yalnız superadmin'e açıktır ve superadmin kendi rolünü düşüremez.

Gizlilik alanları:

- `publicProfile`
- `showWorkoutsOnFeed`
- `allowFollowers`
- `showInSearch`
- `allowMessages`

Profil erişimi, takip, discovery ve mesaj izni service katmanında bu alanlara ve
ilişki durumuna göre kontrol edilir.

MotionMeet her üyeye ücretsizdir; ürün katmanı yoktur. `configs/usageLimits.ts`
yalnız kötüye kullanım tavanları tanımlar ve her üyeye aynıdır; superadmin
muaftır (`-1` = sınırsız):

| Kaynak | Tavan | Bucket |
| --- | ---: | --- |
| Antrenman | 300 | aylık |
| Rutin | 200 | toplam |
| Gönderi | 100 | günlük |
| Story | 100 | günlük |

Kota rezervasyonları `usage_counters` tablosunda transaction içinde atomik
artırılır; aynı anda gelen istekler limiti aşamaz. Kısa süreli patlamalar
route bazlı rate limiter'ların işidir.

### 6.7 Domain service'leri ve önemli transaction sınırları

- **Workout:** workout, exercise snapshot ve set satırları aynı transaction'da
  yazılır; kota rezerve edilir, günlük analytics ve personal record güncellenir,
  kullanıcının toplam sayaçları artırılır.
- **Routine:** rutin ve sıralı child satırları transaction'da yeniden oluşturulur;
  ownership ve kullanım kotası kontrol edilir.
- **Post:** operation ID ile retry-safe oluşturma, görünürlük kontrolü, workout
  sahipliği, media reservation commit'i ve günlük kota aynı domain akışındadır.
- **Like/comment:** composite key ile duplicate like engellenir; like/comment
  sayaçları edge kaydıyla aynı transaction'da değişir. Post satırı **kilitlenmez**
  (`FOR UPDATE` yok): duplicate'i zaten `post_likes` composite primary key
  engelliyor ve sayaç atomik bir delta, dolayısıyla satır kilidi yalnız popüler
  bir gönderiye gelen like'ları sıraya sokardı. Sayaç `UPDATE ... RETURNING` ile
  aynı statement'ta okunur. Bildirim satırı transaction'dan sonra kalıcı olarak
  yazılır, ama **yayını** HTTP yanıtını bekletmez — satır zaten kalıcıdır ve
  alıcının açık soketi olmayabilir.
- **Story:** expiry, visibility, view edge ve medya lifecycle birlikte yönetilir.
  Görüntüleme makbuzu Redis'te 6 saat hatırlanır (**8.2**), böylece aynı hikâyeyi
  yeniden açmak ne satır okur ne yetki sorgusu yapar ne de insert dener.
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
- **Profil konumu:** istemcinin gönderdiği id dataset'te yeniden okunur; pasif
  veya bilinmeyen kayıt reddedilir, ülke/bölge/şehir üçlüsü çözülür ve profilde
  görünen etiket backend tarafından üretilir. Serbest metin hiçbir yoldan
  profile ulaşamaz.
- **Yakındakiler:** GPS fix'i yazılırken en yakın dataset şehri bir kez çözülür;
  liste sorgusu artık geocode yapmaz. Sonuç kilometre ölçekli banda indirgenir ve
  bandı belirleyen, arayanın değil karşı tarafın görünürlük tercihidir.

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
dakikada 60'tır.

Mesajlaşma privacy/plan izni 30 saniyelik socket-local bir cache'in arkasındadır
ve bu cache **hem mesaj hem typing yolunda** kullanılır (`mayMessage()`). Gönderen
kaydı handshake'te yüklenir ve 5 dakikada bir tazelenir; tazelendiğinde izin
cache'i temizlenir, böylece bir plan veya rol değişikliği uzun ömürlü bir sokete
de ulaşır. Bu ayrım önemli: aksi hâlde her `send_message` olayı kullanıcıyı
planıyla yeniden yükleyip izni sıfırdan hesaplardı.

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
- `pg_trgm`: konum arama tablolarında GIN trigram indeksleriyle "içinde geçen"
  eşleşmelerini indeksli hale getirir (migration 006).
- `postgis` (**opsiyonel**): kuruluysa migration 006 `location_cities` ve
  `user_locations` üzerine `geography(Point,4326)` generated kolonu ve GiST
  indeksi ekler, sorgular `ST_DWithin` kullanır. Kurulu değilse aynı
  `latitude`/`longitude` kolonları üzerinden bounding box + haversine yolu
  çalışır. Seçim boot'ta `detectGeometrySupport()` ile yapılır; şema iki durumda
  da aynıdır, sonradan PostGIS eklenebilir.
- Enum'lar: `user_role`, `set_type`, `post_type`, `post_visibility`, `media_type`, `story_media_type`,
  `connection_status`, `message_type`, `upload_purpose`, `outbox_status`,
  `outbox_type`. Konum tabloları enum yerine `CHECK` kısıtı kullanır: dataset
  yenilendiğinde yeni bir değer eklemek `ALTER TYPE` gerektirmesin diye.

### 7.3 41 uygulama tablosu

#### Kullanıcı

| Tablo | Ana alanlar ve amaç |
| --- | --- |
| `users` | Kimlik, password hash, profil/kapak key ve URL'leri, rol, privacy, sosyal ve workout toplam sayaçları. Ayrıca profil konumu: `location` (backend'in ürettiği etiket), `location_country_id` / `location_state_id` / `location_city_id` (dataset referansları), `location_source`, `location_visibility`, `location_selected_at`. |

#### Konum referans verisi ve yakınlık

| Tablo | Ana alanlar ve amaç |
| --- | --- |
| `location_countries` | dr5hn dataset'inin kendi integer id'si (PK), ad, Türkçe ad, native ad, ISO2/ISO3, telefon kodu, emoji, koordinat, `search_name`, `is_active`, `dataset_version`. |
| `location_states` | İl/eyalet/bölge katmanı: ülke FK, ad, kod, tür, koordinat, `search_name`, `is_active`, `dataset_version`. |
| `location_cities` | Şehir/ilçe katmanı: ülke ve bölge FK, ad, zorunlu koordinat, sıralama için `population`, `search_name`, `is_active`, `dataset_version`. 152.970 kayıt, ~50 MB. |
| `user_locations` | **Hassas GPS verisi.** Kullanıcı başına tek satır: koordinat, doğruluk, kaynak, çözümlenmiş `city_id`, `enabled`, `visible`, `distance_visibility`, `scope`, `permission_status`, `location_updated_at`. Hiçbir alanı istemciye serialize edilmez. |

`search_name`, importer'ın ürettiği aksan/Türkçe duyarsız arama anahtarıdır
("Nilüfer" → `nilufer`, "İstanbul" → `istanbul`, "Kadıköy" → `kadikoy`). Sorgu
tarafı aynı `normalizeLocationName()` fonksiyonundan geçtiği için yazım
varyasyonları aynı satıra düşer. Dataset id'lerinin korunması, dataset
yenilendiğinde kullanıcıların seçtiği konumun bozulmamasını sağlar: kaybolan
kayıtlar silinmez, `is_active = false` yapılır.

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
| `stories` | Text/image/video içerik, media key/URL, arka plan, `expires_at` ve **`overlays jsonb`** (hikâyenin üstüne yerleştirilen metin/konum katmanları; kare oranına göre normalize edilmiş konumlar). |
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
| `usage_counters` | Kullanım kotası bucket'ları ve expiry. |
| `legacy_billing_archive` | Migration 012'nin kaldırdığı plan/ödeme verisinin JSON arşivi; uygulama okumaz. |
| `outbox_events` | Profil snapshot yayılımı ve connection e-mail event'leri için durable outbox. |

#### Analytics

| Tablo | Ana alanlar ve amaç |
| --- | --- |
| `personal_records` | Kullanıcı-egzersiz başına en iyi ağırlık, tekrar, workout ve kayıt tarihi. |
| `user_daily_workout_stats` | Günlük workout/duration/volume/set/rep aggregate'i. |
| `user_daily_muscle_stats` | Günlük aggregate'e bağlı kas başına set sayısı. |
| `user_exercise_daily_stats` | Kullanıcı-gün-egzersiz başına volume, rep, set, session ve max weight. |

Kysely'nin kendi migration metadata tabloları bu 41 uygulama tablosuna dahil
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
- `user_locations` kullanıcıyla cascade olur: hesap silindiğinde hassas konum
  ayrı bir adım gerektirmeden gider.
- Kullanıcının profil konumu referansları (`location_country_id`,
  `location_state_id`, `location_city_id`) `SET NULL`'dır. Ancak normal akışta bu
  tetiklenmez: dataset yenilendiğinde kaybolan kayıtlar silinmez, `is_active`
  false yapılır — böylece kullanıcının seçtiği yer kaybolmaz, yalnız yeni
  aramalarda seçilemez hale gelir.

### 7.6 Constraint ve index stratejisi

- UUID PK'ler, case-insensitive unique identity alanları ve self-edge check'leri.
- Set/exercise position ve sayıları, weight/reps/duration, counter ve media
  metadata'sı için range check'leri.
- Feed/profile/workout/message/comment/story cursor'ları için
  `(owner/filter, created_at veya start_time, id)` composite index'leri.
- Kişi araması için eşleşme biçimine göre iki ayrı indeks: `username` öneki için
  `lower(username::text) text_pattern_ops` b-tree, `full_name` içinde geçen ifade
  için `lower(full_name) gin_trgm_ops` trigram GIN. İkisi de yalnız
  `privacy_show_in_search` satırlarını kapsayan partial indekslerdir ve sorgu tam
  olarak bu ifadeleri kullanır. Ayrıntı ve ölçüm: migration `009`, **14C.3**.
- Exercise prefix/filter/custom-owner index'leri.
- Follow/connection yönleri ve conversation participants için ters erişim
  index'leri.
- Session, reset token, story, upload reservation ve usage expiry index'leri.
- Outbox/media job claim ve analytics history/rank index'leri.
- Konum arama için her referans tablosunda iki tamamlayıcı indeks: `LIKE 'q%'`
  önek eşleşmesi için `varchar_pattern_ops` b-tree (yalnız `is_active` satırlarda,
  partial), `LIKE '%q%'` için `gin_trgm_ops` trigram GIN. Tek bir sorgu ikisini
  birden BitmapOr ile kullanır.
- Ters coğrafi çözümleme için `location_cities (latitude, longitude)`: dar bir
  enlem bandı taranır, boylam filtresi birkaç yüz satırda çalışır.
- `user_locations` üzerinde partial indeks yalnız `enabled AND visible` satırları
  kapsar; opt-out etmiş kullanıcılar yakınlık sorgusuna hiç girmez.
- PostGIS kuruluysa `location_cities.geo` ve `user_locations.geo` generated
  kolonları üzerinde GiST indeksleri.
- `updated_at` destekleyen tablolarda ortak PostgreSQL trigger'ı; konum tabloları
  da bu trigger'a bağlıdır.

### 7.7 Migration sürümleri

1. `001_initial_postgresql`: extension, 13 enum, 35 tablo, FK/check/unique/index ve
   `updated_at` trigger'ları.
2. `002_partial_idempotency_indexes`: routine/workout/post/story/message operation
   ID'lerini yalnız dolu değerlerde unique yapan beş partial index.
3. `003_detached_exercise_snapshots`: routine/workout exercise FK'lerini nullable
   `ON DELETE SET NULL` yaparak geçmiş snapshot'ı korur.
4. `004_body_measurements`: gün başına tek kayıt kısıtlı vücut ölçüm tablosu.
5. `005_exercise_media_path_style`: egzersiz medya URL'lerini virtual-hosted S3
   yerine path-style endpoint'e taşır.
6. `006_locations_and_proximity`: `pg_trgm`; `location_countries`,
   `location_states`, `location_cities` referans tabloları; `users` üzerine altı
   profil konumu kolonu; hassas `user_locations` tablosu; PostGIS **varsa**
   generated `geography` kolonu ve GiST indeksi. PostGIS varlığı
   `pg_available_extensions` üzerinden `CREATE EXTENSION`'dan **önce** kontrol
   edilir — migrator her migration'ı transaction'a sardığı için başarısız bir
   `CREATE EXTENSION` bütün migration'ı düşürürdü ve try/catch bunu kurtaramaz.
7. `007_follow_requests_and_notifications`: takip etmeyi istek/onay el sıkışmasına
   çevirir. `follow_requests` yalnız bekleyen istekleri tutar; onaylanan istek
   `user_follows` içine taşınıp silinir, böylece "A B'yi takip ediyor mu"
   sorusunun tek cevabı yine `user_follows` olur. Ayrıca `notifications` tablosu
   ve `posts.discover_rank` stored generated kolonu gelir: etkileşim logaritmik
   sayıda günlük tazelik değerindedir, bu sayede Keşfet tüm tabloyu sıralamadan
   popülerliğe göre ilerleyebilir.
8. `008_story_overlays`: `stories` tablosuna `overlays jsonb NOT NULL DEFAULT
   '[]'` kolonu ekler. Çocuk tablo değil jsonb seçilmesinin nedeni, katmanların
   yalnızca tek bir hikâyeye ait tam bir liste olarak okunup yazılması ve
   hikâyelerin bir gün sonra silinmesidir; ayrı tablo, hiçbir yerde ihtiyaç
   duyulmayan join ve cascade maliyeti getirirdi. `DEFAULT '[]'` sayesinde
   migration'dan önce yazılmış her hikâye backfill gerektirmeden "katman yok"
   olarak okunur.
9. `009_user_search_indexes`: kişi aramasını indeksli hâle getirir.
   `users_search_idx` düşürülür — `to_tsvector` üzerine kurulu bir GIN indeksiydi
   ve uygulama hiçbir yerde full-text sorgu yapmadığı için hiçbir zaman
   kullanılmadı, yalnızca her yazımda maliyet üretti. Yerine eşleşme biçimine
   göre iki indeks gelir: `username` prefix'i için
   `users_username_prefix_idx` (B-tree, `lower(username::text) text_pattern_ops`,
   006'daki konum indeksleriyle aynı desen), `full_name` içinde geçen ifade için
   `users_full_name_trgm_idx` (GIN, `gin_trgm_ops`) — baştaki joker karakteri
   B-tree'nin hiç karşılayamadığı durum budur. İkisi de `WHERE
   privacy_show_in_search` ile partial'dır, çünkü sorgu bu koşulu her zaman
   taşır. 200.000 satırda ölçüm: substring araması 128 ms → 5,2 ms, prefix
   araması 169 ms → 0,05 ms.

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

   Feed, profil, yakındakiler ve egzersiz kataloğu **owner-addressed hash**
   olarak tutulur: bir sahibin bütün varyantları (sayfa, cursor, izleyici, filtre)
   tek bir hash'in field'larıdır, dolayısıyla geçersiz kılmak tek bir `DEL`'dir.
   Ayrıntı: **8.1**.

   - `feed:{userId}`, field `{mode}:{cursor}:{limit}` — 30 sn.
   - `profile:{profileId}`, field `{viewerId}:{cursor}:{limit}` — 60 sn.
     **İzleyici field'da kalır ve kalmalıdır:** bir profilin gösterdiği gönderiler,
     konum etiketi ve mesaj düğmesi ilişkiye göre değişir, izleyicileri tek girdide
     birleştirmek gizlilik hatası olurdu. Kazanç, bir profilin bütün izleyici
     kopyalarının tek `DEL` ile düşmesidir.
   - `exercises:list:shared` / `exercises:detail:shared` — 300/900 sn. Katalog
     sorgusu `is_custom = false OR created_by = <üye>` olduğu için, custom
     egzersizi olmayan herkes için **birebir aynıdır** — yani neredeyse herkes
     için. Kullanıcı başına anahtarlamak 1.325 satırlık ortak kataloğun her üyeye
     ayrı bir kopyasını çıkarıyordu. Custom egzersizi olan üye kendi owner'ını
     (`exercises:list:{userId}`) alır; hangisinin geçerli olduğu, yalnız o üye
     custom egzersiz yazdığında tazelenen cache'lenmiş bir boolean'dır
     (`exercises:custom-owner`).

   Bir owner hash'inin field sayısı üst sınırlıdır; cursor çeşitliliği TTL'den
   hızlı büyürse hash yeniden kurulur, sınırsız şişmez.

   Konum özellikleri düz key kullanır:
   - `loc:search:{locale}:{country}:{limit}:{query}` — 600 sn. Konum arama her
     tuş vuruşunda tetiklenebildiği için en yüksek getirili cache burasıdır;
     popüler sorgular 150k satırlık şehir tablosuna hiç inmez.
   - `loc:countries:{locale}` — 3600 sn. 250 satırlık tam ülke listesi.
   - `loc:node:{kind}:{id}:{locale}` — 3600 sn. Tekil dataset kaydı; her profil
     konumu yazımı bu kaydı doğrulamak için okur.
   - `loc:recent:{userId}` — 90 gün. Kullanıcının son seçtiği konumlar.
     **Bilinçli olarak PostgreSQL'de tutulmaz:** cache temizliğinde kaybolması
     sorun değildir ve kullanıcının gezdiği yerlerin izini tutan bir tablo
     daha az olur.
   - `nearby:{userId}` hash'i, field `{scope}:{limit}:{fixTs}` — 45 sn.
     Yakındakiler sonucu. Field'da fix zaman damgası bulunduğu için yeni konum
     yazımı otomatik olarak yeni bir girdi üretir.
2. **Rate limit:** global, auth, account, media presign, custom exercise,
   `location-search`, `nearby-position` ve `nearby-list` limiter'ları. Prefix
   `motionmeet:rate-limit:*`.
3. **Realtime:** Socket.IO publisher/subscriber adapter ve instance'lar arası room
   yayını.
4. **Koordinasyon:** cron lease'leri ve socket message/typing sayaçları.

### 8.1 Cache invalidation politikası

Tek kural: **bir write yalnızca onu yapan üyenin cache'ini düşürür.**

`services/feedCache.ts` bu politikanın tek sahibidir; `invalidateOwnFeed`,
`invalidateProfile` ve `invalidateMember` dışında hiçbir servis feed veya profil
cache'ini kendi başına silmez.

Bu daraltma bilinçlidir. Önceki davranış her like, comment, gönderi, takip ve
profil güncellemesinde **bütün** üyelerin feed cache'ini siliyor ve bunu
`SCAN ... MATCH` ile keyspace'in tamamını gezerek yapıyordu — yani popüler bir
gönderi tüm nüfusu kalıcı cache miss'te tutabiliyordu. Kendi yazdığını anında
görmesi gereken tek kişi eylemi yapandır: kendi gönderisi feed'in başında, kendi
beğenisi `liked_by_me`'de, kendi takibi `author_followed_by_me`'de. Herkes için
değişen şey bir sayacın bir artmasıdır ve onu 30 saniyelik TTL zaten taşır.
Başkalarının cache'indeki yazar snapshot'ı ayrıca `user.profile.updated` outbox
event'iyle tazelenir.

`KEYS` hiçbir yerde kullanılmaz; prefix `SCAN` de artık kullanılmaz.

### 8.2 Tekrar eden işi atlama

`wasDone` / `markDone` (`motionmeet:v1:done:*`), tekrarı aynı sonuca varacak bir
işi atlamak için kullanılır. Bugünkü tek kullanıcısı hikâye görüntüleme
makbuzudur: makbuz yalnızca satır kalıcı olduktan **sonra** yazılır, böylece
başarısız bir yetkilendirme veya insert sonraki denemeyi bastırmaz. Redis yoksa
`wasDone` her zaman `false` döner ve çağıran kendi kalıcı garantisine
(`ON CONFLICT DO NOTHING`) düşer — bu bir optimizasyondur, doğruluğun kaynağı
değildir.

### 8.3 Cache stampede

Feed cache miss'i `utils/singleFlight.ts` ile sarılıdır: aynı anahtar için
bekleyen bütün istekler tek bir çalıştırmayı paylaşır. Process-local'dir;
dağıtık lock her miss'e bir Redis round-trip ekler ve N instance ile fan-in
zaten "istek başına bir sorgu"dan "instance başına bir sorgu"ya iner.

### 8.4 Degraded mode ve production gereklilikleri

Redis opsiyoneldir. Bağlantı yoksa:

- cache doğrudan PostgreSQL'e düşer;
- Express limiter adaptive store içindeki process-local memory fallback'i kullanır;
- socket limitleri process-local Map'e düşer;
- cron lock görevi doğrudan çalıştırır;
- Socket.IO yalnız aynı instance içinde realtime yayın yapar;
- PostgreSQL'deki kalıcı veri ve durable job'lar kaybolmaz;
- `wasDone` her zaman `false` döner, yani tekrarlanan iş atlanmaz ama yanlış da
  yapılmaz (**8.2**);
- `singleFlight` çalışmaya devam eder — process-local olduğu için Redis'e
  bağımlı değildir (**8.3**).

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

### 9.6 Teslim boyutları

Medya **bir kez, tam çözünürlükte** saklanır; hangi boyutta indirileceğine
görüntüleyen taraf karar verir. Bu kararın tek yeri `@motionmeet/shared`
içindeki `mediaVariantUrl(url, variant)` ve `mediaSrcSet(url, variant)`
yardımcılarıdır.

| Varyant | Genişlik | Nerede |
| --- | ---: | --- |
| `avatar` | 128 px | Ad yanındaki profil fotoğrafı, yorum avatarı |
| `thumb` | 320 px | Keşfet ızgarası, egzersiz küçük görseli |
| `feed` | 720 px | Feed ve hikâye kartı, tam sütun genişliği |
| `detail` | 1440 px | Tam ekran görüntüleyici, profil kapağı |

`mediaVariantUrl`, genişliği saklanan URL'in **mevcut** `tr` parametresine ekler;
backend'in seçtiği `q-auto` ve `f-webp` korunur. Video hiç dokunulmadan döner
(yeniden boyutlandırma videoya uygulanmaz), ImageKit olmayan bir URL — göreli
yol, boş string, farklı host — aynen döner, ve backend zaten bir genişlik
seçmişse (avatar ve kapak için seçiyor) o genişlik değiştirilmez. Bu yüzden
istemci, API'den ne geldiğine bakmadan koşulsuz uygulayabilir.

Bunun neden gerektiği: saklanan post URL'i yalnızca `q-auto,f-webp` istiyordu,
genişlik sınırı yoktu — yani 4000×3000 bir fotoğraf 400 px'lik bir feed kartına
tam çözünürlükte iniyordu. API sözleşmesi değişmedi; istemciler sunucudan gelen
aynı URL'i yeniden yazıyor.

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
│  └─ story/     # Katman tipografisi ve salt-okunur katman render'ı (mobil ikizi)
├─ config/       # Vite environment URL çözümleme
├─ context/      # Auth, Socket ve Theme provider'ları
├─ features/     # User, connection ve message Redux slice'ları
├─ hooks/        # Aktif workout, lookup ve socket hook'ları
├─ locales/      # İngilizce ve Türkçe çeviriler
├─ pages/        # Route seviyesindeki ekranlar
├─ services/     # Exercise/message/user domain API adaptörleri
├─ theme/        # MUI tema tanımı
├─ utils/        # dayjs yapılandırması (plugin + locale); tarih her yerde buradan gelir
├─ App.tsx       # Lazy route haritası ve global realtime davranışı
└─ main.tsx      # Provider composition root
```

Provider sırası: MUI styled engine/global layers -> Theme -> Auth ->
BrowserRouter -> Redux -> App -> Socket. Route-level sayfalar `React.lazy` ve
`Suspense` ile bölünür.

`SocketProvider` `socket.io-client`'ı **dinamik import** ile yükler. Giriş
yapılmadan hiçbir soket açılmıyor, ama statik bir import kütüphaneyi entry
grafiğine sokuyor ve landing sayfası daha boyanmadan ~88 KB'ı preload ediyordu.
Modül artık üyenin gerçekten bir oturumu olduğu anda yükleniyor; provider modül
uçarken unmount olursa bağlantı hiç kurulmuyor.

`PostCard` `memo`'ludur. Feed kartları düz bir `map` ile render edildiği için,
memo olmadan `state.posts` içindeki tek bir beğeni bütün kartları yeniden
render ediyordu.

### 11.2 Web route haritası

- Public: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`,
  `/features`, `/about`. Eski `/pricing` bağlantısı `/`'e yönlenir.
- Auth redirect alias'ları: `/sign-in`, `/sign-up`.
- Authenticated layout: `/feed`, `/explore`, `/messages`, `/messages/:userId`,
  `/routines`, `/exercises`, `/profile`, `/profile/:profileId`, `/settings`.
  `/explore` üç sütunlu Keşfet ızgarası ve kişi aramasıdır; **14C**.
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

Dil seçimi `src/i18n.ts` içindedir ve iki aşamalıdır. Üye Ayarlar'dan bir dil
seçtiyse tercih `localStorage`'a yazılır ve her açılışta o kullanılır. Seçim
yoksa `navigator.languages` sırasıyla taranır, her giriş temel etiketine
indirgenir (`tr-TR` -> `tr`) ve desteklenen ilk dil uygulanır. **Tespit edilen
dil kaydedilmez**: yalnız Ayarlar'daki seçim bir karardır, dolayısıyla tarayıcı
tercihi sonradan değişen bir üye uygulamanın bir kereliğine yaptığı tahmine
mahkûm kalmaz. `initI18n` ilk boyamadan önce `main.tsx` tarafından beklenir,
böylece sayfa İngilizce açılıp Türkçeye atlamaz; `document.documentElement.lang`
da aynı anda güncellenir.

Bunun sonucu, giriş ekranında dil seçici bulunmamasıdır. Dil seçimi uygulama
içinde bir ayardır; formun önüne ikinci bir seçici koymak, giriş yapmayı dil
seçmekle başlayan iki adımlı bir işe çevirirdi. Kayıt/giriş ekranlarının bütün
metinleri `auth.*` anahtarları altında Türkçe ve İngilizce olarak tanımlıdır.

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
- **`socket.io` bilinçli olarak axios ile aynı manual chunk'ta değildir.** Bir
  manual chunk tek parça olarak yayınlanır; realtime istemcisini her ekranın
  import ettiği HTTP istemcisinin yanına koymak onu entry grafiğine sabitler ve
  `SocketProvider`'daki dinamik import'u anlamsız kılardı. Atanmamış bırakılınca
  Rollup dinamik import'u izleyip ona kendi chunk'ını verir;
- chart bağımlılıklarını yalnız onları kullanan lazy route'ların import zincirinde
  tutar;
- production artefaktında source map/secret ve gzip başlangıç bütçesini test eder.
  Bütçeler `packages/web/performance-budget.json` içindedir ve
  `scripts/check-web-performance.mjs` tarafından zorlanır. Bir sayıyı yükseltmek
  ölçüm ve gerekçe ister; bütçenin amacı kazanılan alanın sessizce geri
  harcanmasını engellemektir.

Dev server dosya değişikliklerini **native olay** ile izler. Polling
varsayılan olarak kapalıdır (`VITE_WATCH_POLLING=true` ile açılır): koşulsuz
polling kaynak ağacını bir zamanlayıcıyla sürekli `stat`'lar, bu da yavaş diskte
ve büyük ağaçta oturum boyunca ödenen bir maliyettir. Network share veya
container bind mount üzerinde çalışırken native olaylar gelmediği için polling
gerekir.

Production Nginx:

- non-root, 8080 portunda çalışır;
- SPA fallback uygular;
- `/api`, `/health` ve `/socket.io` isteklerini backend'e proxy eder;
- account export için proxy buffering'i kapatır;
- hash'li asset'lere `public, max-age=31536000, immutable`, HTML'e `no-store`
  uygular. Bu politika bir `location` bloğunda değil, dosyanın başındaki `map`
  içinde tanımlıdır: nginx'te bir location'a konan `add_header`, server
  seviyesinden miras alınan **bütün** `add_header` direktiflerini düşürür ve CSP
  dâhil güvenlik başlıkları o location için sessizce kaybolurdu;
- CSP, HSTS, X-Frame-Options, nosniff, referrer ve permissions policy başlıkları
  ekler;
- gzip'i `gzip_proxied any` ile açar — nginx varsayılan olarak proxy'lenmiş bir
  yanıtı sıkıştırmaz, dolayısıyla bu direktif olmadan `/api/` altındaki bütün
  JSON trafiği (feed, mesajlar, Keşfet: sıkışabilirliği en yüksek içerik) ham
  gidiyordu. `gzip_min_length 1024` altında framing kazançtan pahalıdır,
  `gzip_comp_level 5` JSON eğrisinin düzleştiği noktadır;
- Socket.IO upgrade header'larını iletir.

`vercel.json` statik SPA rewrite ve benzer güvenlik header'larını içerir; ayrı
Vercel dağıtımında API/Socket origin'i external HTTPS/WSS olmalıdır.

## 12. Mobile uygulaması (`packages/mobile`)

### 12.1 Uygulama kimliği ve teknoloji

- Expo SDK 54, React Native 0.81.5, React 19.1.
- Uygulama adı/slug: `MotionMeet` / `motionmeet`.
- Deep-link scheme: `motionmeet`.
- Android package ve iOS bundle ID: `app.motionmeet.mobile`.
- Android `versionCode: 2`, iOS `buildNumber: 2`, uygulama sürümü `1.1.0`.
  Ayarlar ekranındaki sürüm satırı bu değeri `expo-constants` üzerinden okur,
  elle yazılmaz.
- Portrait orientation, automatic light/dark UI. İkon, adaptive icon, splash ve
  web favicon'u `assets/` altında durur ama elle düzenlenmez: dördü de
  `pnpm brand` tarafından `brand/*.svg`'den üretilir (**13A**).
- iOS tablet desteği açık.
- Android keyboard layout mode `resize`; uygulama backup'ı kapalı, legacy harici
  depolama izinleri engelli ve ImagePicker mikrofon izni kapalıdır.
- Konum izinleri (SDK 54, `expo-location` ~19.0):
  - iOS: yalnız `locationWhenInUsePermission` metni tanımlıdır;
    `locationAlwaysAndWhenInUsePermission` ve background location kapalıdır.
  - Android: `ACCESS_COARSE_LOCATION` ve `ACCESS_FINE_LOCATION` eklenir.
    `ACCESS_BACKGROUND_LOCATION` hem plugin ayarında kapalıdır hem de
    `blockedPermissions` ve manifest'teki `tools:node="remove"` ile açıkça
    kaldırılır — böylece bir bağımlılık onu geri getiremez ve Play Store veri
    güvenliği formu "arka planda takip yok" beyanıyla tutarlı kalır.

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

| # | Route | Etiket | İkon |
| ---: | --- | --- | --- |
| 1 | `Home` | Ana Sayfa | `home` |
| 2 | `ExploreTab` | Keşfet | `search` |
| 3 | `Routines` | Antrenman | `fitness` |
| 4 | `Exercises` | Egzersizler | `barbell` |
| 5 | `ProfileTab` | Profil | üyenin avatarı, yoksa `person` |

Tab bar `createMaterialTopTabNavigator` üzerine elle çizilir (`tabBarPosition:
"bottom"`), çünkü pager'ın kaydırma davranışı isteniyor ama material şeridinin
görünümü istenmiyor. Bar yüzeye oturmuş bir şerit değil, üstü yuvarlatılmış ve
gölgeli bir yüzeydir; aktif sekme ikonun arkasındaki `primarySoft` hapla
gösterilir. Etiket yazılmaz — beş dilde ve her font ölçeğinde taşmayan tek
düzen budur; erişilebilirlik adı yine `tabBarLabel`'dan gelir. Yükseklik
sabittir, yalnız altındaki safe-area dolgusu cihaza göre değişir, böylece hap
göstergesi cihazdan cihaza zıplamaz.

**Mesajlar sekmeden çıkarıldı.** Artık feed başlığının sağ üstünde, etkinlik
zilinin yanında bir kâğıt uçak ikonudur ve `MainStack` içindeki `Messages`
ekranını push eder. Gerekçe: mesajlar günün her anında bakılan bir yer değil,
bildirimle tetiklenen bir yerdir; sekme yuvasını Keşfet'e bırakması hem
Instagram'ın alışkanlığına hem de ekranın gerçek kullanımına daha yakındır.
Okunmamış sayacı artık `useUnreadMessages` hook'undadır: bir kez
`getUserConversations` ile tohumlanır, sonrasında Socket.IO `message_received`
ile canlı kalır. Tab navigator yalnız global toast'u üretmeye devam eder.

**Doğrudan mesaj ikonu tek yerden gelir.** `src/config/icons.ts` içindeki
`MESSAGE_ICON` (Ionicons kâğıt uçak) ve react-native-paper bileşenleri için
`MESSAGE_ICON_PAPER` sabitleri; feed başlığı, bağlantılar listesi, mesajlar boş
durumu, profil "Mesaj" butonu ve hikâye yanıt çubuğu bunları kullanır. Daha önce
aynı iş üç farklı ikonla (sohbet balonu, kâğıt uçak, zarf) çiziliyordu ve üç ayrı
özellik gibi okunuyordu. Yorum ikonu bilinçli olarak konuşma balonu kalır —
yorum ile doğrudan mesaj farklı şeylerdir.

Root stack; ChatBox, profile edit, settings, connections, exercise detail,
active workout, workout detail/summary, statistics, advanced statistics, muscle
distribution, monthly report detayları, notifications, privacy, support,
main exercise, leaderboard, konum seçici, konum ayarları, yakındakiler
ve lisans ekranlarını açar. `Messages` de bu stack'tedir ve kendi geri
butonuyla açılır.

Konum ekranlarının giriş noktaları:

| Ekran | Nereden açılır |
| --- | --- |
| `LocationPickerScreen` | Profil düzenleme ekranındaki konum satırı; konum ayarlarındaki "Konumu değiştir". |
| `LocationSettingsScreen` | Ayarlar → Konum ve Yakındakiler; Yakındakiler ekranının dişli ikonu. |
| `NearbyScreen` | Connections ekranının başlığındaki harita ikonu. Kişi bulma ekranı burasıdır, ayarların içine gömülmez. |
| `LicensesScreen` | Ayarlar → Destek → Veri ve lisanslar. |

Ekranlar `getComponent` ile lazy yüklenir; konum özelliği kullanılmadığı sürece
`expo-location` ve şehir listesi ekranları bundle'dan çalıştırılmaz.

`navigation/types.ts` exercise/workout/stat route parametrelerini ve ortak
navigation prop sözleşmelerini merkezileştirir.

### 12.4 Responsive ve kullanıcı geri bildirimi

- `KeyboardAwareScrollView` input'u klavyenin üstünde tutar.
- Full-screen oluşturma akışları ve bottom-sheet seçim/form akışları safe-area,
  status/navigation bar ve güncel pencere yüksekliğini dikkate alır.
- `useResponsiveLayout` cihaz genişliğinden değil kullanılabilir içerik
  genişliği ile font scale'den karar verir.
- Hikâye yüzeyi pencere boyutuna değil, `useStoryFrame` ile **ölçülen** kare
  boyutuna göre çalışır; oluşturucu ile görüntüleyici aynı kutuyu ölçtüğü için
  katmanlar piksel piksel aynı yere düşer (**14B**).
- Dar telefonlarda riskli grid tek sütun, yeterli genişlikte iki sütundur.
- Global `AppToast` başarı/bilgi/hata mesajlarını gösterir; destructive kararlar
  native confirm dialog kullanır.
- Türkçe ve İngilizce i18next kaynakları vardır; giriş/kayıt ekranı dahil hiçbir
  ekranda sabit İngilizce metin bırakılmaz. Cihaz dili `expo-localization` ile
  okunur, seçim `AsyncStorage`'a yazılır.
- Yatay kaydırılabilir sekmeler (egzersiz detayındaki Özet/Geçmiş/Talimatlar)
  `SwipeablePager` üzerinden gelir. Bileşenin native ve `.web` olmak üzere iki
  uygulaması vardır; gerekçesi 22. bölüm madde 19'dadır.
- Light/dark React Native Paper temaları aynı ThemeContext üzerinden yönetilir.

### 12.5 Mobile environment ve bağlantı modları

`EXPO_PUBLIC_API_URL` REST/Socket origin'idir; `EXPO_PUBLIC_WEB_URL` terms,
privacy veya web'e açılan bağlantıların origin'idir.

Development fallback:

- Android emulator: `http://10.0.2.2:4000`
- iOS/web: `http://localhost:4000`

Production bundle'da API URL zorunludur ve API/web origin'leri HTTPS olmalıdır.

**Fiziksel cihaz `localhost` ile bilgisayarı göremez.** Bu, sessizce yanlış
davranan bir durumdur: uygulama normal açılır, yalnız her istek düşer. Bu yüzden
mobil dev komutlarının tamamı adres enjekte eden `scripts/local-network.mjs`
üzerinden geçer; düz `expo start` artık kök script'lerinden çağrılmaz.

| Komut | Taşıma | Enjekte edilen `EXPO_PUBLIC_API_URL` |
| --- | --- | --- |
| `pnpm dev:mobile` | LAN (sabitlenmiş) | `http://<lan-ip>:4000` |
| `pnpm dev:mobile:usb` | USB (sabitlenmiş) | `http://127.0.0.1:4000` + otomatik `adb reverse` |
| `pnpm dev:mobile:clean` | LAN + `expo start --clear` | `http://<lan-ip>:4000` |
| `pnpm dev:local:mobile` | `auto` | Android cihaz takılıysa USB, değilse LAN |

`dev:mobile` bilinçli olarak **LAN'a sabitlenmiştir**. Varsayılan `auto`, USB'de
bir Android cihaz görürse `127.0.0.1`'e geçer; bu Android tarafında çalışır ama
aynı anda Wi-Fi üzerinden Expo Go kullanan bir iPhone'u kopartır. LAN modunda
üçü de (iPhone, Android telefon, emülatör) tek adresten çalışır. Taşıma
`MOTIONMEET_MOBILE_TRANSPORT` ile veya script'in ikinci argümanıyla
(`lan` / `usb` / `auto`) değiştirilebilir; argüman environment değişkenini ezer,
böylece Windows'ta `cross-env` gerekmez.

Backend `0.0.0.0` üzerinde dinlediği için LAN adresi ek bir ayar istemez. React
Native `fetch` bir `Origin` başlığı göndermediğinden mobil istemci CORS
allowlist'ine de takılmaz.

Release/store build gerçek public HTTPS backend/web origin'iyle üretilmelidir.

### 12.5.1 Cihaz konumu

`src/hooks/useDeviceLocation.ts` `expo-location`'ı tek bir dar yüzeyin arkasına
alır: bir kez izin ister, bir kez okur, sonucu döner. Watcher, background task ve
geçmiş yoktur.

Hata yolları exception olarak değil, adlandırılmış sonuç olarak döner; çünkü her
biri kullanıcıya farklı bir cümle ve farklı bir kurtarma aksiyonu gerektirir:

| Sonuç | Anlamı | Ekranın yaptığı |
| --- | --- | --- |
| `granted` | Fix alındı | Akışa devam |
| `denied` | Bu sefer reddedildi, tekrar sorulabilir | "İzin ver" butonu |
| `blocked` | Kalıcı reddedildi veya politika ile kısıtlı | "Ayarları aç" |
| `services_off` | Cihaz genelinde konum kapalı | "Ayarları aç" |
| `unavailable` | İzin var ama donanım fix üretmedi | "Tekrar dene" |
| `timeout` | 15 saniyede fix gelmedi | "Tekrar dene" |

Okuma stratejisi: 2 dakikadan yeni bir `getLastKnownPositionAsync` sonucu varsa
o kullanılır, yoksa `Accuracy.Balanced` ile tek bir `getCurrentPositionAsync`
yapılır. Üründe hiçbir şey kilometre altını ayırt etmediği için daha hassas bir
mod istemek yalnız pil ve süre maliyeti olurdu.

iOS'ta Precise Location kapalıysa veya Android yalnız yaklaşık konum verdiyse
okuma reddedilmez; doğruluk 2 km'nin üzerindeyse `source: "coarse"` olarak
işaretlenip yine kullanılır.

### 12.6 Mobile medya

Expo ImagePicker asset'i Blob'a çevrilir. İstemci mümkünse gerçek magic byte'tan
MIME türünü algılar, dosya uzantısını bu türle eşler, presign alır ve S3'e doğrudan
PUT eder. Bu özellikle Android üreticilerinin yanlış/eksik MIME metadata
döndürdüğü durumlarda backend signature rejection'ını önler.

**Görüntüleme tarafında uzun listeler `expo-image` kullanır**, React Native'in
`Image`'ı değil: `PostCard` (feed), `Explore` ızgarası, `UserCard`,
`Connections`, `NearbyScreen` ve `Profile`. Bu ekranlar üyenin onlarca uzak
görselin yanından kaydığı yerlerdir ve `expo-image` view'ları geri dönüştürür,
bellek + disk cache tutar (`cachePolicy="memory-disk"`), `recyclingKey` ile
hücre yeniden kullanıldığında yanlış görseli göstermez ve boş bir kutu yerine
placeholder geçirir. Yeni bağımlılık değildir; `expo-image` zaten projedeydi.

Her görsel URL'si `mediaVariantUrl` ile ekranda kaplayacağı boyutta istenir
(**9.6**), yani feed kartı 720 px, ızgara 320 px, avatar 128 px indirir.

### 12.7 Metro ve native artifact notları

`metro.config.js`, monorepo root ile native Gradle entry path uyuşmazlığını
önlemek için `unstable_serverRoot` değerini mobile paketine sabitler. Babel,
Expo'nun beklediği CommonJS `babel.config.js` biçiminde kalır. Bunlar uygulama JS
kaynağı değil tool config dosyalarıdır.

`packages/mobile/dist-*` Git tarafından ignore edilir. Yerel APK/Expo export
artifact'leri source code değildir ve release signing secret'ları repository'ye
konmaz.

#### Yerel backend'e bakan sideload APK

Tam tarif `docs/mobile-qa-apk.md` içindedir; buradaki özet nedenleri anlatır.

`EXPO_PUBLIC_*` değerleri **`packages/mobile/.env.local`'a yazılmalıdır**.
Gradle'ı çalıştıran kabuğa `export` etmek yetmez: değerler Metro'nun transform
adımına ulaşmaz ve build, hiçbir şey verilmemiş gibi config guard'ında çöken bir
bundle üretir. `.env.local` git dışıdır ve Expo tarafından okunur.

```bash
cat > packages/mobile/.env.local <<'EOF'
EXPO_PUBLIC_API_URL=http://127.0.0.1:4000
EXPO_PUBLIC_WEB_URL=http://127.0.0.1:5173
EXPO_PUBLIC_ALLOW_INSECURE_LAN=true
EOF

cd packages/mobile/android && ./gradlew assembleRelease
adb -s <cihaz> install -r app/build/outputs/apk/release/app-release.apk
adb -s <cihaz> reverse tcp:4000 tcp:4000
```

> **Origin değişince iki önbellek birden temizlenmelidir.** `EXPO_PUBLIC_*`
> değerleri Babel tarafından bundle'a gömülür ve **ne Gradle ne Metro bunları
> task girdisi sayar**. Değeri değiştirip yeniden derlemek sessizce eski
> bundle'ı kullanır. Hem `createBundleReleaseJsAndAssets` çıktı klasörleri
> (`android/app/build/generated/assets` ve `.../res`) hem `%TEMP%\metro-cache`
> silinmeli, sonra bundle içinde
> adresin gerçekten yer aldığı `grep` ile doğrulanmalıdır.

> İşi bitince `.env.local` **silinmelidir**. Dosya dururken alınacak bir mağaza
> build'i loopback'e bakar ve aşağıdaki guard'ların hepsinden geçer.

`EXPO_PUBLIC_ALLOW_INSECURE_LAN`, `src/config/environment.ts` içindeki HTTPS
zorunluluğunu yalnız loopback ve özel LAN adresleri için gevşetir; public bir
http origin'e bakan build yine başlamayı reddeder. Bu bayrakla üretilen APK
mağazaya gönderilmemelidir.

Cihazın kendisine (`127.0.0.1`) düz HTTP ile bağlanabilmesi için ikinci bir
parça daha gerekir. Android 9 / API 28'den beri cleartext trafiği varsayılan
olarak yasaktır: debug manifest'i `usesCleartextTraffic="true"` ile bunu geri
açar, release manifest'i açmaz. Bu yüzden düzeltilmeden önce release APK cihazda
**açılıyor** ama her istek "Authentication failed / Network Error" ile
düşüyordu.

Çözüm `plugins/withLoopbackCleartext.js` config plugin'idir. Android'in
varsayılan `cleartextTrafficPermitted="false"` davranışını bütün gerçek host'lar
için korur ve yalnız üç ada izin verir:

| Host | Neden |
| --- | --- |
| `127.0.0.1` | `adb reverse` tünelinin cihaz tarafındaki ucu |
| `localhost` | aynı adresin isim hâli |
| `10.0.2.2` | Android emülatörünün host makineye verdiği alias |

Üçü de gerçek bir kullanıcının sunucusu olamaz, dolayısıyla bu ayar hiçbir üyenin
trafiğini açıktan taşıyamaz. `usesCleartextTraffic="true"` bayrağından
kasıtlı olarak daha dardır — o bayrak her host'a düz HTTP izni verirdi.

JS tarafındaki kontrol bundan bağımsız durmaya devam eder:
`src/config/environment.ts` production bundle'ı, origin'ler HTTPS değilse ve
`EXPO_PUBLIC_ALLOW_INSECURE_LAN=true` verilmemişse yine başlatmaz. Düz metin bir
build'in çalışması için iki koşulun da sağlanması gerekir.

> Config plugin'leri yalnız `expo prebuild` sırasında çalışır. `android/` klasörü
> git dışı olduğu ve içinde elle korunan `build.gradle` düzeltmesi bulunduğu için
> aynı iki değişiklik (res/xml dosyası + manifest özniteliği) mevcut klasöre elle
> de uygulanmıştır. Bir gün `expo prebuild` çalıştırılırsa plugin aynı sonucu
> kendiliğinden üretir.

> Daha önce aynı iş `-PmmLanTestBundle=true` ile, gömülü bir **development**
> bundle üreterek yapılıyordu. Bu yol artık çalışmıyor: React Native embedded
> ortamda dev bundle'ı çalıştırırken devtools websocket'i açmayı deniyor,
> "Cannot create devtools websocket connections in embedded environments"
> hatasıyla modül değerlendirmesi kesiliyor, `AppRegistry.registerComponent`
> hiç çağrılmıyor ve uygulama beyaz ekranda kalıyor. Gradle bayrağı kaldırıldı;
> yerine yukarıdaki environment opt-in'i kullanılıyor.

Son fiziksel Android kontrolü (2026-08-07, uygulama 1.1.0 / versionCode 2),
Reeder P13 Blue Max, Android 9 / API 28, arm64-v8a:

- Release APK kuruldu ve açıldı; `Running "main"` başarılı, fatal React Native
  hatası yok. Merged manifest'te yalnız `ACCESS_COARSE_LOCATION` ve
  `ACCESS_FINE_LOCATION` var, `ACCESS_BACKGROUND_LOCATION` yok.
- Loopback cleartext izni eklendikten sonra APK `adb reverse` üzerinden yerel
  backend'e bağlanıp login olabildi.
- Özellik testleri ayrıca Expo Go üzerinden yapıldı: cihaz dili Türkçe, konum
  seçicide "nil" araması "Nilüfer, Bursa, Türkiye"yi ilk sıraya getirdi, seçim
  profile yazıldı, Yakındakiler ekranı gerçek GPS fix'iyle listeyi kilometre
  bantlarıyla döndürdü ve Android 9'un izin diyaloğu doğru ele alındı.

> `adb reverse` eşlemeleri USB kablosu çıkarılıp takıldığında veya cihaz yeniden
> başlatıldığında **düşer**; APK backend'i bulamıyorsa ilk bakılacak yer burasıdır.
> `adb -s <seri> reverse --list` boş dönüyorsa üç portu yeniden kurmak gerekir.

Bu bir yerel smoke testtir; mağaza imzası ve production HTTPS dağıtımının yerine
geçmez.

## 13. Shared paket (`packages/shared`)

Bu paket backend, web ve mobile arasındaki compile-time anlaşmadır. İçerdiği ana
gruplar:

- auth input/response tipleri;
- ortak success/failure, cursor/offset page ve timestamp tipleri;
- user, plan, privacy, role, connection ve follow tipleri;
- exercise, set, workout, routine, stats ve personal record tipleri;
- post, comment, media, story, message, conversation ve notification tipleri;
- hikâye katmanı tipleri: `StoryOverlay`, `StoryOverlayKind`, `StoryOverlayFont`,
  `StoryOverlayAlignment`, `StoryOverlayBackdrop` ve sabit listeleri
  (`STORY_OVERLAY_FONTS`, `STORY_OVERLAY_ALIGNMENTS`, `STORY_OVERLAY_BACKDROPS`,
  `STORY_OVERLAY_KINDS`) ile `STORY_OVERLAY_LIMITS`. Sunucu doğrulayıcısı ve iki
  istemcinin render'ı aynı listeleri okur; yeni bir font eklemek tek yerde
  yapılır (**14B**);
- konum tipleri: `LocationSuggestion`, `ProfileLocation`, `NearbySettings`,
  `NearbyUser`, `DistanceBand`, `NearbyScope` ve bunların sabit listeleri
  (`NEARBY_SCOPES`, `NEARBY_SCOPE_METERS`, `DISTANCE_VISIBILITIES`,
  `PROFILE_LOCATION_VISIBILITIES`) ile `LOCATION_DATASET_ATTRIBUTION`;
- Socket.IO `ClientToServerEvents` / `ServerToClientEvents` event map'leri;
- `API_ROUTES` endpoint sabitleri;
- auth/content/pagination limitleri;
- privacy default'ları;
- operation ID ve public media URL yardımcıları;
- medya teslim boyutları: `MEDIA_WIDTHS`, `MediaVariant`, `mediaVariantUrl()` ve
  `mediaSrcSet()`. Bir görselin hangi çözünürlükte indirileceği kararı burada,
  tek yerde durur; web `srcSet` ile, mobil `expo-image` ile aynı fonksiyonu
  çağırır (**9.6**).

Önemli limitler:

- yorum 1000, mesaj 2000, post 5000, story 2000 karakter;
- hikâye başına en fazla 10 katman, katman metni 200 karakter, katman ölçeği
  0.4–4 (`STORY_OVERLAY_LIMITS`);
- post başına 4 medya;
- routine adı 120, exercise adı shared istemci contract'ında 80 karakter;
- varsayılan sayfa boyları feed/comment 30; exercise/message/conversation/routine/
  story 50; workout 30.

Shared paket DB tablosu veya server-only secret tipi yayınlamaz. Yeni endpoint
veya response eklerken önce shared sözleşmesi, sonra backend ve iki istemci aynı
değişiklik içinde güncellenmelidir.

## 13A. Marka, logo ve ikon sistemi

### 13A.1 Neden tek kaynak

Marka işareti daha önce birbirinden bağımsız beş yerde yaşıyordu: mobil için
1.5 MB'lık elle üretilmiş bir PNG, web için mor bir ok çizen `favicon.svg`,
uygulama içi başlık için tamamen farklı bir gradyan çizen `MotionMark.tsx`, giriş
ekranı için üçüncü bir `motionmeet_logo.svg` ve artık hiçbir yerden
kullanılmayan bir dambıl SVG'si. Aynı ürünün platforma göre farklı bir işaret
göstermesi bir varlık yönetimi hatası değil, marka hatasıdır.

Artık kaynak iki dosyadır ve gönderilen her raster onlardan türetilir:

| Dosya | İçerik | Nerede kullanılır |
| --- | --- | --- |
| `brand/motionmeet-mark.svg` | Yuvarlatılmış kare zemin + işaret | Platformun maskelemediği her yer: launcher ikonu, favicon, web logosu |
| `brand/motionmeet-glyph.svg` | Zeminsiz işaret (şeffaf) | Zemini platformun kendisinin çizdiği yerler: Android adaptive icon foreground, splash plakası |

İşaretin kendisi: ortak bir nabız çizgisinin üzerinde birbirine uzanan iki
sporcu; siluet bir **M** okur. Sol figür macenta→mor, sağ figür mavi→mor, ortadaki
nabız camgöbeği→mavi geçişlidir; zemin mor→lacivert bir köşegen gradyandır.

### 13A.2 Üretim hattı

```bash
pnpm brand        # node scripts/generate-brand-assets.mjs
```

Script `sharp` ile şunları yazar:

| Çıktı | Boyut | Nasıl üretilir |
| --- | --- | --- |
| `packages/mobile/assets/icon.png` | 1024 | Tam işaret |
| `packages/mobile/assets/adaptive-icon.png` | 1024 | Glif, şeffaf zemin üzerinde **%62** ölçekte ortalanır |
| `packages/mobile/assets/splash-icon.png` | 1024 | Glif, marka rengi plaka üzerinde %50 ölçekte |
| `packages/mobile/assets/favicon.png` | 64 | Tam işaret |
| `packages/web/public/favicon.svg` | vektör | Kaynağın kopyası |
| `packages/web/public/favicon-32/192/512.png` | 32/192/512 | Tam işaret |
| `packages/web/public/apple-touch-icon.png` | 180 | Tam işaret, marka rengine **flatten** edilir |
| `packages/web/src/assets/motionmeet_logo.svg` | vektör | Kaynağın kopyası |

Üç karar açıklama ister:

- **Adaptive icon glifi kullanır ve %62'ye ölçeklenir.** Android adaptive
  ikonları isteğe bağlı bir şekle maskeler ve yalnız ortadaki ~%66'nın görüneceği
  garanti edilir. Tam kutucuğu foreground olarak vermek köşelerini kestirirdi.
- **apple-touch-icon flatten edilir.** iOS, alfa kanalı taşıyan ana ekran
  ikonlarını beyaz üzerine bindirir; şeffaflık bırakmak açık renkli bir çerçeve
  üretirdi.
- **`MotionMark.tsx` aynı geometriyi `react-native-svg` ile yeniden çizer.**
  Uygulama başlığındaki işaret PNG olsaydı ölçek değiştiğinde bulanıklaşırdı.
  Bunun bedeli, path'lerin `motionmeet-mark.svg` ile elle eşlenmesidir; ikisi
  birlikte değişmelidir. Bileşen `variant="tile" | "glyph"` alır ve gradyan
  id'lerini `useId` ile örnek başına benzersiz üretir — Android'de SVG gradyan
  id'leri global olduğu için aynı ekranda iki işaret aksi hâlde sonuncunun
  tanımını paylaşırdı.

### 13A.3 Kurallar

- `brand/*.svg` düzenlendiğinde `pnpm brand` çalıştırılır ve üretilen dosyalar
  aynı commit'e girer.
- `packages/*/assets` altındaki ikonlar elle düzenlenmez.
- Repository'ye ikinci bir logo varlığı eklenmez. `motionmeet-icon-v2.png`,
  `motionmeet_dambell.svg` ve `vite.svg` bu nedenle silinmiştir.
- `app.json` ve `index.html` yalnız üretilen dosyaları işaret eder; `index.html`
  ayrıca `site.webmanifest` ve `apple-touch-icon` bağlantılarını taşır, tema
  rengi marka lacivertidir.

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

## 14A. Konum mimarisi

MotionMeet iki ayrı konum kavramı taşır. Aynı referans tablolarını
kullanmaları dışında hiçbir ortak noktaları yoktur ve bu ayrım bilinçlidir.

| | Profil konumu | Yakındakiler (Nearby) |
| --- | --- | --- |
| Kaynak | Kullanıcının listeden seçtiği dataset kaydı | Cihazın GPS fix'i |
| Hassasiyet | Şehir/ilçe düzeyi | Ham koordinat |
| Görünürlük | Profilde, arama sonuçlarında | **Hiç kimseye gösterilmez** |
| Depolama | `users` tablosundaki altı kolon | Ayrı `user_locations` tablosu |
| İzin | GPS izni gerekmez | Açık foreground konum izni |
| Değişim | Yalnız kullanıcı değiştirir | Ekran açıldıkça yenilenir |
| Silme | Profil konumunu kaldır | Kayıtlı konumu sil |

Bu ayrım şu somut sorunları çözer: profilinde "Bursa" yazan biri İstanbul'a
gittiğinde profili kendiliğinden değişmez; GPS izni vermeyen biri yine de şehir
bazlı önerilerden yararlanır; yakındakiler kapatıldığında profil bozulmaz;
hassas koordinat hiçbir zaman profil verisiyle aynı satırda durmaz.

### 14A.1 Profil konumu akışı

```text
Kullanıcı "nil" yazar
  -> mobil 280 ms debounce, önceki istek AbortController ile iptal
  -> GET /api/locations/search?q=nil&locale=tr&country=TR
  -> normalizeLocationQuery(): "nil" (2 karakterden kısaysa hiç istek atılmaz)
  -> Redis: loc:search:tr:TR:15:nil  (hit ise DB'ye hiç inilmez)
  -> üç paralel sorgu: cities / states / countries
     her biri: search_name = q  OR  LIKE 'q%'  OR  LIKE '%q%'
     (btree varchar_pattern_ops + GIN trigram indeksleri)
  -> JS'te tek listede birleştirilir ve sıralanır:
     tam eşleşme > prefix > içeren
       -> kullanıcının ülkesi
       -> city > state > country
       -> nüfus
       -> alfabetik
  -> aynı displayName'e düşen ikizler elenir ("Bursa" ili ve "Bursa" şehri)
  -> Redis'e 600 sn yazılır, istemciye döner

Kullanıcı bir öneriye dokunur
  -> PUT /api/user/location { cityId: 108249, source: "manual_search" }
  -> backend id'yi tekrar okur; pasif veya bilinmeyen id 404 döner
  -> ülke/bölge/şehir üçlüsü çözülür, etiket **backend'de** üretilir
  -> users.location + üç id + source + selected_at yazılır
  -> profile cache invalidate edilir, seçim Redis'teki "son kullanılanlar"a eklenir
```

İstemcinin gönderdiği metin hiçbir aşamada profile yazılmaz. `POST /api/user/update`
gövdesindeki `location` alanı okunmaz bile.

### 14A.2 Yakındakiler akışı

```text
Kullanıcı Yakındakiler ekranını açar / anahtarı açar
  -> expo-location foreground izni istenir (arka plan izni hiç istenmez)
  -> son 2 dakikadan yeni bir fix varsa o kullanılır, yoksa Balanced accuracy
     ile tek okuma yapılır, 15 sn'de gelmezse timeout durumu gösterilir
  -> PUT /api/nearby/position { latitude, longitude, accuracy, source }
  -> backend en yakın dataset şehrini çözer ve satıra yazar
     (yazma anında bir kez; liste sorgusu artık geocode yapmaz)
  -> GET /api/nearby/users
  -> SQL: enabled AND visible AND user_id <> me
          AND location_updated_at > now() - 7 gün
          AND users.privacy_show_in_search
          AND (yarıçap içinde | aynı city_id)
  -> her satır için mesafe **banda** çevrilir; bandı belirleyen
     karşı tarafın distance_visibility tercihidir
  -> istemciye ad, kullanıcı adı, kaba bölge etiketi ve bant döner
```

Depolanan fix 15 dakikadan yeniyse ekran GPS'i tekrar uyandırmaz; 7 günden
eskiyse kullanıcı başkalarının listesinden düşer.

### 14A.3 Mesafe bantları ve neden bu şekilde

`utils/distanceBands.ts` metreyi altı banda indirger ve **1 km'nin altını hiç
ayırt etmez**. Aynı odadaki iki kişi ile birkaç sokak ötedeki iki kişi aynı
cevabı üretir.

| Gerçek mesafe | Bant |
| --- | --- |
| 0 – 1 km | `nearby` |
| 1 – 2 km | `within_2km` |
| 2 – 5 km | `2_5km` |
| 5 – 10 km | `5_10km` |
| 10 – 25 km | `10_25km` |
| 25 – 50 km | `25_50km` |
| daha uzak | `same_city` / `same_region` |

Bu taban, üçgenleme saldırısını işe yaramaz kılar: saldırgan kendi konumunu
gezdirip tekrar tekrar sorgulasa bile öğrenebileceği en fazla şey hedefin
hangi kilometrelik halkada olduğudur. Karşı taraf `nearby_only` seçtiyse her
mesafe `nearby`'ye, `hidden` seçtiyse `unknown`'a düşer.

### 14A.4 Dosya haritası

| Dosya | Sorumluluk |
| --- | --- |
| `packages/shared/src/types/location.ts` | Ortak tipler, bant/kapsam sabitleri, ODbL attribution metni. |
| `backend/utils/locationText.ts` | Türkçe/aksan duyarsız `search_name` üretimi, sorgu normalizasyonu, LIKE kaçışı, etiket biçimlendirme. |
| `backend/utils/distanceBands.ts` | Metre -> bant dönüşümü ve görünürlük tercihinin uygulanması. |
| `backend/services/locationGeometry.ts` | PostGIS / bounding-box seçimi ve iki yolun SQL parçaları. |
| `backend/services/locationService.ts` | Arama, tekil kayıt okuma, ters coğrafi çözümleme, profil konumu yazma. |
| `backend/services/nearbyService.ts` | Fix yazma, tercih yönetimi, yakınlık sorgusu. |
| `backend/scripts/importLocationDataset.ts` | Sürümü sabitlenmiş, tekrar çalıştırılabilir dataset import'u. |
| `mobile/src/hooks/useDeviceLocation.ts` | expo-location sarmalayıcısı; her hata yolunu adlandırılmış bir sonuca çevirir. |
| `mobile/src/pages/LocationPickerScreen.tsx` | Konum seçici. |
| `mobile/src/pages/NearbyScreen.tsx` | Yakındakiler listesi ve izin durumları. |
| `mobile/src/pages/LocationSettingsScreen.tsx` | İki konumun görünürlük ve silme kontrolleri. |
| `mobile/src/pages/LicensesScreen.tsx` | Veri seti lisans bildirimleri. |

## 14B. Hikâye (story) mimarisi

Hikâyeler daha önce "renkli zemin üzerine yazı, ya da kırpılmamış bir görsel"
seviyesindeydi. Bu sürümde iki istemcide de baştan yazıldılar. Bölüm, veri
modelini, iki uçtaki akışı ve alınan kararların nedenlerini anlatır.

### 14B.1 Katman (overlay) veri modeli

Bir hikâyenin üstündeki her metin ya da konum etiketi bir **overlay**'dir.
Sözleşme `packages/shared/src/types/story.ts` içindedir ve `stories.overlays`
jsonb kolonunda saklanır.

| Alan | Değerler | Not |
| --- | --- | --- |
| `id` | `o0`, `o1`, … | Sunucu tarafından yeniden üretilir |
| `kind` | `text` \| `location` | |
| `text` | ≤ 200 karakter | |
| `x`, `y` | 0–1 | Katmanın **merkezinin** kareye oranı |
| `scale` | 0.4–4 | Taban punto çarpanı |
| `rotation` | −180…180 | Derece |
| `font` | `classic` \| `modern` \| `neon` \| `typewriter` \| `strong` | |
| `color` | `#RRGGBB` | |
| `align` | `left` \| `center` \| `right` | |
| `backdrop` | `none` \| `plate` \| `translucent` | `plate` dolu pil, metni koyu mürekkebe çevirir |

**Konumların piksel değil oran olarak saklanması bu mimarinin can alıcı
kararıdır.** 360 dp'lik bir telefonda yazının bırakıldığı yer, 448 dp'lik bir
tablette ve tarayıcıda da resmin aynı noktasıdır. Punto da aynı mantıkla kare
genişliğinden türetilir (`storyBaseFontSize`), sabit bir punto değildir.

Bir hikâye en fazla 10 katman taşır.

### 14B.2 Sunucu tarafı doğrulama

`packages/backend/utils/storyOverlays.ts` istemciden gelen listeyi **yeniden
türetir**, doğrulamakla yetinmez:

- `x`, `y` `[0,1]`'e, `scale` limitlere, `rotation` `[-180,180]`'e clamp edilir —
  böylece bir katman kadraj dışına park edilemez veya raporlama butonunu
  örtecek kadar büyütülemez;
- bilinmeyen enum değerleri varsayılana düşer;
- renk yalnız düz altı haneli hex olabilir; bir style özniteliğine ulaşabilecek
  hiçbir şey geçmez;
- `id` istemciden alınmaz, indeksten yeniden üretilir;
- şekli bozuk ya da limitleri aşan gövde `null` döner ve controller 400 verir —
  yazarın yazdığı metinler sessizce düşürülmez.

Multipart gövdelerde alan string olarak geldiği için parser JSON çözmeyi de
dener. `tests/storyOverlays.test.ts` bu davranışların yedisini de kapsar.

### 14B.3 Oluşturucu akışı

Mobil `StoryComposer`, web `StoryComposer` — davranış aynıdır:

1. **Açılış doğrudan galeridir.** Boş bir tuval yoktur; hikâye burada her zaman
   çekilmiş bir görselden başlar. İlk seçim iptal edilirse oluşturucu kapanır.
   Galeri her açılış için tam bir kez sunulur (`launchedRef`): taslağı izlemek,
   yayınlama taslağı temizlediği için galeriyi çıkışta yeniden açardı.
2. **Kare ekranın tamamıdır** ve görsel `cover` ile yerleşir; hiçbir cihazda yan
   boşluk kalmaz. Ölçü pencereden değil, `useStoryFrame` ile kutunun kendisinden
   okunur.
3. **Araç rayı** sağ üsttedir: `Aa` (metin), konum, fotoğrafı değiştir.
4. **Metin editörü** klavyenin açılmasına izin verilen tek yerdir. Font çipleri,
   renk paleti, hizalama ve metin arka planı buradadır; metnin dışına dokunmak
   yazılanı işler ve klavyeyi kapatır.
5. **Katmanlar elle taşınır.** Mobilde `PanResponder` tek parmakla taşır, iki
   parmakla ölçekler ve döndürür; webde pointer olayları taşır. Sürükleme
   sırasında kadrajın altında bir çöp kutusu belirir, üzerine gelindiğinde
   büyüyüp kırmızıya döner ve bırakıldığında katmanı siler.
6. **Yayınlama** medyayı presigned PUT ile S3'e yükler, ardından `createStory`
   çağrısına boş olmayan katmanları ekler.

Arka plan renkleri kaldırıldı. Beş font ise font dosyası göndermeden, sistem
ailesi + ağırlık/casing/tracking/glow ile kurulur; `storyTypography` modülünün
mobil ve web ikizleri aynı değerleri taşır.

### 14B.4 Görüntüleyici

- Medya `cover` ile tam kadraj kaplar (`contain` bırakılan siyah bantlar
  nedeniyle terk edildi).
- Katmanlar oluşturucuyla **aynı** render bileşeninden geçer; önizleme ile
  yayınlanan hikâye aynı resimdir.
- Üstte hikâye başına bir ilerleme çubuğu; sol/sağ dokunma alanları; basılı
  tutmak duraklatır.
- Kadrajın üstüne bir şey açıldığında (izleyici paneli, yanıt kutusu, basılı
  tutma) oynatma **duraklar**; kare, okunan veya yazılan şeyin altından kaymaz.
- Başkasının hikâyesinde alt çubuk: mesaj kutusu, kalp ve kâğıt uçak. Kalp
  emojiyi kutuya yazmaz, doğrudan DM olarak gönderir — tepki her hikâye
  uygulamasında tek dokunuştur. Kâğıt uçak sohbeti açar.
- Yazarın hikâyesinde alt çubuk yerine görüntülenme sayacı vardır; yukarı
  kaydırmak ya da dokunmak izleyici panelini açar. Panel karenin **%72'sini**
  kaplar; satırlara dokunmak ilgili profili açar. Başlıktaki çöp kutusu
  hikâyeyi siler.
- Görüntüleme makbuzu `(story_id, user_id)` üzerinde unique'tir, yani aynı
  hikâyeyi yeniden açmak zaten var olan bir satıra varır. Bu yüzden makbuz
  Redis'te 6 saat hatırlanır: bir rayı geri kaydırmak, hikâye okuması + üç
  sorguluk izleyici kontrolü + insert yerine hiç iş yapmaz (**8.2**). Makbuz
  yalnız satır kalıcı olduktan **sonra** yazılır, böylece başarısız bir
  yetkilendirme sonraki denemeyi bastırmaz.

### 14B.5 Hikâye rayı

`StoriesBar` artık kullanıcıya göre gruplar ve **yazarın kendi hikâyeleri kendi
balonunun içindedir**. Önceden "Hikayem" balonunun yanında yazarın kendisi ikinci
bir balon olarak da listeleniyordu. Kendi balonu: hikâye varsa gradyan halka ve
dokununca görüntüleyici, yoksa doğrudan oluşturucu; artı rozeti her hâlükârda
yeni hikâye ekler. Halka, marka gradyanını taşıyan bir SVG çemberdir.

### 14B.6 Dosya haritası

| Katman | Mobil | Web |
| --- | --- | --- |
| Sözleşme | `packages/shared/src/types/story.ts` | aynı |
| Doğrulama | `packages/backend/utils/storyOverlays.ts` | — |
| Kalıcılık | `packages/backend/services/storyService.ts` | — |
| Tipografi | `src/components/story/storyTypography.ts` | `src/components/story/storyTypography.ts` |
| Katman render | `story/StoryOverlayView.tsx`, `StoryOverlayAnchor.tsx` | `story/StoryOverlayView.tsx`, `StoryOverlayLayer.tsx` |
| Sürükleme | `story/StoryDraggableOverlay.tsx` | `StoryComposer.tsx` içinde pointer olayları |
| Oluşturucu | `components/StoryComposer.tsx` | `components/StoryComposer.tsx` |
| Görüntüleyici | `components/StoryViewer.tsx` | `components/StoryViewer.tsx` |
| Ray | `components/StoriesBar.tsx` + `story/StoryRing.tsx` | `components/StoriesBar.tsx` |
| Kare ölçümü | `hooks/useStoryFrame.ts` | `ResizeObserver` |

### 14B.7 Bilinçli sınırlar

- **Katmanlar görsele gömülmez.** Yayınlanan medya orijinal dosyadır; metin her
  açılışta yeniden çizilir. Gömmek istemcide bir görüntü yakalama kütüphanesi
  gerektirirdi; bunun bedeli, MotionMeet dışına paylaşılan bir ekran görüntüsünün
  katmanları taşımaması değil — o zaten ekran görüntüsüdür — ileride bir "story
  olarak indir" özelliği istenirse o zaman çözülmesi gerekmesidir.
- **Yakın arkadaşlar, müzik, çıkartma ve efekt yoktur.** Ürün bunlara sahip
  değil; taklit etmek yerine çalışmayan buton koyulmadı.
- Metin dışı hikâyeler için `media_type: "text"` yolu okuma tarafında korunur —
  eski hikâyeler açılmaya devam eder — ama oluşturucu artık üretmez.

## 14C. Keşfet ve kişi arama

### 14C.1 Ne olduğu

Keşfet, topluluğun görselli gönderilerini üç sütunlu bir ızgarada gösteren ve
üstünde kişi araması bulunan sekmedir. Mobilde `ExploreTab`, webde `/explore`.

Feed'in içindeki "Ana Sayfa / Keşfet" açılır menüsü **kaldırılmadı**: o menü
feed'in hangi gönderileri çektiğini seçer (`mode=following` ya da
`mode=discover`) ve dikey kart akışı olarak kalır. Keşfet sekmesi ise ayrı bir
gezinme yeridir ve ızgara olarak görünür. İkisi aynı adı taşır; bu bilinçli bir
üründür ama isim çakışması **22. bölümde** bilinen bir pürüz olarak kayıtlıdır.

### 14C.2 Izgara

- Veri `GET /api/post/feed?mode=discover` üzerinden gelir; yeni endpoint
  eklenmedi. Sıralamayı migration 007'nin `posts.discover_rank` stored generated
  kolonu taşır.
- **Yalnız görseli olan gönderiler ızgaraya girer.** Metin karolarından oluşan
  bir duvar bozuk okunur; metin gönderileri feed'de keşfedilebilir kalır.
- Karo, `media[0]` ya da eski `image_urls[0]`'dır; video ise oynat işareti,
  birden çok görsel varsa çoklu işareti taşır.
- Karoya dokunmak gönderiyi tam ekran açar ve **feed'in kendi `PostCard`'ını**
  kullanır — beğenme, yorum ve takip davranışı Keşfet'ten gelindiğinde de
  birebir aynıdır.
- Mobilde ızgara ve arama sonuçları **ayrı `key` taşıyan iki FlatList**'tir.
  Tek liste paylaşılsaydı aramaya geçerken `numColumns` değişirdi; React Native
  bunu yeniden yerleşim olarak değil, sert bir invariant ihlali olarak ele alır
  ve uygulama çöker. Bu, cihaz testinde yakalanan gerçek bir hataydı.

### 14C.3 Kişi arama

- `POST /api/user/discover` çağrılır; sunucu tarafı `lower(username::text) LIKE
  'terim%'` veya `lower(full_name) LIKE '%terim%'` eşleşmesi yapar,
  `privacy_show_in_search` kapalı hesapları eler, önce kullanıcı adı önekiyle
  eşleşenleri sonra takipçi sayısına göre sıralar ve 20 satırla sınırlar.
- Sorgu kolonlara `ILIKE` uygulamaz, **indeksin kurulu olduğu ifadeyle birebir
  aynı** yazılır (migration `009`): `username` öneki `text_pattern_ops` b-tree'ye,
  `full_name` içinde geçen ifade trigram GIN'e düşer. Önceki `ILIKE` biçimi
  hiçbir indeksi kullanamıyordu — 200.000 satırda substring araması 128 ms,
  önek araması 169 ms sürüyordu; şimdi 5,2 ms ve 0,05 ms.
- Terim SQL'e gitmeden önce `escapeLikePattern` ile kaçırılır. Aksi hâlde `%`
  arayan bir üye bütün tabloyu eşleştirebilirdi.
- İstemci en az iki harf bekler ve 280 ms debounce uygular.
- **Yarış koruması:** her aramaya artan bir sıra numarası verilir ve yalnız en
  güncel isteğin sonucu listeye yazılır; "uh" için geç dönen bir cevap "uhut"
  sonuçlarının üstüne binemez.
- Satırda avatar, ad ve `@kullanıcıadı` birlikte gösterilir — aynı ada sahip iki
  hesabı ayırt etmenin tek yolu budur. Satıra dokunmak profili açar.

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
 -> yalnız yazarın feed cache'i düşürülür (8.1)
```

Takipçilerin feed'i burada dokunulmaz; 30 saniyelik TTL yeni gönderiyi zaten
taşır. Anında görmesi gereken tek kişi paylaşandır.

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
 -> silinen hesabın kendi cache owner'ları düşürülür (feed, profil, egzersiz listesi)
 -> media worker S3 nesnelerini retry ederek siler
```

`user_locations` satırı `user_id` üzerinden `ON DELETE CASCADE` ile gider; hesap
silindiğinde hassas konum verisi ayrıca bir temizlik adımı gerektirmez.

### 15.6 Profil konumu seçme

```text
Konum seçici ekranı (mobil) veya profil düzenleme (web)
 -> en az 2 karakter, 280 ms debounce, eski istek iptal
 -> GET /api/locations/search (Redis 600 sn cache)
 -> kullanıcı bir öneriye dokunur (serbest metin yolu yok)
 -> PUT /api/user/location { cityId | stateId | countryId }
 -> backend id'yi yeniden doğrular, üçlüyü çözer, etiketi kendi üretir
 -> users satırı + profile cache invalidation + Redis "son kullanılanlar"
 -> istemci fetchUser ile Redux/Query state'ini tazeler
```

### 15.7 Yakındakiler

```text
Yakındakiler ekranı açılır
 -> foreground konum izni (arka plan izni hiç istenmez)
 -> saklı fix 15 dakikadan yeniyse GPS hiç uyandırılmaz
 -> PUT /api/nearby/position (rate limit: 15 dakikada 40)
 -> backend en yakın dataset şehrini çözer, satırı upsert eder
 -> GET /api/nearby/users (rate limit: 15 dakikada 120, Redis 45 sn cache)
 -> gizlilik filtreleri + yarıçap/aynı şehir koşulu SQL'de uygulanır
 -> her satır kilometre ölçekli banda indirgenir
 -> istemciye koordinat değil bant ve kaba bölge etiketi döner
```

### 15.8 Katmanlı hikâye paylaşma

```text
Hikâye balonuna dokunulur
 -> oluşturucu açılır ve doğrudan sistem galerisini sunar (boş tuval yok)
 -> seçilen görsel/video kadrajı cover ile doldurur; kare onLayout ile ÖLÇÜLÜR
 -> Aa: metin editörü (klavyenin açılmasına izin verilen tek yer)
    font / renk / hizalama / metin arka planı seçilir, dışına dokunmak işler
 -> katman parmakla taşınır, iki parmakla ölçeklenir ve döndürülür
    alttaki çöp kutusuna bırakmak siler
 -> paylaş: medya presigned PUT ile S3'e gider
 -> POST /api/story/create { uploadedKey, overlays: [...] }
 -> backend katmanları yeniden türetir (clamp + enum fallback + hex filtresi)
 -> stories satırı; overlays jsonb; expires_at = now + 24 saat
 -> ray tazelenir: hikâye yazarın KENDİ balonunun içine girer
 -> görüntüleyici katmanları aynı render bileşeniyle, aynı oranlarla çizer
```

Görüntüleme tarafı:

```text
Başkasının hikâyesi açılır
 -> POST /api/story/:storyId/view (oturum başına bir kez)
 -> alt çubuk: mesaj kutusu + kalp + kâğıt uçak
 -> kalp -> doğrudan DM olarak "❤️" gönderir
Yazar kendi hikâyesini açar
 -> yukarı kaydırma veya sayaç -> GET /api/story/:storyId/viewers
 -> panel karenin %72'sini kaplar, satır -> profil
 -> başlıktaki çöp kutusu -> DELETE /api/story/delete/:storyId
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
| `DATABASE_STATEMENT_TIMEOUT_MS` | İstek havuzundaki bir sorgunun üst sınırı; varsayılan 15.000. Tavansız bir sorgu çalıştığı sürece pool slotunu tutar ve tek bir kötü plan instance'ı aç bırakabilir. Migration ve dataset import'u bu havuzu kullanmaz (**6.2**). |
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
| `VITE_WATCH_POLLING` | Yalnız dev server. Native dosya olaylarının gelmediği ortamlarda (network share, container bind mount) `true` yapılır; varsayılan kapalıdır. |

Vite değişkenleri build-time'dır; secret içermemelidir.

### 16.3 Mobile

| Değişken | Amaç |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | API ve Socket origin'i; public bundle içine gömülür. |
| `EXPO_PUBLIC_WEB_URL` | Web/terms/privacy origin'i; public bundle içine gömülür. |
| `EXPO_PUBLIC_ALLOW_INSECURE_LAN` | Yalnız yerel cihaz testine yönelik sideload build'lerde `true`. HTTPS zorunluluğunu **sadece** loopback/özel LAN adresleri için gevşetir; public bir http origin'de build yine başlamayı reddeder. Mağaza build'inde asla set edilmez. |
| `EXPO_NO_DEPENDENCY_VALIDATION` | Expo CLI online version lookup'ını kapatır. |
| `REACT_NATIVE_PACKAGER_HOSTNAME` | LAN Metro host'u; local-network script'i üretir. |

`EXPO_PUBLIC_*` değerleri secret değildir ve uygulama binary'sinden okunabilir.

Bu değerler Babel tarafından bundle'a **gömülür** ve ne Gradle ne Metro onları
task girdisi sayar. Bunun iki pratik sonucu vardır:

1. Gradle'ı çalıştıran kabuğa `export` etmek yetmez; değer Metro'nun transform
   adımına ulaşmaz. Güvenilir yer `packages/mobile/.env.local`'dır (git dışı,
   Expo tarafından okunur). Dev komutlarında değerleri `scripts/local-network.mjs`
   süreç ortamına enjekte eder ve Expo mevcut `process.env`'i ezmediği için bu yol
   dosyadan öncelikli çalışır.
2. Origin değiştirilip yeniden derlenirse eski bundle sessizce yeniden
   kullanılır. Hem `createBundleReleaseJsAndAssets` çıktı klasörleri
   (`android/app/build/generated/assets` ve `.../res`) hem `%TEMP%\metro-cache`
   silinmelidir. Tarif ve doğrulama
   `grep`'i `docs/mobile-qa-apk.md` içindedir.

### 16.4 LAN helper

| Değişken | Amaç |
| --- | --- |
| `MOTIONMEET_LAN_IP` | Otomatik adapter seçimini override eder. |
| `MOTIONMEET_BACKEND_PORT` | Varsayılan 4000. |
| `MOTIONMEET_WEB_PORT` | Varsayılan 5173. |
| `MOTIONMEET_EXPO_PORT` | Varsayılan 8081. |
| `MOTIONMEET_MOBILE_TRANSPORT` | `auto` (varsayılan), `lan` veya `usb`. Script'in **ikinci argümanı** bu değişkeni ezer. |

Script argümanları: `node scripts/local-network.mjs <servis> [taşıma] [clear]`.
`servis` = `all` \| `backend` \| `web` \| `mobile` \| `ip`; üçüncü argüman
`clear` verilirse Expo `--clear` ile başlar. Argümanla taşıma sabitlemek,
Windows'ta `cross-env` bağımlılığı olmadan package.json script'i yazabilmek
içindir.

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

# Mobil: hepsi API adresini otomatik enjekte eder (bkz. 12.5)
pnpm dev:mobile          # LAN'a sabit - Expo Go, iOS + Android + emülatör
pnpm dev:mobile:usb      # USB'ye sabit - adb reverse + 127.0.0.1
pnpm dev:mobile:clean    # LAN + expo start --clear (bayat manifest/asset için)

# Fiziksel Expo cihazı için otomatik LAN adresi
pnpm local:ip
pnpm dev:local

# Ayrı terminallerde LAN servisleri
pnpm dev:local:backend
pnpm dev:local:web
pnpm dev:local:mobile    # taşıma "auto"

# Marka rasterlerini kaynak SVG'lerden yeniden üret
pnpm brand

# Dünya ülke/bölge/şehir veri setini içeri al (bir kez; sürüm değişince tekrar)
pnpm --filter @motionmeet/backend run import:locations
```

`import:locations` migration 006 uygulandıktan sonra çalıştırılmalıdır. İndirdiği
kaynak dosyaları `packages/backend/.location-dataset/<sürüm>/` altına önbelleğe
alır; bu dizin git dışıdır ve sabitlenmiş tag'den her zaman yeniden üretilebilir.
Konum arama, bu import çalışmadan önce sessizce boş sonuç döner — hata değil,
sadece veri yoktur.

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

- Backend unit testleri (55 test): auth validation, environment validation,
  pagination, security helpers, workout metrics, DB contract, hikâye katmanı
  doğrulaması (`tests/storyOverlays.test.ts` — clamp, enum fallback, hex-renk
  filtresi, id yeniden üretimi ve bozuk gövde reddi) ve cache stampede koruması
  (`tests/singleFlight.test.ts` — 1.000 eşzamanlı çağrının tek çalıştırmaya
  indiği, farklı anahtarların birbirini bloklamadığı, bir hatanın anahtarı
  zehirlemediği).
- PostgreSQL concurrency integration: retry idempotency, sayaç yarışları, quota,
  conversation uniqueness, analytics ve durable media deletion davranışı.
- Shared contract testleri (11 test), medya varyant URL'lerinin davranışı dâhil:
  mevcut `tr` dönüşümünün korunması, virgüllerin encode edilmemesi, videonun
  yeniden boyutlandırılmaması ve ImageKit olmayan URL'lerin aynen dönmesi.
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

Hikâye, Keşfet ve marka için ek smoke listesi:

- Hikâye balonuna dokunmak doğrudan galeriyi açıyor mu (araya bir tuval
  girmemeli)?
- Metin taşınıp bırakıldığı yerde kalıyor mu; alttaki çöp kutusuna bırakınca
  siliniyor mu?
- Yayınlanan hikâye, görüntüleyicide oluşturucudaki **tam** konumda mı açılıyor?
- Aynı hikâye ikinci bir cihazda (farklı ekran oranı) aynı yerleşimi veriyor mu?
- Kendi hikâyem rayda ikinci bir balon olarak da görünüyor mu (görünmemeli)?
- Görüntüleyenler paneli karenin yarısından fazlasını kaplıyor mu; satıra
  dokunmak profili açıyor mu?
- Başkasının hikâyesinde kalp, kutuya emoji yazmak yerine doğrudan DM gönderiyor
  mu?
- Keşfet'te aramaya geçip geri dönmek uygulamayı çökertiyor mu (çökertmemeli —
  `numColumns` regresyonu)?
- Aramada iki harften kısa terim istek üretiyor mu (üretmemeli)?
- Egzersiz detayındaki üç sekme parmakla kaydırılıyor mu; sekme şeridi kaydırmayı
  takip ediyor mu?
- Launcher ikonu, splash ve uygulama içi başlık işareti aynı mı?
- Tarayıcı sekmesindeki favicon ve iOS ana ekran ikonu aynı işareti gösteriyor mu?
- Tarayıcı dili Türkçe iken giriş ekranı Türkçe açılıyor mu; Ayarlar'dan İngilizce
  seçildikten sonra tarayıcı dili değişse bile İngilizce kalıyor mu?

Konum özellikleri için ek smoke listesi:

- "Nil" aramasında "Nilüfer, Bursa, Türkiye" ilk sırada geliyor mu?
- Aksansız ("nilufer") ve büyük harfli ("NİLÜFER") yazımlar aynı sonucu veriyor mu?
- Seçim yapılmadan profil konumu kaydedilebiliyor mu (kaydedilememeli)?
- `POST /api/user/update` gövdesine `location` konması profili değiştiriyor mu
  (değiştirmemeli)?
- Konum görünürlüğü `private` iken başka bir hesap etiketi görüyor mu (görmemeli)?
- Konum izni reddedildiğinde, "bir daha sorma" durumunda ve konum servisi kapalıyken
  ekran ayrı ayrı doğru mesajı ve doğru kurtarma aksiyonunu gösteriyor mu?
- Yakındakiler kapatıldığında kullanıcı diğer hesapların listesinden hemen çıkıyor mu?
- "Kayıtlı konumumu sil" sonrası `user_locations` satırı tamamen gidiyor mu?
- Herhangi bir API cevabında `latitude`/`longitude` alanı var mı (olmamalı)?

## 20. Güvenlik modeli

- Strict environment validation ve production HTTPS zorunluluğu.
- Helmet, explicit CORS allowlist ve trust-proxy ayarı.
- Nginx/Vercel CSP, HSTS, frame deny, nosniff, referrer ve permissions policy.
- Cookie refresh/logout için exact-origin + custom-header CSRF doğrulaması.
- JSON/multipart content-type allowlist'i, 500 KB JSON body ve endpoint bazlı
  Multer dosya/adet/alan limitleri.
- Global, auth, account, media, custom exercise, konum arama ve nearby
  (position/list) rate limitleri.
- Hassas konum verisi hiçbir API cevabında, log satırında veya analytics
  event'inde bulunmaz; yakınlık yalnızca kilometre ölçekli bant olarak döner.
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
- boot'taki `location_geometry_mode` satırı: production'da `postgis` beklenir,
  `bounding-box` görülüyorsa extension kurulmamış demektir;
- konum arama p95 süresi ve `loc:search:*` cache hit oranı;
- `nearby-position` / `nearby-list` limiter'larının 429 oranı — normalin üstüne
  çıkması scraping denemesinin ilk işaretidir;
- `user_locations` satır sayısı ve bunların kaçının 7 günden eski olduğu;
- abandoned upload ve expired story temizleme gecikmesi;
- disk değil managed PostgreSQL point-in-time backup ve düzenli restore testi;
- JWT, DB, Redis, AWS/ImageKit ve SMTP credential rotation.

Yüksek maliyetli sorgular production benzeri veri üzerinde
`EXPLAIN (ANALYZE, BUFFERS)` ile ölçülmelidir. Index ekleme ölçülen query planına
dayanmalı, varsayımla yapılmamalıdır.

Bu kuralın neden yazıldığına dair somut bir örnek `docs/PERFORMANCE_AUDIT.md`
§A3'tedir: kişi araması için önce trigram indeksi kurulmuş, ölçüm planlayıcının
önek sorgusunda onu seçmediğini göstermiş ve indeks `text_pattern_ops` b-tree ile
değiştirilmiştir. Ölçülmeseydi yanlış indeks kalacaktı.

Bu belge mimarinin **ne olduğunu** anlatır; `docs/PERFORMANCE_AUDIT.md` o
mimarinin ölçülmüş darboğazlarını, yapılan optimizasyonları ve önce/sonra
sayılarını kaydeder. Performansla ilgili bir soru varsa önce oraya bakılmalıdır.

## 22. Bilinen boşluklar ve teknik borçlar

Bu bölüm mevcut kaynak durumunu dürüstçe kaydeder:

1. `.github/workflows/ci.yml` PostgreSQL test servisi, migration ve test akışına
   güncellenmiştir; değişikliğin GitHub-hosted runner üzerindeki ilk gerçek koşusu
   bu yerel incelemenin kapsamı dışındadır.
2. OpenAPI temel endpoint'leri kapsar; runtime'daki bazı legacy alias ve
   idempotent like route'larıyla düzenli olarak senkron kontrol edilmelidir.
3. AWS kaynakları repository içinde IaC ile provision edilmez. Bucket/IAM/CORS/
   lifecycle/CDN ve secret manager ayarları dış deployment sorumluluğudur.
4. Web/mobile için tam otomatik browser/device E2E framework'ü yoktur; mevcut
    güvence typecheck/build, backend integration ve manuel smoke test ağırlıklıdır.
5. **Exercise medya lisansı production dağıtımı öncesi ayrıca çözülmelidir.**
    2026-08-07 itibarıyla 1.325 egzersizin 1.323'ü görselini ve GIF'ini
    MotionMeet'in kendi S3 bucket'ından servis ediyor. Bu medya Gym visual'a
    aittir; upstream repository'nin izni o repository'ye verilmiştir ve
    "cloning this repo is not a licence" der. Uygulamada şu anda hiçbir Gym
    visual bildirimi gösterilmiyor: 2026-08-07'de eklendi, aynı gün ürün
    sahibinin talimatıyla kaldırıldı ve medya lisansı ayrı bir iş olarak ele
    alınacak. Ayrıntı: `docs/LICENSES.md` §2b.
6. **Engelleme (block) özelliği yok.** Yakındakiler sorgusu `privacy_show_in_search`
    ile filtreler; ürün ileride kullanıcı engelleme eklerse aynı sorguya bir
    `NOT EXISTS (user_blocks ...)` koşulu eklenmelidir. Şu anda engellenecek bir
    ilişki bulunmadığı için filtre de yoktur.
7. **Konum verisi yaşam döngüsü için zamanlanmış temizlik yok.** 7 günden eski
    fix'ler sorgu sırasında elenir ama satır kalır. Gizlilik politikası bir
    saklama süresi taahhüt ederse `workers/cronJobs.ts` içine bir purge görevi
    eklenmelidir.
8. **Profil konumu etiketi kaydedildiği dilde donar.** Etiket yazma anında
    üretilip `users.location` içinde saklandığı için, üye sonradan uygulama
    dilini değiştirirse ülke adı eski dilde kalır ("Nilüfer, Bursa, Turkey").
    Şehir ve bölge adları dataset'te zaten tek biçimde olduğu için yalnız ülke
    segmenti etkilenir. Okuma anında yeniden üretmek her profil, feed ve arama
    satırında üç tablolu bir join gerektirirdi; bu yüzden bilinçli olarak
    yapılmadı. Üye konumunu yeniden seçerse etiket güncel dilde yenilenir.
9. **PostGIS bu geliştirme makinesinde kurulu değil.** Şema ve servis iki yolu
    da destekliyor ve yerelde bounding-box + haversine yolu çalışıyor; production
    PostgreSQL'inde PostGIS etkinleştirildiğinde migration generated `geography`
    kolonunu ve GiST indeksini kurar, servis boot'ta otomatik olarak `ST_DWithin`
    yoluna geçer. Yükseltme sonrası `location_geometry_mode` log satırı
    `postgis` göstermelidir.

10. **"Keşfet" adı iki yerde geçiyor.** Feed başlığındaki açılır menüde bir feed
    modu, alt navigasyonda ise ayrı bir sekme aynı adı taşır. İkisi de ürün
    sahibinin açık isteğiyle duruyor; menüdeki modun adı ileride ayrıştırılabilir
    (örn. "Herkes"). Ayrıntı: **14C.1**.
11. **Hikâye katmanları görsele gömülmüyor.** Yayınlanan medya orijinal dosyadır;
    metin her açılışta yeniden çizilir. "Hikâyeyi indir/dışa aktar" gibi bir
    özellik istenirse istemcide bir görüntü yakalama adımı gerekecek. Ayrıntı:
    **14B.7**.
12. **Hikâye yanıtı normal bir DM olarak gidiyor.** Hangi hikâyeye yanıt olduğu
    mesajda taşınmıyor; alıcı bağlamı göremiyor. Bunun için `messages` üzerinde
    bir `reply_to_story_id` alanı gerekir.
13. **`react-native-pager-view` web'de çalışmıyor.** Kütüphane React Native'in
    codegen iç modüllerini import ediyor ve `react-native-web` bunu çözemiyor.
    Bu yüzden kütüphane tek bir dosyaya (`SwipeablePager.tsx`) hapsedildi ve
    tarayıcı için sayfalanmış yatay `ScrollView` kullanan `SwipeablePager.web.tsx`
    yazıldı. **Kütüphane başka hiçbir yerden doğrudan import edilmemelidir** —
    grafiğe tek bir import girmesi bütün web bundle'ını düşürür.
14. **Sideload APK checked-in debug keystore ile imzalanıyor.** `android/app/
    build.gradle` içinde release buildType hâlâ `signingConfigs.debug`
    kullanıyor. Mağaza dağıtımı için ayrı bir release keystore ve secret
    yönetimi gerekir.
15. **Runtime performans ölçümü yok.** p50/p95/p99 istek gecikmesi, cache
    hit/miss oranı, event loop lag, pool doluluğu ve slow query eşiği
    ölçülmüyor. Structured logging request süresini kaydediyor ama toplanmıyor.
16. **Mobil `package.json` doğrudan import edilmeyen paketler taşıyor**
    (`fbjs`, `styleq`, `invariant`, `merge-options`, `html-parse-stringify`,
    `use-latest-callback`, `use-sync-external-store`, `socket.io-parser`,
    `color`, `@callstack/react-theme-provider`). Büyük olasılıkla pnpm'in katı
    `node_modules` yapısı altında Metro çözümlemesi için bilinçli eklenmişler;
    kaldırılmadan önce temiz bir `pnpm install` ve iki platformda bundle
    doğrulaması gerekir.

Bu maddeler çalışan production path'i tarif eden bölümlerle karıştırılmamalı;
teknik borç kapatıldığında hem kod hem bu belge birlikte güncellenmelidir.

Mevcut performans denetimi, ölçülen darboğazlar ve yapılan optimizasyonlar
`docs/PERFORMANCE_AUDIT.md` içindedir.

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
   fallback'ini koru. Yeni bir cache owner-addressed olmalı (**8.1**) ve
   invalidation'ı `services/feedCache.ts` üzerinden geçmeli — servisler kendi
   başlarına `del`/`scan` çağırmaz. Prefix taraması eklemek yasaktır: Redis
   `MATCH`'i taramadan sonra uygular, yani her çağrı keyspace'in tamamını gezer.
   Cache'lenen okuma pahalıysa miss'i `singleFlight` ile sar (**8.3**).
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
| DB'de hangi tablo/constraint/index var? | `db/migrations/001_*` … `009_*` ve `db/types.ts` |
| Profil konumu ile yakındakiler arasındaki fark? | Bu belgenin 14A bölümü |
| Konum araması neden bu sırayla dönüyor? | `services/locationService.ts` içindeki `searchLocations` |
| Mesafe neden tam sayı değil de aralık? | `utils/distanceBands.ts` ve 14A.3 |
| PostGIS var mı, yoksa ne oluyor? | `services/locationGeometry.ts`, boot'taki `location_geometry_mode` logu |
| Şehir verisi nereden geldi, nasıl yenilenir? | `scripts/importLocationDataset.ts`, `docs/LICENSES.md` |
| Veri seti lisans yükümlülükleri neler? | `docs/LICENSES.md` |
| Ortak API route ve tipler? | `packages/shared/src/index.ts`, `src/types/*` |
| Web route'ları? | `packages/web/src/App.tsx` |
| Mobile route/tab/stack? | `packages/mobile/src/navigation/*` |
| Logo/ikon nereden geliyor, nasıl yenilenir? | `brand/README.md`, `scripts/generate-brand-assets.mjs`, bu belgenin 13A bölümü |
| Hikâye katmanı sözleşmesi ve doğrulaması? | `packages/shared/src/types/story.ts`, `backend/utils/storyOverlays.ts`, 14B |
| Hikâye neden her cihazda aynı yere düşüyor? | 14B.1 ve `mobile/src/hooks/useStoryFrame.ts` |
| Keşfet ızgarası hangi endpoint'i kullanıyor? | `GET /api/post/feed?mode=discover`; 14C |
| Kişi araması nasıl sıralanıyor? | `backend/services/userService.ts` içindeki `searchUsers`; 14C.3 |
| Mesaj ikonu neden her yerde aynı? | `mobile/src/config/icons.ts`; 12.3 |
| Giriş ekranının dili nasıl seçiliyor? | `packages/web/src/i18n.ts`; 11.3 |
| Yerel backend'e bakan APK nasıl üretilir? | `docs/mobile-qa-apk.md`; 12.7 |
| Web'de pager neden ayrı bir dosya? | `mobile/src/components/SwipeablePager.web.tsx`; 22. bölüm madde 19 |
| Auth token davranışı? | Backend `utils/authTokens.ts`; web/mobile `AuthProvider.tsx` |
| Redis fallback'i? | `packages/backend/configs/redis.ts` |
| Bir write hangi cache'i düşürüyor? | `services/feedCache.ts`; 8.1 |
| Cache miss'te neden tek sorgu gidiyor? | `utils/singleFlight.ts`; 8.3 |
| Görsel neden bu boyutta iniyor? | `shared/src/types/media.ts` içindeki `mediaVariantUrl`; 9.6 |
| Bir endpoint neden yavaş / neresi darboğaz? | `docs/PERFORMANCE_AUDIT.md` |
| Web bundle bütçesi nerede tanımlı? | `packages/web/performance-budget.json`, `scripts/check-web-performance.mjs`; 11.4 |
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
