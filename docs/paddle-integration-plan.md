# MotionMeet × Paddle Billing (Sandbox) — Entegrasyon Planı

> Durum: **Sadece plan.** Hiçbir kod yazılmadı, hiçbir dosya değiştirilmedi, hiçbir paket kurulmadı, Paddle sandbox/live API'sine hiçbir çağrı yapılmadı. Aşağıdaki her iddia ya doğrudan okunan kaynak kod satırlarına (`dosya:satır`) ya da 2026-09-09 tarihinde okunan resmi Paddle geliştirici dokümantasyonuna dayanıyor (URL ile işaretli). Gerçek fiyat/para birimi/ürün adı icat edilmedi — kod tabanındaki mevcut rakamlar "geliştirme varsayılanı" olarak etiketlendi ve proje sahibine soru olarak yansıtıldı.
>
> Bu belge onaylanmadan Paddle entegrasyon kodu yazılmayacak.

---

## 1. Mevcut mimari analizi

### 1.1 Plan/kullanıcı şeması (Postgres, Kysely)

`plans` ve `plan_billing_cycles` tabloları `packages/backend/db/migrations/001_initial_postgresql.ts:23-44` içinde tanımlı:

- `plans` (23-38): `id uuid PK`, `name/slug citext UNIQUE`, `display_order`, `trial_days`, `price numeric(12,2)`, `currency varchar(8) DEFAULT 'TRY'`, ve `PlanFeatures`'ın birebir karşılığı olan `max_workouts_per_month`, `max_routines`, `max_posts_per_day`, `max_stories_per_day`, `max_media_upload_mb`, `can_message_anyone`, `premium_content_access`, `ad_free`, `priority_support`, `can_access_analytics`, `can_create_custom_exercises`, `is_active`.
- `plan_billing_cycles` (39-44): composite PK `(plan_id, interval)`, `interval billing_interval` (`monthly`/`yearly` enum, satır 11), `price numeric(12,2)`, `currency`, ve **kullanılmayan** `stripe_price_id varchar(255) DEFAULT ''`.
- `users` (46-68): plan alanları `plan_id uuid REFERENCES plans(id) ON DELETE SET NULL`, `plan_status plan_status` (enum: `free|active|trialing|cancelled|expired`, satır 10), `plan_start_date/plan_end_date/plan_cancelled_at timestamptz`, ve — yine kullanılmayan — `stripe_customer_id`, `stripe_subscription_id`.
- `users_plan_status_idx (plan_status, plan_end_date)` (satır 67) zaten var.

Şema `packages/backend/db/types.ts:18-46` (`PlanTable`, `PlanBillingCycleTable`) ve `:48-87` (`UserTable`, plan/stripe alanları 67-73) ile birebir eşleşiyor.

`stripe_*` alanlarının repo genelinde tek kullanım yeri serileştirme; SDK çağrısı, checkout, webhook yok. "paddle" kelimesi repo'nun hiçbir yerinde geçmiyor. `PROJECT_STRUCTURE.md:373-375` doğrulandı: *"Repository'de Stripe customer/subscription ve price ID alanları hazırdır; ancak Stripe SDK, checkout veya webhook implementasyonu yoktur."*

### 1.2 Shared tipler

`packages/shared/src/types/user.ts`:
- `PlanStatus` (satır 5): `"free"|"active"|"trialing"|"cancelled"|"expired"` — Paddle'daki `past_due`/`paused` karşılıksız (bkz. §8).
- `PlanFeatures` (21-33), `BillingCycle` (35-40, `stripePriceId` dahil), `Plan` (42-55), `User` (131-140).

`packages/backend/repositories/entities.ts`:
- `InternalPlan` (4-6): `stripePriceIds: Partial<Record<"monthly"|"yearly", string>>`.
- `InternalUser` (8-14): `stripeCustomerId?`, `stripeSubscriptionId?`.
- `serializeUser` (101-140): bu alanlar sadece `includeSensitive=true` iken response'a giriyor (130-138) — normal `GET /me`'de sızmıyor.

### 1.3 Backend servis/controller katmanı

- `planService.ts:5-9` `getActivePlansList()`, `:11` `getPlanById`, `:19-29` `updateUserPlan(userId, planId, options)` — `plans.slug==='free'||price===0` ise `plan_status='free'`, değilse `'active'`; **gerçek ödeme kontrolü burada yok**.
- `planController.ts:14-40` `updateMyPlan` — **kritik bulgu**, 27-32:
  ```ts
  if (plan.name !== "Free" || plan.price > 0) {
    return res.status(409).json({ success: false, message: "Paid plan activation requires a verified checkout" });
  }
  ```
  Ücretli plana self-service geçiş **şu an zaten engelli**. Bu guard **korunmalı**, Paddle bunun doldurması gereken boşluğu gösteriyor.
- `planRoutes.ts:1-11`: `GET /` public, `POST /update` `protect + attachDbUser`.
- `utils/plans.ts:27-60`: boot-time seed — Free (0 TRY), Pro (149 TRY/ay, 999 TRY/yıl, trial 7 gün), Premium (299 TRY/ay, 1999 TRY/yıl, trial 14 gün, `isActive:false`). `:62-99` `getOrCreatePlan` idempotent upsert (`ON CONFLICT`). `bootstrapService.ts:36-54` her boot'ta çağırıyor.
  > Bu rakamlar **geliştirme varsayılanı**, ticari karar değil — §14'te açık soru.

### 1.4 Backend konvansiyonları

`routineController.ts` şablonu: girdi doğrulama → `Idempotency-Key` header zorunluluğu (36-46) → plan kotası okuma (49-54) → servise devir, hata `next(error)`'a.

`middlewares/auth.ts`: `protect` (JWT), `attachDbUser` (28-44, plan populate edilmiş yükler, plansız kullanıcıyı otomatik Free'ye bağlar), `authorizeRole`.

`services/outboxService.ts` — webhook idempotency tasarımı için **model**: `claimNextEvent` `FOR UPDATE SKIP LOCKED`, exponential backoff (`2^attempts * 30s`, max 24 saat).

`configs/environment.ts` — env doğrulama konvansiyonu: `requireCapabilityVariables(capability, names)` + `*_ENABLED` bayrağı; production'da ekstra sertlik (JWT_SECRET min 32 byte, REDIS `rediss://` zorunlu, kaçış kapısı `ALLOW_INSECURE_REDIS_TLS`). Modül yüklenirken çalışır — yanlış config'te process hiç başlamaz.

`server.ts` — başlangıç sırası: DB → migrate → contract → plan seed (69-85). **Kritik**: middleware sırası (88-104): helmet → requestContext → cors → `rejectUnsupportedApiContentType` (101) → **global** `express.json()` (102) → rate limiter (104) → route mount (113-116). Webhook route'u imza doğrulaması ham body istediği için bu `express.json()`'dan **önce**, kendi raw parser'ıyla mount edilmeli (§7).

`errorHandler.ts:19` — Postgres `23505` (unique violation) otomatik `409`'a çevriliyor; webhook event tablosundaki `event_id` unique constraint'i bunu doğal kullanır.

### 1.5 Migration tooling

Kysely tabanlı, `packages/backend/db/migrations/*.ts` + registry `db/migrator.ts`. Çalıştırma: `scripts/migrate.ts`, npm script `migrate:postgres`, ayrıca boot'ta otomatik (`RUN_MIGRATIONS=false` ile kapatılabilir). `010_story_likes.ts` şablon: `sql.raw()`, `IF NOT EXISTS`, enum'a `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

`tools/database-migration/` — Mongo→Postgres tek seferlik, kapanmış bir araç; ilgisiz.

### 1.6 Web (`packages/web`)

React 19 + Vite + MUI + React Router 8 + Redux Toolkit. `/pricing` zaten public route (`App.tsx:27,159`).

**Önemli bulgu:** `packages/web/src/pages/Pricing.tsx` **zaten var**, checkout'u bekleyen placeholder:
- Satır 104: `if (plan.price > 0 || plan.name !== "Free") return;` — ücretli plana tıklama no-op.
- Satır 174: `isPaid = plan.price > 0 || plan.name !== "Free"`.
- Satır 206-220: buton `isPaid` ise disabled, `t("pricing_page.checkout_soon", "Checkout coming soon")`.

Bu, Paddle checkout'unun takılacağı yer. Auth: `AuthProvider.tsx` `getToken()` (in-memory, paylaşımlı refresh). `api/axios.ts`: `withCredentials:true`, `X-CSRF-Protection:1`. Env: `VITE_*` prefix, production'da HTTPS zorunlu (module-load throw, `config/env.ts:44-50`).

### 1.7 Mobile (`packages/mobile`)

`PricingScreen.tsx` — web ile birebir aynı placeholder deseni (satır 137 `isPaid`, 198-200 `checkout_soon`). `handleUpgrade` (54-73) sadece `updatePlan()` API çağrısı.

Env: `EXPO_PUBLIC_*`. Emsal: `config/ads.ts:26` `ADS_PRODUCTION_ENABLED` **env değil, hardcoded `false`** — gerçek ad unit olmadan bu bayrağın env'den gelmesi riskli, bilinçli kod değişikliğiyle açılmalı. Aynı felsefe mobile Paddle checkout'u için önerilir (ileride). `useAdEntitlement.ts` — plan bazlı yetki kontrolü için hazır konvansiyon.

EAS yok, native Android build Gradle ile, `ios/` yok.

---

## 2. Önerilen ödeme mimarisi

**Temel ilke: mevcut `plans`/`plan_billing_cycles`/`users` şemasını olduğu gibi bırakıp üstüne Paddle'a özgü, ortam-farkında bir katman eklemek — `stripe_*` kolonlarına dokunmadan.**

| Paddle kavramı | MotionMeet karşılığı |
|---|---|
| Customer (`ctm_...`) | Yeni `users.paddle_customer_id` |
| Subscription (`sub_...`) | Yeni `users.paddle_subscription_id` + mevcut `plan_status`/tarih alanları |
| Product + Price (`pro_...`/`pri_...`) | Yeni `plan_provider_prices` tablosu (ortam-farkında eşleme) |
| Checkout (overlay) | Web `Pricing.tsx`'teki mevcut buton |
| Transaction | Sadece kayıt/audit (v1'de entitlement kaynağı değil) |
| Webhook Notification | Yeni `payment_webhook_events` (idempotent event log) |
| Customer Portal | `POST /api/payments/portal-session` → Paddle'ın barındırdığı sayfa |

Neden üstüne ekliyoruz, yeniden yazmıyoruz: `plan_status` enum'ı, `attachDbUser`, `plan.features.*` kontrolleri, quota sistemi — hiçbiri Paddle'a bağımlı değil ve doğru çalışıyor. Paddle sadece "`plan_id`/`plan_status` nasıl değişiyor" sorusuna gerçek bir cevap ekliyor.

Provider/environment ayrımı neden ayrı tablo: bir backend süreci aynı anda tek bir Paddle ortamıyla konuşur, ama Price ID'leri ortama özgü — bu yüzden `plan_provider_prices (plan_id, interval, provider, environment) → external_price_id` satır bazlı çözülüyor.

---

## 3. Sandbox / Live ayrımı

- API taban URL: Sandbox `https://sandbox-api.paddle.com`, Live `https://api.paddle.com` ([Sandbox docs](https://developer.paddle.com/sdks/sandbox/)).
- Sunucu API key öneki farklı: live `pdl_live_apikey_...`, sandbox `pdl_sdbx_apikey_...` ([Authentication](https://developer.paddle.com/api-reference/about/authentication/)).
- İstemci token'ları: sandbox `test_...`, live öneksiz ([Quickstart](https://developer.paddle.com/get-started/quickstart/)).
- Sandbox'ta sadece test kartları, "Test Mode" filigranı, otomatik 10 dk'da iade onayı, webhook retry 15 dk'da 3 deneme (live 3 günde 60), Retain sandbox'ta çalışmaz.

**Backend** (`configs/environment.ts` desenine paralel):
```
PADDLE_ENABLED=false
PADDLE_ENVIRONMENT=sandbox              # "sandbox" | "live"
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
ALLOW_PADDLE_SANDBOX_IN_PRODUCTION=false
```
Eklenecek doğrulamalar: capability guard, `PADDLE_ENVIRONMENT` enum kontrolü, **API key öneki ile `PADDLE_ENVIRONMENT` tutarlılığı** (yanlış anahtar → boot hatası), production'da sandbox açıkça izin verilmedikçe reddedilir.

Taban URL env var olarak tutulmaz — `PADDLE_ENVIRONMENT`'tan türetilir (resmi Node SDK zaten `environment` parametresi alıyor).

**Web** (`VITE_*`): `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_ENVIRONMENT` — live iken token `test_` önekliyse throw.

**Mobile**: şimdilik uygulanmıyor; ileride `config/ads.ts`'teki hardcoded-flag felsefesi önerilir.

---

## 4. Oluşturulacak / değiştirilecek dosyalar

**Backend — yeni:** `configs/paddle.ts`, `db/migrations/011_paddle_billing.ts`, `repositories/paymentRepository.ts`, `repositories/webhookEventRepository.ts`, `services/paddleService.ts`, `services/subscriptionService.ts`, `services/webhookEventService.ts`, `controllers/paymentController.ts`, `routes/paymentRoutes.ts`, `routes/paddleWebhookRoutes.ts` (ayrı dosya — farklı middleware zinciri gerektiği için).

**Backend — değişecek:** `configs/environment.ts` (§3), `server.ts` (webhook route'u `cors` ile `rejectUnsupportedApiContentType` arasına raw-body ile mount), `db/migrator.ts`, `db/types.ts`, `repositories/entities.ts`, `services/planService.ts`, `utils/plans.ts` (seed'e provider-price eklenmesi), `package.json` (`@paddle/paddle-node-sdk`), `.env.example`/`.env.production.example`.

`controllers/planController.ts` **değişmiyor** — 409 guard korunuyor.

**Web — yeni:** `config/paddle.ts`, `services/paymentService.ts`.
**Web — değişecek:** `pages/Pricing.tsx` (checkout entegrasyonu), `pages/Settings.tsx` (faturalama bölümü), `.env.example`/`.env.development`/`.env.production`, `packages/shared/src/index.ts` (`API_ROUTES.payments`), `packages/shared/src/types/user.ts` (`PlanStatus` genişletme).

**Mobile — sadece not, bu geçişte uygulanmıyor:** `PricingScreen.tsx` aynı placeholder; v1 önerisi checkout'u web'e yönlendirmek.

---

## 5. Veritabanı değişiklikleri

`packages/backend/db/migrations/011_paddle_billing.ts` (taslak, mevcut `sql.raw`/`IF NOT EXISTS`/`up`-`down` desenine sadık):

```sql
ALTER TYPE plan_status ADD VALUE IF NOT EXISTS 'past_due';
ALTER TYPE plan_status ADD VALUE IF NOT EXISTS 'paused';

CREATE TYPE billing_provider AS ENUM ('none', 'paddle');
CREATE TYPE billing_environment AS ENUM ('sandbox', 'live');

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS paddle_customer_id varchar(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS paddle_subscription_id varchar(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_provider billing_provider NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS paddle_environment billing_environment,
  ADD COLUMN IF NOT EXISTS plan_cancel_at_period_end boolean NOT NULL DEFAULT false;
  -- + last_paddle_event_occurred_at timestamptz (sıra-dışı event korumasi icin, SS 7.3)

CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_customer_idx
  ON users (paddle_customer_id) WHERE paddle_customer_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_subscription_idx
  ON users (paddle_subscription_id) WHERE paddle_subscription_id <> '';

CREATE TABLE IF NOT EXISTS plan_provider_prices (
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  interval billing_interval NOT NULL,
  provider billing_provider NOT NULL DEFAULT 'paddle',
  environment billing_environment NOT NULL,
  external_product_id varchar(255) NOT NULL,
  external_price_id varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, interval, provider, environment)
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id varchar(64) PRIMARY KEY,
  notification_id varchar(64) NOT NULL,
  event_type varchar(100) NOT NULL,
  environment billing_environment NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','failed','ignored')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_webhook_events_status_idx ON payment_webhook_events (status, received_at);
```

Notlar: `event_id PRIMARY KEY` → aynı event iki kez INSERT edilirse Postgres `23505` fırlatır, `errorHandler.ts:19` bunu otomatik `409`'a çevirir, yani handler `ON CONFLICT DO NOTHING` + "0 satır etkilendi mi" ile yazılabilir. `plan_provider_prices` şimdilik **boş** kalacak — proje sahibi Sandbox panelinde kataloğu tamamlayana kadar hiçbir satır eklenmeyecek; kod bu tablo boşken de derlenip birim testleriyle doğrulanabilir.

---

## 6. API endpoint'leri

| Metot & yol | Auth | Amaç |
|---|---|---|
| `GET /api/payments/checkout-intent?planId=&interval=` | `protect+attachDbUser` | Aktif ortamdaki Paddle price ID + sunucu üretimli `customData` döner. |
| `POST /api/payments/webhooks/paddle` | Yok (imza ile korunur) | Paddle bildirim uç noktası; `express.raw()` ile, global `express.json()`'dan önce mount. |
| `GET /api/payments/subscription` | `protect+attachDbUser` | Plan, durum, yenileme tarihi, `plan_cancel_at_period_end`. |
| `POST /api/payments/portal-session` | `protect+attachDbUser` | Paddle `POST /customers/{id}/portal-sessions` sarmalayıcısı. |
| `GET /api/admin/payments/events` *(opsiyonel)* | `protect+attachDbUser+authorizeRole("superadmin")` | Webhook event geçmişi (destek/debug). |

`POST /api/plans/update` ve `PUT /api/admin/users/:id/plan` **değişmiyor**.

---

## 7. Webhook akışı

**Mount noktası:** `server.ts:102`'deki global `express.json()`'dan **önce**, kendi raw parser'ıyla:
```ts
app.use(
  "/api/payments/webhooks/paddle",
  express.raw({ type: "application/json", limit: "1mb" }),
  paddleWebhookRouter,
);
```

**İmza doğrulama:** Header `Paddle-Signature` (`ts=...;h1=...`), `HMAC-SHA256("<ts>:<raw_body>", secret)`, sabit-zamanlı karşılaştırma, ~5 sn tolerans ([signature verification](https://developer.paddle.com/webhooks/about/signature-verification/)). Resmi Node SDK bunu hazır sunuyor: `paddle.webhooks.unmarshal(rawBody, secret, header)` ([npm](https://www.npmjs.com/package/@paddle/paddle-node-sdk), [GitHub](https://github.com/PaddleHQ/paddle-node-sdk)) — elle HMAC yazılmıyor. Başarısızsa `401`, DB'ye dokunulmaz.

**İdempotency/replay:** Paddle en-az-bir-kez teslim garantisi verir (aynı `event_id` tekrar gelebilir — beklenen). `INSERT ... ON CONFLICT (event_id) DO NOTHING RETURNING *`; satır dönmezse hemen `200`. Sıra garantisi yok — uygulama, ilgili kullanıcının son işlenen `occurred_at`'inden eski event'leri atlar.

**Abone olunacak event'ler:** `subscription.created/activated/trialing/updated/past_due/paused/resumed/canceled`, `transaction.completed` (kayıt amaçlı), opsiyonel `transaction.payment_failed`, `customer.updated`, `adjustment.created`.

`custom_data` mekanizması ([docs](https://developer.paddle.com/api-reference/about/custom-data)): checkout-intent'in ürettiği `{motionmeetUserId, planId, interval}` Paddle.js'e verilir, webhook'ta geri okunur — bu değer **her zaman** `req.userId`'den üretilir, istemciden gelen kullanıcı-id'ye asla güvenilmez.

---

## 8. Abonelik ve premium yetki modeli

| Paddle durumu | Event | `plan_status` | Premium erişim? |
|---|---|---|---|
| trialing | `subscription.trialing` | `trialing` | Evet |
| active | `subscription.activated/updated` | `active` | Evet |
| past_due | `subscription.past_due` | `past_due` *(yeni)* | **Ürün kararı** — öneri: koru (§14) |
| paused | `subscription.paused` | `paused` *(yeni)* | Hayır |
| dönem sonu iptali planlı | `updated` içindeki `scheduled_change` | değişmez, `plan_cancel_at_period_end=true` | Evet, dönem sonuna kadar |
| canceled | `subscription.canceled` | `cancelled` | Hayır |
| yeniden abonelik | yeni `subscription.created` | `active`/`trialing` | Evet |

Uygulama noktası (`attachDbUser`, `plan.features.*`) **değişmiyor** — değişen tek şey `plan_id`/`plan_status`'ü artık webhook transaction'ı içinde `subscriptionService`'in yazması.

Refund/adjustment'ın entitlement'a etkisi ve past_due politikası bu planda **çözülmedi** — ürün kararı, §14.

---

## 9. Frontend checkout akışı

**Web (öncelikli):** Paddle.js CDN script → `Paddle.Initialize({token, eventCallback})`, sandbox'ta önce `Paddle.Environment.set('sandbox')`. `Pricing.tsx`'teki `handleSelectPlan` genişletilir: ücretli planda artık `return` etmek yerine `checkout-intent` çağrılıp `Paddle.Checkout.open({items, customer, customData})`. `checkout.completed` sadece UX için — gerçek `plan_status` değişimi her zaman webhook'tan gelir. Webhook asenkron olduğu için tamamlanma sonrası `fetchUser` polling veya (opsiyonel) Socket.IO `plan_updated` event'i önerilir. `Settings.tsx`'e "Faturamı yönet" → portal-session → yönlendirme.

**Mobile (v1'de uygulanmıyor):** Paddle.js tarayıcı kütüphanesi, native SDK yok. Öneri: ücretli plan seçiminde kullanıcıyı web `/pricing`'e yönlendirmek; checkout mobil içinde tamamlanmıyor. WebView alternatifi App Store/Play Store IAP politikası riski taşıyor (§14).

---

## 10. Güvenlik önlemleri

1. `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` asla `VITE_*`/`EXPO_PUBLIC_*` önekiyle — sadece sunucu env'i.
2. Webhook: imza doğrulama her zaman DB yazımından önce; başarısız → `401`, hiçbir yan etki yok.
3. Webhook route'una `protect`/CSRF middleware'i uygulanmaz (sunucu-sunucu çağrı).
4. `custom_data.motionmeetUserId` sadece `req.userId`'den üretilir. Webhook'ta gelen `customer_id`, kullanıcının kayıtlı `paddle_customer_id`'siyle **farklıysa** reddedilir/loglanır, üzerine yazılmaz.
5. `event_id` unique constraint + `ON CONFLICT DO NOTHING` — DB seviyesinde replay koruması.
6. API key en az yetkiyle, periyodik rotasyon.
7. Ek savunma: Paddle IP allowlisting (birincil kontrol yine imza doğrulaması).
8. Ham webhook payload'ı loglara tam basılmaz (PII).
9. `planController.updateMyPlan`'daki 409 guard **korunur**.

---

## 11. Test senaryoları

1. Config guard'ları (eksik env, ortam/anahtar tutarsızlığı → boot hatası).
2. checkout-intent: geçerli/geçersiz plan, auth yok.
3. İmza doğrulama: geçerli/kurcalanmış/eksik header/tolerans dışı.
4. İdempotency: aynı `event_id` iki kez → yan etki tekrarlanmaz.
5. Yaşam döngüsü: created→activated, trialing, past_due, paused, resumed, canceled.
6. Sıra dışı teslim: eski event, durumu geri almaz.
7. Yabancı `customer_id`: reddedilir, üzerine yazılmaz.
8. Regresyon: `updateMyPlan` 409'u bozulmuyor.
9. Frontend: login yönlendirmesi, doğru `priceId`/`customData` ile overlay, tamamlanma sonrası durum geçişi.
10. Manuel/uçtan-uca (proje sahibi katılımıyla): sandbox test kartları (`4242 4242 4242 4242`, 3DS `4000 0038 0000 0446`, red `4000 0000 0000 0002`); yerel webhook testi için tünel (ngrok vb.) gerekiyor.
11. Birleştirmeden önce `security-review` becerisiyle özel geçiş, özellikle webhook güven sınırı.

---

## 12. Dashboard işlemleri

**Sadece proje sahibi (hesap kimlik bilgisi gerektirir):** Sandbox panelinde ürün/fiyat kataloğunu tamamlamak (gerçek rakamlar onaylandıktan sonra), localhost-olmayan default payment link ayarlamak, Notification Destination + event abonelikleri oluşturup webhook secret'ı almak, sunucu/istemci Sandbox anahtarlarını kendisi `.env`'e yazmak, MotionMeet'in sosyal özellik setini Paddle AUP'sine karşı değerlendirmek.

**Plan onaylandıktan sonra ben yapacağım:** §4-8'deki kod/migration/route değişiklikleri. Price ID'ler asla kaynak kodda sabit yazılmaz, her zaman `plan_provider_prices`'tan okunur — kod, katalog tamamlanmadan da yazılıp test edilebilir.

---

## 13. Live'a geçiş planı (ileride)

1. Hesap yapılandırması (domain, ödeme yöntemleri, vergi, payout — owner).
2. Katalog: Live'da Product/Price'lar yeniden oluşturulur (sandbox→live otomatik kopya aracı **teyit edilmedi**).
3. Kimlik değişimi: Live API key/token + `PADDLE_ENVIRONMENT=live` — **kod değişikliği gerekmez**.
4. `plan_provider_prices`'a `environment='live'` satırları eklenir (INSERT, kod değişikliği yok).
5. Live Notification Destination + yeni webhook secret.
6. Gerçek düşük tutarlı satın alma ile doğrulama.
7. Paddle değişiklik günlüğüne abone olmak, key rotasyonu.
8. §11'deki testlerin Live'a karşı tekrarı.

---

## 14. Riskler ve dikkat edilmesi gereken noktalar

1. **AUP riski (açık soru):** MotionMeet sosyal özellikler taşıyan bir uygulama; ücretli katman (mesajlaşma, ad_free, analitik) yazılım-özelliği kilitleme gibi okunabilir ama netleştirilmesi gerekiyor — Paddle destek/satış ekibiyle konuşulmalı.
2. **Mobil mağaza IAP riski:** ileride mobile Paddle-tabanlı kilit açmayla mağazaya çıkarsa reddedilme riski; şu an `ios/` yok, mobile checkout web'e yönlendirmeyle sınırlı tutulmalı.
3. Sandbox→Live katalog sürekliliği teyit edilmedi.
4. Gerçek fiyat/para birimi/plan adları bu planda belirlenmedi (149/999/299/1999 TRY sadece dev-seed).
5. Yerel webhook testi HTTPS tüneli gerektiriyor (Paddle localhost'a ulaşamaz).
6. Refund/adjustment → entitlement politikası belirsiz.
7. `past_due` sırasında erişim politikası belirsiz.
8. Para birimi: `plans.currency` şu an TRY-sabit; Paddle'ın çoklu para birimi/yerelleştirme yeteneği v1 kapsamı dışı.
9. `plan_status` enum'ına eklenen değerler geri alınamaz (Postgres `ALTER TYPE ADD VALUE` tek yönlü).
10. Mevcut 409 self-service guard'ının korunması kritik.
11. Admin manuel plan ataması ile Paddle durum makinesinin çakışma riski — webhook yalnızca kendi tanıdığı `paddle_subscription_id` ile ilişkili değişiklikleri uygulamalı.
12. Finansal entegrasyon olduğu için birleştirmeden önce güvenlik incelemesi + webhook güven sınırına özel ikinci bir insan gözden geçirmesi öneriliyor.

---

### Proje sahibinden beklenen kararlar
- Gerçek Pro/Premium fiyatları ve para birimi (dev varsayılanı mı kalacak?).
- Paddle AUP'nin MotionMeet'in sosyal özelliklerine uygulanabilirliğinin netleştirilmesi.
- `past_due` ve iade durumlarında premium erişim politikası.
- Mobile checkout'un v1'de "web'e yönlendir" sınırında kalmasının onayı.
