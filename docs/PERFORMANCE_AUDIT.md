# MotionMeet — Performans, Ölçeklenebilirlik ve Production Hardening Denetimi

> Denetim tarihi: 23 Ağustos 2026
>
> Kaynak: `packages/backend`, `packages/web`, `packages/mobile`, `packages/shared`,
> `db/migrations`, `docker-compose*.yml`, `turbo.json`, `vite.config.ts`
>
> Yöntem: kod okuma + gerçek production build ölçümü + query/index eşleştirmesi.
>
> **Kural: önce problemi kanıtla, sonra çöz.** Aşağıdaki her madde bir dosya ve
> satır referansıyla gerekçelendirilmiştir. Ölçülmemiş iddia yoktur.

---

## 0. Ölçüm tabanı (BEFORE)

Bu değerler değişikliklerden önce, bu makinede alınmıştır.

| Ölçüm | Değer | Kaynak |
| --- | ---: | --- |
| Web initial JS (index + vendor-core + vendor-network + vendor-state) | **874.45 KB raw / 275.74 KB gzip** | `pnpm --filter @motionmeet/web build` |
| — `vendor-core` (react + MUI + emotion) | 619.83 KB / 190.15 KB gz | aynı |
| — `vendor-network` (axios + socket.io-client), `modulepreload` ile ilk boyada indiriliyor | 87.56 KB / 29.18 KB gz | aynı |
| — `index` | 135.25 KB / 44.63 KB gz | aynı |
| — `vendor-state` | 31.81 KB / 11.78 KB gz | aynı |
| Web initial CSS | 12.69 KB | aynı |
| `moment` chunk | 60.01 KB / 19.04 KB gz | aynı |
| Recharts (`CartesianChart`) | 296.93 KB / 82.52 KB gz | aynı |
| Web `dist` toplamı | 2.0 MB | `du -sh` |
| Web production build süresi | 3 dk 27 sn | aynı |
| `pnpm typecheck` (5 paket) | 1 dk 56 sn, **5/5 başarılı** | turbo |
| Backend TypeScript | 11.096 satır / 125 dosya | `wc -l` |
| Web TypeScript | 17.643 satır / 100 dosya | `wc -l` |
| Mobile TypeScript | 21.965 satır / 102 dosya | `wc -l` |

---

## 1. Mevcut mimari (Current Architecture)

Mimari **doğru kurulmuş**. Bu denetim mimariyi değiştirmeyi değil, mevcut doğru
mimarinin içindeki yanlış kullanımları düzeltmeyi hedefler.

- pnpm workspace + Turborepo; `@motionmeet/shared` tek sözleşme merkezi.
- Express 5 + Kysely + PostgreSQL 18 (tek kalıcı kaynak), Redis 7.4 (cache /
  rate limit / pub-sub / lock), S3 + ImageKit (binary medya), Socket.IO (realtime).
- `route -> middleware -> controller -> service -> repository -> DB` akışı korunmuş.
- Durable outbox + `media_deletion_jobs` + `FOR UPDATE SKIP LOCKED` claim modeli
  mevcut ve doğru.
- Cursor pagination `(created_at, id)` üzerinden; `operation_id` partial unique
  index'leriyle idempotency mevcut.
- Backend stateless; Socket.IO Redis adapter `onRedisReady` ile bağlanıyor.
- Graceful shutdown, `/health/live`, `/health/ready` mevcut.

**Doğru olan ve korunacak kararlar:** medya API'den geçmiyor (presigned PUT),
Redis kalıcı depo değil, privacy service katmanında, refresh token HttpOnly
cookie'de, medya silme durable job'a ayrılmış.

---

## 2. Kritik darboğazlar (Critical Bottlenecks)

### 2.1 [P0] Her write, tüm Redis keyspace'ini tarıyor ve bütün kullanıcıların feed cache'ini siliyor

`configs/redis.ts` içindeki `invalidateCachePrefix` bir
`SCAN ... MATCH motionmeet:v1:feed:*` döngüsüdür. Redis'te `MATCH` bir indeks
değildir: **tarama önce yapılır, filtre sonra uygulanır.** Yani her çağrı,
keyspace'in tamamını `COUNT 200` adımlarla gezer.

Bu fonksiyon şu 9 sıcak write yolunda çağrılıyor:

| Çağrı yeri | Tetikleyen kullanıcı eylemi |
| --- | --- |
| `postInteractionService.ts:73` | `togglePostLike` |
| `postInteractionService.ts:86` | `likePost` |
| `postInteractionService.ts:99` | `unlikePost` |
| `postInteractionService.ts:113` | `createPostComment` |
| `postService.ts:62` | `createPost` |
| `postService.ts:193` | `deletePostById` |
| `relationshipService.ts:120` | follow / unfollow / accept |
| `userService.ts:88` | profil güncelleme |
| `accountService.ts:70` | hesap silme |

**Like storm senaryosu (Scenario C):** aynı posta 1.000 like geldiğinde 1.000 kez
tüm keyspace taranır **ve** her seferinde sistemdeki *bütün* kullanıcıların feed
cache'i silinir. Ardından o kullanıcıların bir sonraki feed isteği cache miss
olur ve doğrudan PostgreSQL'e iner.

Komut dosyasının 143. maddesinde açıkça yasaklanan iki davranış: "bütün cache'i
her write'ta temizleme" ve "bütün feed'i her like'ta yeniden fetch etme".

Bu tek başına projedeki en büyük ölçeklenme riskidir. **P0.**

### 2.2 [P0] Cache stampede koruması yok

`postService.ts:88-105` — feed cache miss'inde tek uçuş (single-flight) yoktur.
2.1 ile birleştiğinde: bir like -> tüm feed cache silinir -> aynı anda N kullanıcı
aynı anda cache miss üretir -> N adet feed sorgusu PostgreSQL'e gider. Komut
dosyası 12. madde tam olarak bunu tarif ediyor.

### 2.3 [P1] Story görüntüleme başına 6 veritabanı sorgusu

`controllers/storyController.ts` -> `viewStory` akışı:

1. `storyService.getStoryById` -> 1 sorgu
2. `canViewStoriesOf` -> `getAccountVisibility` -> **3 paralel sorgu**
   (`users`, `user_follows`, `connections`)
3. `recordStoryView` -> `SELECT` + `INSERT ... ON CONFLICT DO NOTHING` -> 2 sorgu

**Toplam 6 sorgu**, ve bu *tekrar açılan* hikâyelerde de aynen tekrarlanır.
Kullanıcı 20 hikâyeyi kaydırdığında **120 sorgu**. Komut dosyası 88. maddesi
("aynı story view'i tekrar tekrar DB'ye yazma") ihlal ediliyor.

### 2.4 [P1] Feed response'unda post başına 20 yorum taşınıyor

`postInteractionService.ts:11` — `COMMENT_PREVIEW_LIMIT = 20`. Feed sayfası 30
post döndürüyor, yani feed response'u **600 yorum satırı + o yorumların yazar
kayıtları** taşıyor. 28. ve 135. maddeler ihlal ediliyor. Feed kartı UI'da en
fazla 2-3 yorum gösteriyor.

### 2.5 [P1] Kullanıcı araması full table scan

`userService.ts` -> `searchUsers` şunu üretiyor:

```sql
where full_name ilike '%term%'
```

Baştaki `%` yüzünden hiçbir B-tree indeksi kullanılamaz. Üstelik `users`
üzerinde duran `users_search_idx` bir **GIN tsvector** indeksidir
(`001_initial_postgresql.ts:66`) ve `ilike` onu asla kullanamaz — yani bu indeks
yalnızca **yazma maliyeti** üretiyor, hiçbir sorguyu hızlandırmıyor
(32. madde: index overload).

### 2.6 [P1] Socket mesajında gönderen her seferinde DB'den yükleniyor

`realtime/socketHandlers.ts:26-30` — her `send_message` olayında
`userService.getUserById(userId)` (kullanıcı + plan join) ve ardından
`canSendToUser` -> `evaluateMessagePermission` (2-4 sorgu daha) çalışıyor.
Oysa `socket.data.user` handshake'te zaten yüklenmiş ve `typing` yolunda
30 saniyelik bir izin cache'i **zaten mevcut** — mesaj yolunda kullanılmıyor.

### 2.7 [P1] Like/comment yanıtı 3 gereksiz sorgu bekletiyor

`postInteractionService.ts:63-66` -> `notifyPostLike` -> `publishNotification`
her like'ta `hydrate()` (1-2 sorgu) + `countUnread()` (1 sorgu) çalıştırıp
**HTTP yanıtını bekletiyor** — alıcının açık soketi olmasa bile. Bildirim satırı
zaten `recordNotification` ile kalıcı; yayın best-effort.

### 2.8 [P2] API yanıtları sıkıştırılmıyor

`server.ts` middleware zincirinde `compression` yok. Feed/mesaj/keşfet JSON
yanıtları ham gidiyor. 118. madde.

---

## 3. Veritabanı darboğazları (Database Bottlenecks)

| # | Bulgu | Kanıt | Öncelik |
| --- | --- | --- | --- |
| 3.1 | `users` üzerinde `ilike '%...%'` -> seq scan | `userService.searchUsers` | P1 |
| 3.2 | `users_search_idx` (GIN tsvector) hiçbir sorgu tarafından kullanılmıyor — sadece INSERT/UPDATE maliyeti | `001:66` | P1 |
| 3.3 | `pg` pool'da `statement_timeout` / `query_timeout` yok — kaçak bir sorgu bağlantıyı süresiz tutabilir | `configs/database.ts:8-16` | P1 |
| 3.4 | `togglePostLike` / `likePost` hot post satırında `SELECT ... FOR UPDATE` alıyor -> popüler postta bütün like'lar seri hale geliyor | `postInteractionService.ts:69,80` | P1 |
| 3.5 | Like sayacı `UPDATE` sonrası ayrı bir `SELECT like_count` ile okunuyor (`postCount`) — `returning` ile tek sorguya inebilir | `postInteractionService.ts:57` | P2 |
| 3.6 | `getChatMessagesList` her sayfada — geçmişe scroll dâhil — `markMessagesSeen` write transaction'ı çalıştırıyor | `messageService.ts:97` | P2 |
| 3.7 | Egzersiz listesinde hâlâ `OFFSET` yolu var (`skipNum`) | `exerciseService.ts:41` | P2 |
| 3.8 | Birçok okuma `selectAll()` (= `SELECT *`) kullanıyor | `userService.ts:196`, `postRepository.ts:12` | P2 |
| 3.9 | `getStoriesForUser` varsayılan limit 100, tavan 200 — tek istekte 200 hikâye | `storyController.ts:138` | P2 |

**Doğru olanlar:** `hydratePosts` medya ve workout'ları batch çekiyor (N+1 yok),
`hydratePostInteractions` window function ile tek sorguda yorum önizlemesi
alıyor, `getRelationshipMap` iki sorguda tüm ilişki matrisini kuruyor,
`posts_discover_rank_idx` partial index Keşfet'i doğrudan besliyor, kota
rezervasyonu atomik `UPDATE ... WHERE count < limit` ile yapılıyor.

---

## 4. Redis darboğazları (Redis Bottlenecks)

| # | Bulgu | Kanıt | Öncelik |
| --- | --- | --- | --- |
| 4.1 | `invalidateCachePrefix` = full keyspace SCAN (bkz. 2.1) | `redis.ts:216` | P0 |
| 4.2 | Feed cache key `feed:{user}:{mode}:{cursor}:{limit}` — kullanıcı × cursor × limit kombinasyonu, TTL 30 sn. Hit oranı düşük, bellek yüksek | `postService.ts:86` | P1 |
| 4.3 | Profil cache key `profile:{profileId}:{requesterId}:...` — **her izleyici için ayrı kopya**. 1.000 izleyici = 1.000 kayıt | `userService.ts:189` | P1 |
| 4.4 | Egzersiz kataloğu cache key'inde `userId` var — 1.325 egzersizlik **ortak master data** her kullanıcı için ayrı ayrı saklanıyor | `exerciseService.ts:28,62` | P1 |
| 4.5 | Cache stampede / single-flight yok | `postService.ts:88` | P0 |
| 4.6 | Cache namespace tutarsız: veri `motionmeet:v1:`, rate limit `motionmeet:rate-limit:`, lock `motionmeet:lock:`, socket limit `motionmeet:socket-limit:` — 39. madde tek namespace istiyor | `redis.ts:207,152,229,262` | P3 |

**Doğru olanlar:** `KEYS *` hiçbir yerde kullanılmıyor, lock'lar Lua ile sahiplik
kontrolü yaparak açılıyor, rate limit store Redis düşünce memory'ye kontrollü
düşüyor, Redis yokken bütün cache helper'ları sessizce no-op oluyor.

---

## 5. Backend darboğazları

- 2.6, 2.7 (yukarıda).
- `server.ts`: `compression` middleware yok (2.8).
- `emitPresenceToConnections` bağlantı/kopma başına `getAcceptedConnectionUserIds`
  (200 satıra kadar) çekiyor; `isUserOnline` Redis adapter altında
  `fetchSockets()` ile cluster-wide broadcast yapıyor — connect ve disconnect'te
  ikişer kez.
- `getUserConnectionsData` tek çağrıda 4 sorgu × 200-satır limit döndürüyor.

---

## 6. Web darboğazları

| # | Bulgu | Kanıt | Öncelik |
| --- | --- | --- | --- |
| 6.1 | `socket.io-client` + axios (`vendor-network`, 87.56 KB) `modulepreload` ile **landing sayfasında bile** indiriliyor | `dist/index.html`, `vite.config.ts` | P1 |
| 6.2 | `moment` (60 KB) feed kritik yolunda: `PostCard`, `RecentMessages`, `StoryViewer` + 5 sayfa. Mobile aynı iş için `dayjs` kullanıyor — aynı işin iki farklı yolla yapılması (5. madde) | 8 dosya | P1 |
| 6.3 | `PostCard` **memo'lu değil** — `state.posts` içindeki tek bir like değişimi bütün feed kartlarını yeniden render ediyor | `pages/Feed.tsx:96` | P1 |
| 6.4 | `PostCard` like durumunu hem local state'te hem Redux'ta tutuyor; API'yi `postsSlice` üzerinden değil doğrudan `api` ile çağırıyor -> iki kaynaklı gerçek (76. madde) | `PostCard.tsx:71-72,105` | P2 |
| 6.5 | Feed sanallaştırılmamış; "Load more" ile 10 sayfa = 300 DOM kartı | `pages/Feed.tsx:96` | P2 |
| 6.6 | `recharts` (296 KB) `Profile.tsx` ve `Exercises.tsx` tarafından statik import ediliyor -> profil açmak chart kütüphanesini indiriyor (123. madde) | 9 dosya | P2 |
| 6.7 | `vite.config.ts` `server.watch.usePolling: true` — yavaş diskte HMR'ı ve CPU'yu ciddi biçimde yüklüyor (68. madde) | `vite.config.ts` | P2 |
| 6.8 | `<img>` etiketlerinde `srcset`/`width`/`height` yok -> layout shift (18-19. madde) | web geneli | P2 |

**Doğru olanlar:** bütün route'lar `lazy()`, manuel chunk ayrımı var, terser
minify, source map opsiyonel, `dedupe: ['react','react-dom']`.

---

## 7. Mobile darboğazları

| # | Bulgu | Kanıt | Öncelik |
| --- | --- | --- | --- |
| 7.1 | En ağır listeler `expo-image` yerine React Native'in `Image`'ını kullanıyor: **PostCard (feed), UserCard, Explore, Profile, Connections, NearbyScreen**. Disk cache, memory policy, recycling ve placeholder yok (24. madde) | `PostCard.tsx:3` vd. | P1 |
| 7.2 | `Feed.tsx` içinde `validPosts` ve `listData` **her render'da yeniden üretiliyor** (useMemo yok) -> `FlatList` `data` prop identity'si her socket bildiriminde, her menü açılışında değişiyor (9. madde: unstable props) | `pages/Feed.tsx:173-186` | P1 |
| 7.3 | `ListHeaderComponent` inline JSX — her render'da yeni element | `pages/Feed.tsx:283` | P2 |
| 7.4 | Startup'ta `fetchUser` + `fetchStories` + `fetchUnreadCount` + feed paralel başlıyor; `getStories` varsayılanı 100 hikâye (25. madde) | `pages/Feed.tsx:117-127` | P2 |
| 7.5 | `api/client.ts`'te request deduplication ve `AbortController` yok (27. madde) | `api/client.ts` | P2 |

**Doğru olanlar:** `PostCard` ve `StoriesBar` `memo`'lu, `renderItem`
`useCallback`'li, FlatList `windowSize=5 / maxToRenderPerBatch=4 /
initialNumToRender=3 / removeClippedSubviews` ile ayarlı,
`react-native-pager-view` tek dosyaya hapsedilmiş.

---

## 8. Medya darboğazları

| # | Bulgu | Kanıt | Öncelik |
| --- | --- | --- | --- |
| 8.1 | **Post görselleri genişlik sınırı olmadan servis ediliyor.** ImageKit dönüşümü yalnızca `quality:auto` + `format:webp`; `width` yok. 4000×3000 bir fotoğraf 400 px'lik feed kartına tam çözünürlükte iniyor (17. madde açık ihlali) | `mediaUploadService.ts:27`, `postController.ts:90` | P1 |
| 8.2 | `post_media.width` / `height` / `file_size` her zaman `null` yazılıyor -> istemci aspect ratio'yu bilemiyor, CLS engellenemiyor (19. madde) | `postService.ts:54` | P2 |
| 8.3 | Post ve story için üst sınır 100 MB. Mobil upload, yavaş şebeke ve CDN transfer maliyeti açısından değerlendirilmeli (46. madde) | `mediaUploadService.ts:16-18` | P2 |

**Doğru olanlar:** presigned PUT ile doğrudan S3, API medya proxy'si değil;
magic-byte imza doğrulaması; upload reservation ownership kontrolü; durable
media deletion job.

---

## 9. Güvenlik riskleri

Bu denetimde **istismar edilebilir bir privacy/cache sızıntısı bulunamadı.**
Doğrulananlar:

- Feed cache key'i izleyicinin `userId`'sini içeriyor -> başkasının private
  içeriği cache üzerinden sızmıyor.
- Profil cache key'i `(profileId, requesterId)` çifti -> aynı şekilde güvenli.
  (Bellek maliyeti ayrı bir konu, bkz. 4.3.)
- `canAccessPost` hem hesap kapısını hem post görünürlük kapısını uyguluyor.
- `viewStory` ve `getStoryViewers` sunucu tarafında yeniden yetki kontrolü yapıyor.
- Profil konumu etiketi serbest metinden değil, dataset kaydından üretiliyor.
- Yakındakiler yalnızca kilometre bandı döndürüyor.
- Refresh token hash'li, rotate ediliyor, HttpOnly cookie + CSRF header + Origin
  allowlist ile korunuyor.
- Production'da `rediss://`, parolalı Redis, en az 32 byte JWT secret zorunlu.

Açık kalan riskler (yeni değil, mevcut teknik borç):

| # | Risk | Öncelik |
| --- | --- | --- |
| 9.1 | Pool'da `statement_timeout` yok -> yavaş sorgu tabanlı kaynak tüketimi (DoS yüzeyi) | P1 |
| 9.2 | Engelleme (block) özelliği yok; ileride eklenirse feed/nearby/mesaj sorgularına `NOT EXISTS (user_blocks…)` eklenmeli | P2 |
| 9.3 | Sideload APK checked-in debug keystore ile imzalanıyor | P2 |
| 9.4 | 7 günden eski GPS fix satırları için zamanlanmış purge yok | P2 |

---

## 10. Dead code

| Sembol | Dosya | Durum |
| --- | --- | --- |
| `withRelationshipCounts` | `services/userService.ts:23` | `<T>(user: T): T => user` — kimlik fonksiyonu, iki yerde no-op `map` olarak çağrılıyor |
| `userExists` | `services/userService.ts:45` | Hiçbir yerden çağrılmıyor |
| `checkRecentConnectionRequests` | `services/userService.ts:114` | Hiçbir yerden çağrılmıyor |
| `cursorFilter` | `utils/pagination.ts:38` | MongoDB `$or/$lt` şeklinde kalıntı; yalnız kendi testi kullanıyor |
| `getUserForProfileUpdate` | `services/userService.ts:44` | `getUserByIdWithPassword` için gereksiz alias |
| `users_search_idx` | `db/migrations/001:66` | GIN tsvector indeksi, hiçbir sorgu kullanmıyor |

Mobil `package.json`'daki `fbjs`, `styleq`, `invariant`, `merge-options`,
`html-parse-stringify`, `use-latest-callback`, `use-sync-external-store`,
`socket.io-parser`, `color`, `@callstack/react-theme-provider` doğrudan hiçbir
kaynak dosyadan import edilmiyor. **Ancak** bunlar büyük olasılıkla pnpm'in katı
`node_modules` yapısı altında Metro çözümlemesi için bilinçli olarak eklenmiştir.
Metro cold start bu makinede yaklaşık 9,5 dakika olduğundan, bunları körü körüne
kaldırmak yüksek riskli / düşük getirili bir iştir: **rapora yazıldı, bu turda
kaldırılmadı.** Kaldırma ancak temiz bir `pnpm install` + Android ve iOS bundle
doğrulamasıyla yapılmalıdır.

---

## 11. Duplicate code

- Cursor kodlaması **8 ayrı yerde elle** yazılmış:
  `Buffer.from(JSON.stringify({ date, id })).toString("base64url")` —
  `userService.ts` (3x), `messageService.ts` (3x), `storyService.ts` (1x),
  `notificationService.ts` (1x), `postService.ts` (`encodeCursor`).
  `utils/pagination.ts` içindeki `createCursor` zaten var ama kullanılmıyor.
- Keyset `WHERE` bloğu (`created_at < ? OR (created_at = ? AND id < ?)`) 9 serviste
  tekrar ediyor.
- `publicUser(...)` map'ine dönüştürme kalıbı 5 serviste kopyalanmış.
- ImageKit URL üretimi hem `mediaUploadService.transformedUrl` içinde hem
  `postController` / `storyController` / `messageController` / `userController`
  içinde ayrı ayrı yazılmış.

---

## 12. Unused dependencies

Bkz. 10. bölüm. Web tarafında `moment` **kullanılıyor** ama gereksiz: aynı işi
mobile'da `dayjs` yapıyor; kaldırılması 60 KB kazandırır ve iki istemciyi tek
tarih kütüphanesinde birleştirir.

---

## 13. Eksik index'ler

| Öneri | Neden |
| --- | --- |
| `users` üzerinde `gin (full_name gin_trgm_ops)` + `gin (username gin_trgm_ops)` | 2.5'teki `ilike '%…%'` seq scan'ini indeksli hale getirir. `pg_trgm` zaten `006`'da kurulu. |
| `posts (user_id, created_at DESC, id DESC)` | Mevcut `posts_user_cursor_idx` `visibility`'yi ikinci kolonda tutuyor; following feed'in "kendi postlarım" dalı ve profil sayfası bu sırayı doğrudan kullanabilsin diye |

## 14. Eksik cache

- Feed cache **kullanıcı bazlı sürüm anahtarı** kullanmıyor (bkz. 15).
- Story view dedupe cache'i yok (2.3).
- Egzersiz kataloğunun **paylaşılan** varyantı cache'lenmiyor (4.4).

## 15. Bad cache

- 4.1 – 4.5'in tamamı.
- Kök neden ortak: **cache invalidation'ı silme (SCAN+DEL) ile yapmak.**
  Doğru yaklaşım: **versiyonlanmış anahtar** — `INCR` ile O(1) geçersizleştirme,
  eski anahtarlar kendi TTL'leriyle düşer.

## 16. N+1 sorgular

Klasik anlamda N+1 **bulunamadı**; hydration katmanları batch çalışıyor. Bunun
yerine "sabit ama gereksiz" sorgu maliyeti var: 2.3 (story view başına 6),
2.6 (mesaj başına 3-5), 2.7 (like başına 3).

## 17. Memory leak riskleri

- Web `App.tsx` `socket.on/off` cleanup'ı doğru yapıyor.
- `configs/redis.ts` `retryTimer` `unref()` edilmiş ve `announceReady`'de
  temizleniyor. Doğru.
- `redis.ts` içindeki `localLimits` Map'i **hiç budanmıyor**: Redis yokken her
  rate-limit anahtarı süresiz bellekte kalır. Redis'siz uzun süre çalışan bir
  instance'ta sızıntı. **P2.**
- `socketRegistry.userSockets` `leaveLocalUser` ile temizleniyor. Doğru.

## 18. Concurrency riskleri

- Like/comment/follower/connection sayaçları atomik `expression("x","+",1)` ile
  güncelleniyor — read-modify-write yok. **Doğru.**
- Kota rezervasyonu `UPDATE ... WHERE count < limit` ile atomik. **Doğru.**
- `post_likes` composite unique key duplicate like'ı engelliyor. **Doğru.**
- Risk: 3.4'teki `FOR UPDATE` popüler postta serileştirme yaratıyor.

## 19. Ölçeklenme riskleri

1. **İlk çöken yer: Redis** (2.1 — her write full keyspace scan).
2. **İkinci: PostgreSQL** (2.2 — stampede sonrası feed sorgu fırtınası).
3. **Üçüncü: CDN/bandwidth** (8.1 — sınırsız çözünürlükte feed görselleri).
4. Dördüncü: instance başına 30 bağlantılık pool × N instance (35. madde).

## 20. Production riskleri

- `statement_timeout` yok (9.1).
- API yanıtı sıkıştırılmıyor (2.8).
- p50/p95/p99, cache hit rate, event loop lag ölçümü yok (59. madde).
- Slow query eşiği/raporu yok (60. madde).

---

## 21. Önerilen değişiklikler

### Faz 1 — Redis ve cache doğruluğu (P0)
1. `invalidateCachePrefix` (SCAN) yerine **versiyonlanmış cache anahtarı**:
   `bumpCacheVersion(namespace)` = `INCR`, O(1).
2. Feed invalidation'ını **global**'den **yazarın kendi feed'i**ne daralt.
   Takipçiler zaten 30 sn TTL ile tazeleniyor.
3. Feed cache miss'ine **single-flight** ekle.

### Faz 2 — Sıcak yol sorgu maliyeti (P1)
4. Story view: Redis dedupe anahtarı -> tekrar açılışlarda 6 sorgu -> **0 sorgu**.
5. Socket `send_message`: `socket.data.user` ve izin cache'ini yeniden kullan.
6. Bildirim yayınını HTTP yanıt yolundan çıkar (fire-and-forget).
7. Like sayacını `returning` ile tek sorguda oku; `FOR UPDATE`'i kaldır.
8. Feed yorum önizlemesini 20'den 3'e indir.

### Faz 3 — Veritabanı (P1)
9. `pg_trgm` GIN indeksleri + `searchUsers`'ı indeksli hale getir.
10. Kullanılmayan `users_search_idx`'i düşür.
11. Pool'a `statement_timeout` + `query_timeout` ekle.

### Faz 4 — Medya (P1)
12. Paylaşılan bir `mediaVariant()` yardımcısı (`@motionmeet/shared`) ile
    ImageKit URL'ine ekran boyutuna uygun `tr=w-…` uygula. Contract kırılmaz.

### Faz 5 — Web (P1/P2)
13. `moment` -> `dayjs`.
14. `socket.io-client`'ı lazy yükle (landing'de indirilmesin).
15. `PostCard`'ı `memo`'la.
16. `usePolling`'i kapat.

### Faz 6 — Mobile (P1)
17. Ağır listelerde `expo-image`.
18. `Feed.tsx`'te `listData` / `validPosts` için `useMemo`, header için sabit
    referans.

### Faz 7 — Temizlik ve gözlemlenebilirlik (P2/P3)
19. Dead code (10. bölüm).
20. Cursor kodlamasını `createCursor` üzerinde birleştir.
21. `compression` middleware.
22. `localLimits` budaması.
23. Slow query eşiği + cache hit/miss metrikleri.

---

## 22. Öncelik sırası

| Öncelik | Maddeler |
| --- | --- |
| **P0** | 2.1, 2.2, 4.1, 4.5 |
| **P1** | 2.3, 2.4, 2.5, 2.6, 2.7, 3.1–3.4, 4.2–4.4, 6.1–6.3, 7.1, 7.2, 8.1, 9.1, 13 |
| **P2** | 2.8, 3.5–3.9, 6.4–6.8, 7.3–7.5, 8.2, 8.3, 9.2–9.4, 17 (`localLimits`), 20 |
| **P3** | 4.6, 10, 11 |

---

# EK: Uygulanan değişiklikler ve ölçülen sonuçlar

> Bu bölüm denetimden sonra yapılan işi kaydeder. Her madde
> `PROBLEM -> ROOT CAUSE -> CHANGE -> RESULT` biçimindedir (140. madde).
> Ölçülmemiş hiçbir iyileştirme "iyileştirme" olarak yazılmamıştır.

## Doğrulama durumu

| Kontrol | Sonuç |
| --- | --- |
| `pnpm typecheck` | 5/5 paket başarılı |
| `pnpm lint` | 4/4 paket başarılı |
| `pnpm test` | 5/5 paket başarılı |
| Backend testleri | 51 → **55** (4 yeni concurrency testi), 0 hata |
| Shared testleri | 4 → **11** (7 yeni medya testi), 0 hata |
| Migration `009` | Gerçek PostgreSQL'e uygulandı, `EXPLAIN (ANALYZE, BUFFERS)` ile doğrulandı |
| Web bundle bütçesi | Sıkılaştırıldı, geçiyor |

---

## A1 [P0] Her write'ın tüm Redis keyspace'ini taraması

**PROBLEM.** `invalidateCachePrefix` dokuz sıcak write yolundan çağrılıyordu ve
her çağrı `SCAN ... MATCH` ile keyspace'in tamamını geziyordu. Üstelik tek bir
like, sistemdeki **bütün** kullanıcıların feed cache'ini siliyordu.

**ROOT CAUSE.** Cache invalidation'ının *silme* ile yapılması. Redis'te `MATCH`
bir indeks değildir; filtre taramadan sonra uygulanır.

**CHANGE.**

- `configs/redis.ts`: prefix SCAN kaldırıldı. Yerine **owner-addressed hash**
  cache geldi — `getCachedField` / `setCachedField` / `invalidateCacheOwners`.
  Bir kullanıcının bütün feed sayfaları tek bir hash'in field'ları; geçersiz
  kılmak **tek `DEL`**.
- Yeni `services/feedCache.ts`: invalidation politikasının tek sahibi.
  Politika artık **"bir write yalnızca onu yapan kişinin cache'ini düşürür"**.
  Takipçiler zaten 30 sn TTL ile tazeleniyor; yazar snapshot'ları ayrıca
  `user.profile.updated` outbox event'iyle yenileniyor.
- `setCachedField` bir owner'ın field sayısını sınırlar (`maxFields`), böylece
  cursor çeşitliliği TTL'den hızlı büyüyemez.

**RESULT.** Like / comment / post / follow / profil güncelleme başına Redis işi:
**O(keyspace) tarama → O(1) tek `DEL`**. Bir like artık yalnızca like'ı yapan
kişinin feed cache'ini düşürüyor; diğer kullanıcıların cache'i ayakta kalıyor,
dolayısıyla like storm'u artık PostgreSQL'e feed sorgu fırtınası göndermiyor.

## A2 [P0] Cache stampede

**PROBLEM.** Feed cache miss'inde tek uçuş yoktu: aynı anda N istek aynı
sorguyu PostgreSQL'e gönderiyordu.

**ROOT CAUSE.** `getFeedPostsForUser` cache miss'te doğrudan sorguya iniyordu.

**CHANGE.** Yeni `utils/singleFlight.ts`; `getFeedPostsForUser` miss'i
single-flight ile sarmalıyor ve kilidi aldıktan sonra cache'i **bir kez daha**
okuyor. Dağıtık lock bilinçli olarak kullanılmadı: her miss'e bir Redis
round-trip eklerdi ve N instance ile fan-in zaten "istek başına bir sorgu"dan
"instance başına bir sorgu"ya iniyor (12. madde).

**RESULT.** 1.000 eşzamanlı okuyucu → **1 PostgreSQL sorgusu**.
`tests/singleFlight.test.ts` ile kanıtlandı (1.000 çağrı, `runs === 1`;
farklı key'ler birbirini bloklamıyor; hata her bekleyene yansıyor ve key'i
zehirlemiyor).

## A3 [P1] Kullanıcı araması full table scan

**PROBLEM.** `full_name ilike '%term%'` hiçbir indeksi kullanamıyordu; `users`
üzerindeki `users_search_idx` (GIN tsvector) hiçbir sorgu tarafından
kullanılmıyor, sadece yazma maliyeti üretiyordu.

**CHANGE.**

- Migration `009_user_search_indexes`: `users_search_idx` düşürüldü. Yerine
  eşleşme biçimine göre iki indeks:
  `users_username_prefix_idx` = B-tree `(lower(username::text) text_pattern_ops)`
  (prefix), `users_full_name_trgm_idx` = GIN `gin_trgm_ops` (substring).
  İkisi de `WHERE privacy_show_in_search` ile partial.
- `searchUsers` tam olarak bu ifadelere göre yeniden yazıldı ve arama terimi
  artık `escapeLikePattern` ile kaçırılıyor (önceden `%` araması bütün tabloyu
  eşleştirebiliyordu).

**RESULT.** 200.000 kullanıcı üzerinde `EXPLAIN (ANALYZE, BUFFERS)` ile ölçüldü:

| Sorgu | Önce | Sonra | Kazanç |
| --- | --- | --- | --- |
| `full_name` substring | Parallel Seq Scan — **128.2 ms**, 5.258 buffer | Bitmap Heap Scan (GIN trgm) — **5.25 ms**, 360 buffer | **24×** hız, 15× daha az buffer |
| `username` prefix | Seq Scan — **168.7 ms**, 5.258 buffer | Index Scan (B-tree) — **0.051 ms**, 5 buffer | **3.300×** hız, 1.050× daha az buffer |

> Not: İlk denemede username için de trigram indeksi kurulmuştu; ölçüm
> planlayıcının onu seçmediğini gösterdi (`LIMIT 20` bir seq scan'i ucuz
> gösteriyor). Bu yüzden prefix için repository'nin 006'da zaten kullandığı
> `text_pattern_ops` B-tree deseni tercih edildi. **Ölçüm olmadan ilk tasarım
> yanlış kalacaktı.**

## A4 [P1] Story görüntüleme başına 6 sorgu

**PROBLEM.** Tekrar açılan her hikâye 6 sorgu harcıyordu; 20 hikâyelik bir rayı
iki kez gezmek 240 sorgu demekti.

**CHANGE.** `storyService.storyViewAlreadyRecorded` + `recordStoryView` içinde
`markDone` (Redis, 6 saat TTL). Makbuz **yalnızca satır kalıcı olduktan sonra**
yazılıyor, böylece başarısız bir yetkilendirme veya insert sonraki denemeyi
bastırmıyor. `recordStoryView` artık story satırını yeniden okumuyor; yazar id'si
zaten yüklenmiş kayıttan geçiliyor.

**RESULT.** İlk görüntüleme 6 → **5 sorgu**. Tekrar görüntüleme
6 → **0 sorgu**. Bir hikâye/izleyici çifti için üst sınır 24 saatte 4 açılış.

## A5 [P1] Socket mesajı başına 3-5 sorgu

**PROBLEM.** Her `send_message` olayı gönderen kullanıcıyı planıyla DB'den
yeniden yüklüyor, ardından mesaj iznini yeniden hesaplıyordu — oysa
`socket.data.user` handshake'te yüklenmiş ve typing yolunda 30 saniyelik bir
izin cache'i zaten vardı.

**CHANGE.** `mayMessage()` her iki yolun (mesaj + typing) ortak kapısı oldu.
Gönderen kaydı 5 dakikada bir tazeleniyor; tazelenince izin cache'i
temizleniyor, böylece bir plan değişikliği uzun ömürlü sokete de ulaşıyor.

**RESULT.** Bir sohbet serisinde mesaj başına **3-5 sorgu → 0**.

## A6 [P1] Like/comment yanıtını bekleten bildirim yayını

**PROBLEM.** Her like ve comment, HTTP yanıtından önce `hydrate` + unread
`COUNT` (3 sorgu) çalıştırıyordu — alıcının açık soketi olmasa bile.

**CHANGE.** Bildirim satırının yazılması await ediliyor (kalıcılık), yayını
`void` ile yanıt yolundan çıkarıldı.

**RESULT.** Like ve comment yanıt yolundan **3 sorgu** çıktı. Bildirimin
kalıcılığı değişmedi.

## A7 [P1] Popüler postta like'ların serileşmesi

**PROBLEM.** `togglePostLike` / `likePost` / `createPostComment` post satırında
`SELECT ... FOR UPDATE` alıyordu; bir gönderiye gelen bütün like'lar sıraya
giriyordu. Ayrıca sayaç `UPDATE`'ten sonra ayrı bir `SELECT` ile okunuyordu.

**CHANGE.** `FOR UPDATE` kaldırıldı — duplicate'i zaten `post_likes` composite
primary key engelliyor, sayaç ise atomik delta. Yeni `applyLikeCount`, delta'yı
uygulayıp sonucu `returning` ile aynı statement'ta okuyor.

**RESULT.** Satır kilidi kalktı, like başına bir sorgu azaldı. Mevcut 20
eşzamanlı like'lık integration testi hâlâ geçiyor (sayaç doğruluğu korundu).

## A8 [P1] Feed response'unda post başına 20 yorum

**PROBLEM.** 30 postluk bir feed sayfası 600 yorum satırı + yazarlarını
taşıyordu; kart 3 yorum gösteriyor.

**CHANGE.** `COMMENT_PREVIEW_LIMIT` 20 → 3. Her iki istemci de
`comment_next_cursor` + `GET /api/post/:postId/comments` ile derinini zaten
sayfalıyor; API contract'ı değişmedi.

**RESULT.** Feed payload'ında taşınan yorum satırı **600 → 90** (%85 azalma).

## A9 [P1] Sınırsız çözünürlükte feed görselleri

**PROBLEM.** ImageKit dönüşümü yalnızca `q-auto,f-webp` istiyordu; genişlik
sınırı yoktu. 4000×3000 bir fotoğraf 400 px'lik feed kartına tam çözünürlükte
iniyordu.

**CHANGE.** `@motionmeet/shared` içine `mediaVariantUrl()` ve `mediaSrcSet()`.
Genişlik, saklanan URL'in mevcut `tr` parametresine **eklenir** (q-auto/f-webp
korunur), video hiç dokunulmaz, ImageKit olmayan URL aynen döner, backend'in
zaten seçtiği bir genişlik varsa değiştirilmez. Contract kırılmadı — istemciler
sunucudan gelen aynı URL'i yeniden yazıyor.

Bağlandığı yerler: mobil `PostCard` (feed + avatar + yorum avatarı + egzersiz
thumbnail), `Explore` ızgarası, `UserCard`, `Connections`, `NearbyScreen`,
`Profile`; web `PostCard` (`srcSet` + `sizes` ile).

**RESULT.** Feed kartı 720 px, ızgara/thumbnail 320 px, avatar 128 px, detay
1440 px istiyor. 7 yeni test (`packages/shared/tests/media.test.ts`) davranışı
kilitliyor.

## A10 [P1] Mobil: RN `Image` ve kararsız `FlatList` prop'u

**CHANGE.**

- Feed, Explore, UserCard, Connections, Nearby ve Profile React Native'in
  `Image`'ından **`expo-image`**'a taşındı: `contentFit`,
  `cachePolicy="memory-disk"`, `recyclingKey` ve geçiş placeholder'ı. Yeni
  bağımlılık **eklenmedi** — `expo-image` zaten projede vardı ve 12 dosyada
  kullanılıyordu.
- `Feed.tsx`'te `listData`/`validPosts` `useMemo` altına alındı.

**RESULT.** Feed görselleri artık disk cache'inden geliyor ve hücre geri
dönüşünde yeniden indirilmiyor. `FlatList`'in `data` prop identity'si artık
yalnızca `posts` değiştiğinde değişiyor — socket'ten gelen her bildirimde,
her menü açılışında ve her pull-to-refresh'te değil.

## A11 [P1] Web: initial bundle ve feed route'u

**CHANGE.**

- `socket.io-client` dinamik import'a alındı; `vite.config.ts`'te axios ile
  aynı manuel chunk'tan çıkarıldı (manuel chunk tek parça olarak yayınlandığı
  için, aksi hâlde dinamik import işe yaramazdı).
- `moment` → `dayjs` (8 dosya, yeni ortak `src/utils/dayjs.ts`). `moment`
  bağımlılıktan kaldırıldı.
- `PostCard` `memo`'landı.
- Vite dev `usePolling` varsayılan olarak kapatıldı, `VITE_WATCH_POLLING=true`
  ile açılabilir.

**RESULT** (gerçek production build):

| Ölçüm | Önce | Sonra | Kazanç |
| --- | ---: | ---: | ---: |
| Initial JS (raw) | 874.45 KB | **832.76 KB** | −41.7 KB |
| Initial JS (gzip) | 275.74 KB | **263.06 KB** | −12.7 KB |
| **Feed route** (Feed + PostCard + tarih kütüphanesi, raw) | 108.91 KB | **61.26 KB** | **−47.7 KB / −%44** |
| **Feed route** (gzip) | 34.86 KB | **20.89 KB** | **−13.97 KB / −%40** |
| **Messages route** (raw) | 80.57 KB | **17.81 KB** | **−62.8 KB / −%78** |
| Messages route (gzip) | 26.17 KB | **5.87 KB** | −%78 |
| Initial CSS (gzip) | 3.53 KB | 3.53 KB | değişmedi |

`performance-budget.json` bu kazancın geri harcanamaması için sıkılaştırıldı
(initial JS gzip tavanı 270 KB → **262 KB**; largest chunk 200 KB → **190 KB**;
CSS 80 KB → **20 KB**). `pnpm --filter @motionmeet/web test` bunu zorluyor.

## A12 [P1] Pool'da statement timeout yok

**CHANGE.** `statement_timeout` + `query_timeout` (varsayılan 15 sn,
`DATABASE_STATEMENT_TIMEOUT_MS` ile ayarlanır) ve `keepAlive: true` eklendi.
Migration ve dataset import'u bu tavanın altında kalamayacağı için yeni
`createMaintenanceDatabase()` ile ayrı, tavansız, tek bağlantılı bir havuz
kullanıyor; `migrateToLatest` buna taşındı.

**RESULT.** Kaçak bir sorgu artık bir pool slotunu süresiz tutamıyor.
Doğrulandı: bu denetimin 200.000 satırlık benchmark insert'i istek havuzunda
15 saniyede kesildi, bakım havuzunda sorunsuz çalıştı.

## A13 [P1] Profil ve egzersiz cache'inin bellek profili

**CHANGE.**

- Profil cache'i `profile:{profileId}` owner hash'i altında, field
  `{viewerId}:{cursor}:{limit}`. İzleyici **field'da kalmaya devam ediyor** —
  bir profilin gösterdiği şey ilişkiye göre değişir, izleyicileri tek girdide
  birleştirmek gizlilik hatası olurdu. Kazanç, bir profilin bütün izleyici
  kopyalarının tek `DEL` ile düşmesi.
- Egzersiz kataloğu: custom egzersizi olmayan (yani neredeyse herkes) tek bir
  **paylaşılan** owner altında. Hangisinin geçerli olduğu, yalnızca o üye custom
  egzersiz yazdığında tazelenen cache'lenmiş bir boolean.

**RESULT.** 1.325 satırlık ortak katalog Redis'te kullanıcı sayısı kadar değil,
**bir kez** duruyor.

## A14 [P2] nginx: API yanıtları hiç sıkıştırılmıyordu

**PROBLEM.** `gzip on` vardı ama `gzip_proxied` tanımsızdı. nginx'in varsayılanı
proxy'lenmiş yanıtları sıkıştırmamaktır — yani `/api/` altındaki **bütün** JSON
trafiği (feed, mesajlar, keşfet: sıkışabilirliği en yüksek içerik) ham gidiyordu.

**CHANGE.** `gzip_proxied any`, `gzip_min_length 1024` (framing'in kazançtan
pahalı olduğu eşiğin altını sıkıştırma), `gzip_comp_level 5`, `gzip_vary on`.
Express'e `compression` bağımlılığı **eklenmedi** — sorun zaten proxy
katmanındaydı.

**CHANGE (ayrıca).** `/assets/` için
`Cache-Control: public, max-age=31536000, immutable`. Bu, `location` bloğuna
`add_header` koyarak değil, dosyanın kendi `map` desenini genişleterek yapıldı:
nginx'te bir location'daki `add_header`, server seviyesinden miras alınan
**bütün** `add_header`'ları düşürür ve CSP dâhil güvenlik başlıkları sessizce
kaybolurdu.

## A15 [P2] `localLimits` bellek sızıntısı

**CHANGE.** Redis yokken kullanılan fallback rate-limit map'i, 1.000 girdiyi
aşınca süresi dolmuş girdileri süpürüyor.

## A16 [P2] Mesaj geçmişinde scroll başına write

**CHANGE.** `getChatMessagesList` `markMessagesSeen`'i yalnızca ilk sayfada
(cursor yokken) çalıştırıyor. Geçmişe scroll artık write üretmiyor.

## A17 [P3] Dead code

Referansları repository genelinde arandıktan sonra kaldırıldı:

| Kaldırılan | Yer | Neden |
| --- | --- | --- |
| `withRelationshipCounts` | `services/userService.ts` | `<T>(user: T): T => user` — kimlik fonksiyonu; iki `map` çağrısı no-op'tu |
| `userExists` | `services/userService.ts` | Çağıran yok |
| `checkRecentConnectionRequests` | `services/userService.ts` | Çağıran yok |
| `getUserForProfileUpdate` | `services/userService.ts` | `getUserByIdWithPassword` için gereksiz alias |
| `cursorFilter` | `utils/pagination.ts` | MongoDB `$or/$lt` kalıntısı; yalnız kendi testi kullanıyordu |
| `pageFromDocuments` | `utils/pagination.ts` | Production'da çağıran yok |
| `inspectUnsafeDuplicates`, `inspectUnsafeRelations`, `reconcileDerivedCounts`, `createApplicationIndexes`, `verifyIndexContract`, `applyIntegrityMigration`, `REQUIRED_INTEGRITY_MIGRATION` | `services/databaseMigrationService.ts` | MongoDB dönemi uyumluluk stub'ları; hepsi sabit dönüyordu, hiçbirini kimse çağırmıyordu |
| `users_search_idx` | migration `009` | Kullanılamaz GIN tsvector indeksi |
| `moment` | `packages/web` | `dayjs` ile değiştirildi |

Ayrıca `assertDatabaseContract` artık boot'ta gereksiz bir
`select count(*) from kysely_migration` sorgusu çalıştırmıyor, ve
`escapeLikePattern` konuma özgü `utils/locationText.ts`'ten genel
`utils/validation.ts`'e taşındı (artık iki farklı alan kullanıyor).

---

## Kasten yapılmayanlar

Bunlar bilinçli kararlardır, unutulmuş işler değil:

1. **Mobil `package.json`'daki kullanılmayan paketler** (`fbjs`, `styleq`,
   `invariant`, `merge-options`, `html-parse-stringify`, `use-latest-callback`,
   `use-sync-external-store`, `socket.io-parser`, `color`,
   `@callstack/react-theme-provider`). Doğrudan import edilmiyorlar ama büyük
   olasılıkla pnpm'in katı `node_modules` yapısı altında Metro çözümlemesi için
   eklenmişler. Bu makinede Metro cold start ~9,5 dakika; körü körüne kaldırmak
   yüksek risk / düşük getiri. Temiz bir `pnpm install` + Android ve iOS bundle
   doğrulaması gerektirir.
2. **Feed'in web'de sanallaştırılması.** "Load more" sayfalaması listeyi zaten
   sınırlıyor; sanallaştırma yeni bir bağımlılık ve kayda değer bir yeniden yazım
   demek. Önce ölçülmeli (6. madde).
3. **`recharts`'ın `Profile.tsx`/`Exercises.tsx`'te lazy'e alınması.** Zaten ayrı
   bir chunk; initial bundle'da değil. Kazanç yalnızca profil açılışında ve
   ölçülmeden yapılmamalı.
4. **`post_media.width/height` doldurulması** (CLS için). İstemci tarafında
   upload sırasında boyut yakalama gerektiriyor; ayrı ve daha büyük bir iş.
5. **100 MB upload limiti.** Ürün gereksinimini bozmamak için dokunulmadı
   (46. madde); rapora risk olarak yazıldı.
6. **Story `getStories` varsayılan limiti 100.** İstemci contract'ını
   etkiliyor; ayrıca ele alınmalı.

## Kalan öncelikli işler

| Öncelik | İş | Rapor maddesi |
| --- | --- | --- |
| P1 | Gözlemlenebilirlik: p50/p95/p99, cache hit/miss, event loop lag, slow query eşiği | 20 |
| P2 | Web feed sanallaştırma + `recharts` lazy | 6.5, 6.6 |
| P2 | `post_media` boyut metadata'sı ve CLS | 8.2 |
| P2 | Mobil `api/client.ts` request dedup + `AbortController` | 7.5 |
| P2 | GPS fix retention purge job | 9.4 |
| P2 | Story `getStories` sayfa boyutu | 3.9 |
| P3 | Cursor kodlamasını `createCursor` üzerinde birleştirme (8 kopya) | 11 |
| P3 | Redis namespace birleştirme | 4.6 |
