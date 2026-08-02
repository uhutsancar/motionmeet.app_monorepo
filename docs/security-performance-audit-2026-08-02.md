# MotionMeet güvenlik ve performans uygunluk raporu

Tarih: 2 Ağustos 2026

İncelenen rehberler:

- `MOBILE_SECURITY_AND_PERFORMANCE_GUIDE.md`
- `WEB_SECURITY_AND_PERFORMANCE_GUIDE.md`

## 1. Sonuç

Repository'nin mevcut mimarisi korunarak, ek çalışan servis veya ücretli araç
gerektirmeyen güvenlik ve performans kontrolleri uygulandı. AWS hesabına, S3
bucket'larına veya başka bir dış sisteme yazma işlemi yapılmadı. Yerel testler
yalnız repository çıktıları ile mevcut izole PostgreSQL test verisini kullandı.

En önemli sonuçlar şunlardır:

- Web refresh/logout cookie akışına exact-origin ve özel header tabanlı CSRF
  kontrolü eklendi; Bearer access token kullanan normal API çağrıları gereksiz
  cookie-CSRF katmanına alınmadı.
- API, sözleşmesinde olmayan form, text ve XML body tiplerini `415` ile reddeder.
- Ham PostgreSQL/S3/Socket hata ayrıntılarının public response ve production
  loglarına sızması azaltıldı; sunucu üretimli request ID kullanılıyor.
- Redis bağlantısı route modüllerinden sonra açılsa bile rate limiter artık
  istek anında ortak Redis store'a geçebiliyor; Redis yokken process-local
  koruma çalışmaya devam ediyor.
- Web ve mobil logout/session temizleme işlemi kullanıcıya ait Redux verisini de
  sıfırlıyor.
- Android backup kapatıldı; eski geniş depolama izinleri engellendi; gereksiz
  mikrofon izni kaldırıldı. Token'lar iOS'ta cihaz dışına taşınmayan SecureStore
  erişilebilirlik sınıfıyla tutuluyor.
- Recharts ilk açılış zincirinden çıkarıldı. Web başlangıç JS'i gzip olarak
  `361.355` bayttan `259.958` bayta düştü; azalma yaklaşık `%28,1`.
- Mobil Android/iOS/web export'u çalışır hale getirildi; bundle ve toplam
  artefakt boyutları ilk baseline'ın yaklaşık `%10` üstünde CI'ı durdurur.
- CI'daki çalışmayan eski MongoDB adımı mevcut PostgreSQL test servisine taşındı.
  Web artefakt ve bundle bütçesi ile mobil config güvenlik testi kök `test`
  görevine bağlandı.

Kod, config ve yerel test seviyesinde kritik bir regresyon gözlenmedi. Bununla
birlikte gerçek domain response header testi, iki kullanıcılı tam endpoint IDOR
matrisi, imzalı mobil release artefaktı, gerçek cihaz profili ve browser E2E
olmadan proje “production güvenliği tamamen doğrulandı” kabul edilmemelidir.

## 2. Kapsam ve karar yöntemi

Her rehber maddesi aşağıdaki durumlarla değerlendirildi:

| Durum | Anlamı |
| --- | --- |
| `MEVCUT-DOĞRULANDI` | Kod/config bulundu ve yerel otomatik kanıt üretildi. |
| `KISMİ` | Temel kontrol var; release artefaktı, canlı ortam veya geniş negatif test eksik. |
| `EKSİK` | Projede uygulanabilir fakat henüz tamamlanmamış. |
| `UYGULANAMAZ` | Mevcut ürün akışında ilgili saldırı yüzeyi yok. |
| `KARAR GEREKLİ` | Domain, altyapı, native build veya ürün kararı olmadan güvenle uygulanamaz. |

İncelenen çalışma alanları: Express/Socket.IO backend, Kysely/PostgreSQL veri
katmanı, Redis kullanımı, S3 presigned upload yaşam döngüsü, React/Vite web,
Expo/React Native mobile, shared sözleşmeler, Nginx/Vercel header config'leri,
Docker ve GitHub Actions.

## 3. Mimari ve güven sınırları

```text
Web / Mobile
    -> HTTPS REST + Bearer access token
    -> WSS Socket.IO + access token
Backend
    -> PostgreSQL (kalıcı ve yetkili veri kaynağı)
    -> Redis (cache, rate limit, pub/sub, kısa lock; opsiyonel fallback)
    -> S3 (backend'in ürettiği key için kısa ömürlü presigned PUT)
    -> ImageKit/CDN public medya URL'si
```

Güvenlik kararlarında istemciden gelen kullanıcı ID'si, aggregate metrik, MIME
etiketi, object key veya public URL yetkili kabul edilmedi. Kalıcı sahiplik ve
ilişki kararları backend/PostgreSQL tarafında tutuluyor. Web refresh token'ı
HttpOnly cookie'de, access token bellekte; native mobile token'ları SecureStore'da.

## 4. Web/backend rehberi karar matrisi

| Kontrol | Durum | Kanıt ve karar | Kalan iş/risk |
| --- | --- | --- | --- |
| IDOR / object-level authorization | `KISMİ` | `protect`, DB'den kullanıcı bağlama, rol, privacy, ownership ve ilişki kontrolleri service/controller katmanlarında mevcut. Admin route'ları `superadmin` ile sınırlı. | Rehberdeki User A/User B matrisi tüm read/update/delete endpoint'leri için otomatik değil; release öncesi zorunlu. |
| XSS: React render | `MEVCUT-DOĞRULANDI` | Kaynak taramasında `dangerouslySetInnerHTML`, `innerHTML`, `eval` benzeri sink bulunmadı. React text render ve e-posta HTML escaping testleri mevcut. | Yeni rich-text/Markdown özelliği eklenirse sanitizer ve ayrı test gerekir. |
| URL güvenliği | `KISMİ` | Public medya URL sözleşmesi HTTP dışı şemaları reddediyor; S3 key'i backend üretiyor. | Kullanıcı tarafından girilen yeni dış link alanları merkezi allowlist helper kullanmalı. |
| CSP ve browser header'ları | `KISMİ` | Nginx/Vercel config'lerinde CSP, HSTS, nosniff, frame deny, referrer ve permissions policy var. Artefakt testi bunların kaybolmasını engelliyor. Dotfile erişimi ve autoindex kapatıldı. | `img-src/media-src https:` ve `connect-src https:/wss:` gerçek API/CDN hostları belli olunca daraltılmalı. `style-src 'unsafe-inline'` MUI/Emotion nonce stratejisi olmadan kaldırılmadı. Canlı response doğrulanmadı. |
| CSRF | `MEVCUT-DOĞRULANDI` | Cookie kullanan `/refresh` ve `/logout`, tam eşleşen Origin/Referer allowlist'i ve `X-CSRF-Protection: 1` ister. Web Axios bunu mutation isteklerine ekler. Native body-refresh cookie kullanmadığı için ayrıştırıldı. Suffix-origin negatif testi var. | Gerçek browser cookie akışı E2E ile tekrar doğrulanmalı. |
| Path traversal / LFI | `KISMİ` | Runtime'da kullanıcı girdisinden filesystem path açan endpoint bulunmadı. Medya key'leri backend üretimli ve rezervasyon sahibine/purpose'a bağlı. Nginx dotfile isteğini reddeder. | Deployed Nginx üzerinde encoded traversal/dotfile payload testi yapılmalı. |
| SSRF | `UYGULANAMAZ` | Backend'in kullanıcıdan URL alıp genel ağ isteği yaptığı bir endpoint bulunmadı. AWS SDK yalnız yapılandırılmış S3'e, e-posta yapılandırılmış relay'e gider. | İleride URL preview/import/webhook eklenirse egress ve IP/redirect doğrulaması zorunlu hale gelir. |
| Presigned S3 güvenliği | `MEVCUT-DOĞRULANDI` | Key backend üretimli; kullanıcı/purpose/expiry rezervasyonu, plan-boyut-MIME sınırı, HEAD ve magic-byte doğrulaması mevcut. Public serializer'ın internal object key sızdırmama testi geçiyor. | Gerçek S3 CORS/IAM/lifecycle ve PUT/verify/delete smoke testi AWS erişimi gerektirdiğinden çalıştırılmadı. |
| XXE / XML | `MEVCUT-DOĞRULANDI` | API yalnız JSON ve explicit multipart kabul ediyor; XML, text ve urlencoded form `415`. Negatif birim testi var. | XML özelliği eklenirse ayrı güvenli parser politikası gerekir. |
| Race condition / idempotency | `MEVCUT-DOĞRULANDI` | Transaction, row lock, unique/check constraint, operation ID ve retry senaryoları yerel PostgreSQL concurrency testleriyle geçti. Refresh client tek-flight kullanıyor. | Çok instance Socket/Redis kesinti testi yapılmadı. |
| Rate limiting | `KISMİ` | Global/auth/account/media/exercise limitleri var. Import-time memory-store hatası giderildi; adapter request anında Redis'e geçiyor ve Redis yoksa memory fallback'i koruyor. Fallback testi var. | Horizontal production'da Redis bağlantısı ve instance'lar arası tek sayaç yük testi zorunlu. Redis yokken memory store yalnız instance bazlıdır. |
| SQL injection | `MEVCUT-DOĞRULANDI` | Runtime sorguları Kysely binding kullanıyor. Kullanıcı girdisini raw SQL stringine birleştiren yol bulunmadı; raw SQL migration/statik sorgular ve bind parametreli account sorgularıyla sınırlı. | Yeni dynamic sort/column alanlarında explicit identifier allowlist korunmalı. |
| Input validation / mass assignment | `KISMİ` | Controller'lar alanları destructure ederek seçiyor; `.set(req.body)` benzeri mass assignment bulunmadı. Sayısal, auth, pagination ve medya validator testleri var. | Bütün DTO'larda unknown-field reddi ve HTTP parameter pollution testleri merkezi değil. Endpoint bazında tamamlanmalı. |
| Hata response'u | `MEVCUT-DOĞRULANDI` | DB unique/detail ve parser mesajları generic response'a çevriliyor; 404 URL'yi yansıtmıyor; 5xx stack/message dönmüyor. Uygulamanın kontrollü 4xx mesajları korunuyor. | Domain error code standardizasyonu ileride artırılabilir. |
| Log redaction | `MEVCUT-DOĞRULANDI` | DB, Redis, Socket, password-reset, cron ve process-level logları ham error/detail yerine ad/kod metadata'sı kullanıyor. Redaction testi PII içeren DB detail'ini dışarıda bırakıyor. | Harici gözlemlenebilirlik sistemi bağlandığında aynı alan allowlist'i korunmalı. |
| Header bilgi sızıntısı | `KISMİ` | Express `x-powered-by` kapalı; Nginx server token kapalı ve upstream teknoloji/debug header'larını gizliyor. CORS request/exposed header listesi explicit. | Canlı CDN/load-balancer response'u olmadan ara katman header'ları doğrulanamaz. |
| Bağımlılık açığı | `MEVCUT-DOĞRULANDI` | `pnpm audit --prod --audit-level=high` sonucu: bilinen açık yok. | Lockfile taraması CI'da kalmalı; sonuç zamana bağlıdır. |
| Source map / secret artefaktı | `MEVCUT-DOĞRULANDI` | Production Vite çıktısındaki 76 dosya tarandı; source map, private-key/env adı ve yüksek güvenli secret imzası bulunmadı. | Gerçek deployment artefaktına da aynı test uygulanmalı. |
| Otomatik DAST / browser E2E | `EKSİK` | Bu repository'de Playwright/Cypress ve local DAST harness yok. | Uygulama ayağa kaldırılıp ayrı QA verisi hazırlandığında ücretsiz local araçla eklenebilir; bu turda yeni servis kurulmadı. |

## 5. Mobil rehber karar matrisi

| Kontrol | Durum | Kanıt ve karar | Kalan iş/risk |
| --- | --- | --- | --- |
| Production HTTPS/WSS | `KISMİ` | Release modunda `EXPO_PUBLIC_API_URL` ve web origin'i HTTPS değilse config hata veriyor; Socket aynı güvenli origin'i kullanıyor. | İmzalı release binary içinde cleartext flag ve gerçek endpoint ayrıca incelenmeli. |
| Android backup/transfer | `MEVCUT-DOĞRULANDI` | `android.allowBackup=false`; config testi ve Expo resolved prebuild config doğrulandı. | Final AndroidManifest/AAB üzerinde tekrar kontrol gerekir. |
| Token saklama | `MEVCUT-DOĞRULANDI` | Native access/refresh/expiry SecureStore'da. iOS erişilebilirliği `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; web dalı SecureStore kullanmıyor. | Root/jailbroken cihazda mutlak gizlilik garanti değildir. |
| Session temizliği | `MEVCUT-DOĞRULANDI` | Logout/refresh failure tokenları ve eski tokenı silerken Redux user/post/story/connection/message state'ini de başlangıç durumuna döndürüyor. | Background/kill/relogin cihaz E2E'si gerekir. |
| Hassas AsyncStorage | `MEVCUT-DOĞRULANDI` | AsyncStorage kullanımı dil, tema ve notification preference ile sınırlı; token veya profil payload'ı bulunmadı. | Yeni cache alanları code review'da sınıflandırılmalı. |
| Log ve hata temizliği | `MEVCUT-DOĞRULANDI` | İşlenmiş hata logger'ı yalnız development'ta ad/status/kod/request ID basıyor; ham response/body/message kaldırıldı. Production config fallback ayrıntısı basmıyor. | Native crash SDK eklenirse payload allowlist'i yeniden değerlendirilmeli. |
| Deep link / dış URL | `KISMİ` | Açılan URL'ler sabit MotionMeet/Twitter/mailto değerleri veya production'da HTTPS olması zorunlu `WEB_URL`; kullanıcı girdisi doğrudan açılmıyor. | İmzalı app üzerinde hostile scheme/intent ve universal/app link matrisi yok. |
| İzin minimizasyonu | `KISMİ` | Mikrofon izni kapatıldı; legacy read/write external storage izinleri blocked. Expo prebuild resolved config yalnız `INTERNET` gösteriyor. Kamera mevcut workout fotoğraf akışında gerçekten kullanıldığı için kaldırılmadı. | Final AAB/IPA permission çıktısı ve gerçek kamera/library prompt'ları cihazda doğrulanmalı. |
| API/Socket auth | `KISMİ` | Tek-flight refresh, bounded token, auth Socket handshake ve mesaj/typing permission/rate kontrolleri var. | Reconnect fırtınası ve ağ geçişi soak testi gerçek cihaz gerektirir. |
| Medya upload | `KISMİ` | İstemci presign sonucuna PUT yapıyor; backend sahibi, purpose, MIME, boyut ve signature doğruluyor. | Kötü/büyük dosya ve yarıda kesilen upload gerçek S3 olmadan uçtan uca test edilmedi. |
| Bağımlılık/build | `MEVCUT-DOĞRULANDI` | Production dependency audit, lint, strict typecheck, Expo Doctor 18/18, resolved Expo config ve Android/iOS/web export hattı geçti. Hatalı Metro server-root override'ı kaldırıldı. | İmzalı store build'i üretilmedi. |
| Root detection | `KARAR GEREKLİ` | Eklenmedi. Rehber bunu P2/bilgilendirme modu olarak tanımlıyor; native bağımlılık, false-positive ve bakım etkisi var. | Tehdit modeli ve gerçek cihaz build'i hazır olduğunda ayrıca karar verilmeli. |
| Certificate pinning | `KARAR GEREKLİ` | Eklenmedi; sertifika rotasyonu ve native build yaşam döngüsü belirlenmeden uygulanması erişim kesintisi yaratabilir. | Domain/sertifika operasyon modeli netleşince değerlendirilir. |
| Hassas ekran koruması | `KARAR GEREKLİ` | Uygulamada finansal/kimlik belgesi gibi ayrı tanımlı hassas ekran sınıfı yok; blanket screenshot engeli eklenmedi. | Ürün hassas ekranları sınıflandırırsa ekran bazında uygulanmalı. |
| Mobil güvenlik/perf E2E | `EKSİK` | Bu tur config ve export seviyesindedir. | Düşük/orta cihaz, cold/warm start, feed scroll, upload, reconnect, workout ve 30–60 dk soak ölçümleri gerekir. |

## 6. Yapılan değişikliklerin teknik özeti

### Backend

- `browserSecurity` middleware'i eklendi: exact-origin CSRF ve API content-type
  sözleşmesi.
- Refresh/logout route'ları cookie kullanımına uygun CSRF kontrolüne alındı.
- Request ID yalnız sunucu tarafından üretiliyor.
- Public error eşlemesi ve structured safe-error metadata eklendi.
- Redis rate-limit store seçim zamanı düzeltildi; memory fallback korundu.
- `X-Powered-By` kaldırıldı ve CORS header sözleşmesi explicit yapıldı.
- CI integration testi PostgreSQL schema migration + test akışına düzeltildi.

### Web

- Mutation isteklerine CSRF header interceptor'ı eklendi.
- Session temizliğinde bütün kullanıcıya özel Redux state'i sıfırlanıyor.
- Nginx dotfile/autoindex/teknoloji-header sertleştirmesi eklendi.
- pnpm sanal yollarıyla hatalı çalışan vendor ayrımı düzeltildi; Recharts yalnız
  onu kullanan lazy route zincirinde kaldı.
- Production artefakt ve gzip bütçe testleri eklendi.

### Mobile

- SecureStore erişilebilirliği cihaz dışına taşınmayacak biçimde sıkılaştırıldı.
- Session temizliğinde bütün kullanıcıya özel Redux state'i sıfırlanıyor.
- Android backup kapatıldı; legacy storage ve mikrofon izni kaldırıldı.
- Production loglarında ham error nesnesi/message bırakılmadı.
- Expo monorepo giriş çözümlemesini bozan `unstable_serverRoot` override'ı
  kaldırıldı; Android/iOS/web export yeniden çalışır hale geldi.
- Mobil config güvenlik testi kök test hattına; bundle/source-map/secret ve
  artefakt büyüme bütçesi build hattına bağlandı.

## 7. Performans ölçümleri

### Web production bundle

Ölçüm, `dist/index.html` girişinden başlayarak yalnız statik import zincirindeki
JS/CSS dosyalarının gzip-9 boyutunu toplar. Dynamic import'lar ilk yüklemeye
eklenmez.

| Metrik | Önce | Sonra | CI bütçesi | Sonuç |
| --- | ---: | ---: | ---: | --- |
| İlk yükleme JS, gzip | 361.355 B | 259.958 B | 276.480 B (270 KiB) | Geçti |
| İlk CSS, gzip | 3.542 B | 3.542 B | 81.920 B | Geçti |
| En büyük JS chunk, gzip | 176.433 B | 176.435 B | 204.800 B | Geçti |
| Public source map | 0 | 0 | 0 | Geçti |

Rehberdeki başlangıç hedefi 250 KiB'dir (`256.000 B`). Sonuç bunun `3.958 B`
üzerindedir; bu nedenle rehber hedefi `KISMİ`, regresyonu önleyen 270 KiB CI
bütçesi ise `MEVCUT-DOĞRULANDI` olarak kabul edildi. Hedefi yakalamak için locale
paketlerini veya UI çekirdeğini yeniden bölmek mümkündür; yalnız yaklaşık 4 KB
için auth/i18n başlangıç davranışına risk eklenmedi.

### Backend/PostgreSQL

Concurrent write/idempotency, self-edge constraint ve index contract testleri
yerel PostgreSQL üzerinde geçti. Bu testler correctness/regresyon testidir;
production veri hacminde p95/p99 latency veya kapasite testi değildir. Kullanıcı
talebindeki maliyet sınırı nedeniyle harici load generator, managed Redis/DB veya
AWS üzerinde yük üretilmedi.

### Mobile

Expo production-benzeri export ilk statik baseline'ı oluşturdu:

| Metrik | Baseline | CI üst sınırı | Sonuç |
| --- | ---: | ---: | --- |
| Android Hermes bundle | 4.529.917 B | 5.000.000 B | Geçti |
| iOS Hermes bundle | 4.522.076 B | 5.000.000 B | Geçti |
| Mobile web JS | 2.351.161 B | 2.600.000 B | Geçti |
| Toplam export artefaktı | 14.876.757 B | 16.400.000 B | Geçti |
| Public source map | 0 | 0 | Geçti |

Üst sınırlar ilk baseline'ın yaklaşık `%10` üzerindedir. Export listesinde
Ionicons ve MaterialCommunityIcons fontlarının hash'li/hash'siz kopyaları
görülüyor; toplam boyutu azaltmak için P1 inceleme adayıdır fakat icon davranışını
riske atmamak için bu turda değiştirilmedi.

Bu statik boyutlar cihaz performansı değildir. Cold/warm start, JS/UI thread FPS,
memory, battery, feed scroll ve soak bütçeleri fiziksel cihaz ya da imzalı release
build olmadan güvenilir ölçülemez; sayı uydurulmadı.

## 8. Çalıştırılan doğrulamalar

| Komut/kontrol | Sonuç |
| --- | --- |
| `pnpm lint` | 4 görev geçti. |
| `pnpm typecheck` | 5 paket geçti. |
| `pnpm test` | Shared 4/4, backend son hedefli koşuda 30/30; web artefakt/perf ve mobile config geçti. |
| `pnpm build` | Shared/backend/web ve Expo Android/iOS/web export geçti; mobil artefakt bütçesi geçti. |
| `pnpm audit --prod --audit-level=high` | Bilinen production açığı yok. |
| `pnpm dlx expo-doctor@latest packages/mobile` | 18/18 kontrol geçti; repository bağımlılığı eklenmedi. |
| Web production build | 14.165 modül dönüştü; build geçti. |
| Web artefakt taraması | 76 dosya; 0 source map; 0 bulgu. |
| Expo resolved prebuild config | Backup kapalı; storage izinleri blocked; mikrofon kapalı; explicit izin `INTERNET`. |
| Mobil export artefakt taraması | 48 dosya; 0 source map; 0 secret bulgusu; bütün boyut bütçeleri geçti. |
| `git diff --check` | Whitespace hatası yok. |

Backend testleri var olan yerel PostgreSQL test veritabanında transaction açıp
test satırlarını temizler. AWS/S3 çağrısı, canlı kullanıcı verisi değişikliği,
deployment veya ücretli tarama yapılmadı.

## 9. Release öncesi açık kapılar

Öncelik sırası:

1. İki ayrı QA kullanıcısıyla bütün ID taşıyan endpoint'lerde A/B IDOR negatif
   testi ve admin/non-admin rol matrisi.
2. Gerçek domain üzerinde HTTPS/WSS, CORS, cookie, CSRF ve response header testi;
   sonra CSP `connect-src`, `img-src`, `media-src` hostlarını daraltma.
3. İmzalı Android/iOS release artefaktında manifest/entitlement, backup,
   cleartext, permission ve secret/source-map incelemesi.
4. Düşük ve orta sınıf gerçek cihazlarda rehberin cold/warm start, feed scroll,
   upload, Socket reconnect, workout ve soak senaryoları.
5. Horizontal backend kullanılacaksa gerçek Redis ile multi-instance rate-limit,
   Socket adapter ve kesinti/fallback testi.
6. Browser E2E/DAST ve Lighthouse/CWV taban çizgisini uygulama lokal veya staging
   ortamında ayağa kalktığında CI'ya ekleme.

Root detection, certificate pinning, ücretli gözlemlenebilirlik ve production
load testi mevcut aşamada özellikle eklenmedi. Bunlar yalnız gerçek tehdit modeli,
domain/native build ve operasyonel rollback planıyla değerlendirilmelidir.
