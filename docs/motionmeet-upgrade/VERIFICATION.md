# MotionMeet yükseltme — doğrulama kaydı

Statü sözcükleri: **otomatik test geçti**, **API'de doğrulandı**, **native cihazda doğrulandı**, **doğrulanamadı**, **bloklandı**.

## Ortam (22 Ekim 2026)

- Repo HEAD `d75beb1` + çalışma ağacındaki değişiklikler (commit yok).
- Node 24.15.0, pnpm 11.10.0, Docker 29.8.2.
- Cihaz: `P13_Blue_Max`, Android 9 (API 28), 720×1560, 320 dpi, USB, ADB `device`.
- Kurulu eski sürüm: `app.motionmeet.mobile` 1.1.0 (versionCode 2), son güncelleme 2026-09-09 23:16. Telefonda MotionMeet APK dosyası yok; yalnız kurulu uygulama var.
- Kullanıcının dev DB'si (`localhost:5432/motionmeetdb`) **değiştirilmedi**: yeni backend testleri ayrı, tmpfs'li `postgres-test` (5433, `motionmeet_fresh`) üzerinde, Redis ve cron kapalı.

## Eski sürüm baseline (native cihaz, eski backend kodu, dev DB)

- Giriş ekranı açılıyor; sentetik `qa_a` hesabıyla giriş başarılı, feed yükleniyor.
- Ayarlar > Hesap altında "Planlar ve fiyatlandırma — Deneyimini yükselt" satırı var (kaldırılacak ödeme yüzeyi).
- Not: baseline sırasında dev DB'ye 4 sentetik hesap eklendi (`qa_user_a…d`, `@motionmeet.test`).

## Otomatik kontroller

| Komut | Sonuç |
| --- | --- |
| backend `tsc --noEmit` | Hatalar yalnız silinmeyi bekleyen 9 ödeme dosyasında; geri kalan kod temiz |
| web `tsc --noEmit` | Hatalar yalnız `src/pages/Pricing.tsx` (silinecek) |
| mobile `tsc --noEmit` | Hatalar yalnız `src/pages/PricingScreen.tsx` (silinecek) |
| shared `tsc` build | geçti |
| ESLint (değişen backend/web/mobil dosyaları) | geçti |
| backend `tsx --test tests/*.test.ts` (sıfırdan migrate edilmiş test DB) | **56/56 geçti** |
| backend `databaseConcurrency.integration.test.ts` | **1/1 geçti** |
| shared testleri (yeni `parseDecimalInput`, `elapsedWorkoutSeconds` testleri dahil) | **13/13 geçti** |
| Locale JSON'ları (web/mobil tr/en) | parse ediliyor |
| `pnpm install --lockfile-only` | **bloklandı** (oturum izni) — lockfile hâlâ ödeme SDK'sını içeriyor |

## Migration 012 doğrulaması (test DB, tek seferlik betik)

- 001→011 uygulandı, sonra ücretli plan + ödeme sağlayıcısı kimlikli kullanıcı, ücretsiz kullanıcı, webhook kaydı ve bir antrenman eklendi; ardından 012 uygulandı.
- Arşiv: `users: 1` (yalnız ücretli kullanıcı), `payment_webhook_events: 1`, `plans: 2` (billing cycle'larıyla).
- Kalan ödeme nesnesi: **yok** (tablo, kolon, enum tipi).
- Kullanıcılar (2) ve antrenman (1) korundu.
- Ayrıca sıfırdan 001→012 kurulum başarılı.
- `down()` bilinçli olarak tek yönlü; veri `legacy_billing_archive` tablosunda.

## API doğrulamaları (yeni backend, test DB)

| Senaryo | Sonuç |
| --- | --- |
| E25 `GET /api/plans`, `POST /api/plans/update`, `POST /api/payments/checkout-intent`, `GET /api/payments/subscription`, `POST /api/payments/portal-session`, `POST /api/payments/webhooks/*` | hepsi **410** "Plans and payments are no longer offered" |
| Backend ödeme env'siz başlıyor | `/health/ready` → ready |
| Auth yanıtı | `plan` alanı yok (`id,_id,email,username,full_name,profile_picture,bio,privacy`) |
| E36 eski ücretsiz kota | Aynı ay 7 antrenman (eski sınır 5) ve 3 rutin (eski sınır 2) → hepsi başarılı |
| DM izni plan olmadan | Takipçi olmayan → özel hesap: `needs_mutual_follow` ret; → açık hesap: gönderildi |

## Native cihaz (yeni build)

Build: `./gradlew assembleRelease` (JBR 21, 23 dk 7 sn, başarılı), bundle'da değişikliklerin dizgeleri doğrulandı (`@mm_active_workout:`, `motionmeet-card-`, `sponsored_by`, `postLikeSynced`, `media_failed` var; `PricingScreen`/`pricing_page` yok).
Kurulum: `adb install -r` → Success, aynı imza (`51ed3f60`), `lastUpdateTime 2026-10-22 22:13:48`, uygulama verisi silinmedi. Backend: yeni kod, test DB, `adb reverse tcp:4000`.

| ID | Senaryo | Sonuç |
| --- | --- | --- |
| E31 | Eski sürüm → yeni build güncelleme kurulumu | **native cihazda doğrulandı** — açılışta çökme yok; dev DB oturumu test DB'de bulunmadığı için giriş ekranına döndü (beklenen) |
| E25 | Ayarlar'da ödeme yüzeyi | **native cihazda doğrulandı** — "Planlar ve fiyatlandırma" satırı yok |
| WORK-02 | Boş tekrarla seti işaretleme | **native cihazda doğrulandı** — reddedildi, "Tekrar sayısı gir" bilgisi |
| WORK-02 | `12,5` kg × 8 | **native cihazda doğrulandı** — ekranda Hacim 100 kg; sunucuda `12.5x8`, hacim 100 |
| E12 | Antrenman sırasında küçült + `am force-stop` + yeniden aç | **native cihazda doğrulandı** — Rutinler ve Feed'de "Devam eden antrenman"; devam edince set ve süre (02:37, başlangıçtan) geri geldi |
| E14 (kısmi) | Kaydet | **native cihazda doğrulandı** — tek antrenman oluştu, kayıttan sonra taslak silindi. Yanıt kaybı + yeniden deneme senaryosu cihazda **doğrulanamadı** (ağ kesme otomasyonu yok) |
| E16 | Kart → "MotionMeet hikayem" | **native cihazda doğrulandı** — doğrudan yayın yok, story editörü kartla açıldı; yazı ekleme, klavye, "Bitti", tek parmak sürükleme çalıştı. **Bulgu:** editör önizlemesi kartı `cover` ile kırpıyordu (izleyici `contain`); düzeltildi, ikinci build'de doğrulanacak |
| STORY-01 | Editör kırpma düzeltmesi (ikinci build, 8 dk 12 sn, `lastUpdateTime 22:35:13`) | **native cihazda doğrulandı** — kart kenar boşluklarıyla ve alt marka satırıyla tam görünüyor; güncellemede oturum korundu |
| MM-07 | Önceki performans sütunu | **native cihazda doğrulandı** — ikinci antrenmanda "12.5kg x 8" görünüyor. Küçük bulgu: değer yerel biçimde değil (`12,5 kg` olmalı), açık |
| — | Uygulamaya ait FATAL/crash | logcat'te yok (yalnız `force-stop` kaynaklı normal çıkış) |
| E16 | Yayınla | **bilerek yapılmadı** — yükleme, kullanıcının yapılandırılmış gerçek S3 bucket'ına yazardı |
| STORY-03 | Pinch / rotation | **doğrulanamadı** — ADB tek parmak; çoklu dokunma aracı yok |
| ADS-02 / E32 | Feed native sponsorlu kart | **native cihazda doğrulandı** — Google test reklamı ~15. gönderiden sonra; ikon, başlık, "Sponsorlu · Google Play", medya, açıklama, CTA; beğeni/yorum yok. AdChoices ikonu ekran görüntüsünde **görülmedi** (doğrulanamadı). Reklama tıklanmadı |
| ADS-07 | UMP onayı | Uyarı: AdMob hesabında bu uygulama kimliği için onay formu tanımlı değil (`consent-update-failed`); SDK yine de başlatılıyor. Dış yapılandırma — kullanıcının AdMob panelinde form tanımlaması gerekiyor |
| ADS-05 / E34 | Explore reklam karosu | **doğrulanamadı** — test DB'de medyalı gönderi yok |
| — | Türkçe karakter + emoji gönderi (UTF-8 istemci) | API'de doğrulandı. Git Bash curl'ünün gönderdiği test metinlerindeki bozulma istemci kod sayfasından, uygulama hatası değil |

## Performans

| Ölçüm | Önce | Sonra | Not |
| --- | --- | --- | --- |
| 10 egzersiz × 5 set antrenman kaydı, insert round-trip | 60 | 2 | Kod gereği (tek `workout_exercises`, tek `workout_sets` insert) |
| Aynı kayıt, yerel API süresi (min) | 131–194 ms | 68–72 ms | Yavaş HDD, aynı makinede build/Metro çalışırken; p50/p95 aynı kodda 2 kat oynadığı için güvenilir değil |
| Kimlik doğrulamalı istek başına sorgu | `users` + `plans` + `plan_billing_cycles` | yalnız `users` | Plan join'i kalktı |

## 2. tur (23 Ekim 2026)

Ortam: kullanıcının onayıyla backend artık dev DB'de (`motionmeetdb`) çalışıyor; 012 öncesi yedek `D:\motionmeet_backups\motionmeetdb-before-012-20261022-2252.dump` (pg_dump custom, 5,2 MB). Cihazda QA APK, `adb reverse tcp:4000`, sentetik `qa_a` hesabı (`qa_user_a`) ve bu hesaba eklenmiş sentetik 12 haftalık antrenman geçmişi.

| ID | Senaryo | Sonuç |
| --- | --- | --- |
| CLEAN | `git rm` ile artık ödeme dosyaları, `pnpm install --lockfile-only` | yapıldı; lockfile'dan ödeme SDK'sı ve `react-native-chart-kit` çıktı |
| MM-02 | 012'nin dev DB'ye uygulanması | yedekten sonra uygulandı; backend açılışı temiz |
| STATS-01 | `GET /api/workout/stats?period=weeks` | **API'de doğrulandı** — 12 Pazartesi anahtarı; kas payları göğüs .167, sırt .167, bacak .417, omuz .083, kol .167 (önce bacak/kol 0) |
| STATS-01 | `GET /api/workout/stats` `muscleSets` | **API'de doğrulandı** — 7 gün: bacak 20, sırt 8, kol 4, diğerleri 0 (toplam set 32); 30 gün: bacak 80, göğüs/sırt/kol 32, omuz 16 (toplam set 192 — kas set toplamı toplam setle aynı) |
| UI-01 | Profil, İstatistikler, Aylık rapor, Gelişmiş, Ölçümler, Antrenman detayı | **native cihazda doğrulandı** — tek renk grafikler, Türkçe sayı biçimi (`10.340 kg`, `1 sa 2 dk`), ilk/son x etiketi kırpılmıyor, varsayılan seçim son aktif gün |
| KB-01 | Giriş: kullanıcı adı → "ileri" → parola → "git" | **native cihazda doğrulandı** — odak geçti, giriş 200 |
| KB-01 | Story yazı editörü ve konum sayfası klavye ile | **native cihazda doğrulandı** — stil çubuğu ve "Ekle" düğmesi klavyenin tam üstünde (önce yarısı altındaydı) |
| E16 | Story yayını: sentetik test görseli + "Bacak gunu tamam" yazısı + "Kadikoy Spor Salonu" konumu | **native cihazda doğrulandı** — `presign` 201, `create` 200; overlay'ler DB'de; izleyicide yazı ve konum etiketi doğru yerde. Görsel kullanıcının yapılandırılmış ImageKit/S3 depolamasına yüklendi (24 saatte sona eriyor). Test görseli telefondan silindi |
| MM-16 | İlk açılışta fotoğraf gelene kadar zamanlayıcı | **native cihazda doğrulandı** — ilerleme çubuğu fotoğraf gelene kadar boş kaldı, sonra 5 sn oynadı. Yükleme göstergesi eksikti (STORY-04, düzeltildi) |
| UI-02 | Profil başlığı (yeni build) | **native cihazda doğrulandı** — mor bant yok, avatar + 36/0/0 sayıları tek satırda, yumuşak gri "Profili Düzenle" |
| UI-01 | Kişisel rekorlar, Ana egzersizler, Kas yükü tablosu | **native cihazda doğrulandı** — tarih sıralı rekorlar (`92,5 kg`, `46,25 kg`), hacme göre sıralı hareketler (`17.425 kg`), tek renk tonlu kas ızgarası; 7 günde "Hiç set almayanlar: Göğüs, Omuz, Karın…" |
| UI-03 | Egzersiz listesi | **native cihazda doğrulandı** — "Air bike · Karın · Vücut ağırlığı", kartsız satırlar, yanıltıcı "50" sayacı yok |
| KB-02 | Feed'de yorum kutusuna dokunma (eski build) | **native cihazda doğrulandı (hata)** — klavye kutuyu tamamen örttü; düzeltme sonraki build'de |
| KB-02 | Yorum kutusu, ilk düzeltme (gradle8) | **native cihazda doğrulandı (kısmi)** — liste kaydı ama alan hâlâ yarı klavye altında; neden React Native'in hesabındaki başlık payı, ikinci düzeltme sonraki build'de |
| KB-02 | Yorum kutusu, ikinci düzeltme (son build) | **native cihazda doğrulandı** — kutu klavyenin tam üstünde, aradaki boşluk korunuyor; yorum gönderilmedi (başka hesabın gönderisi) |
| KB-01 | Ölçüm girişi, başlık altındaki formda alt alan | **native cihazda doğrulandı** — odaklı alan klavyenin üstünde, başlık payı fazladan kaydırmıyor |
| KB-01 | Çıkış → giriş, klavyenin kendi "ileri" ve "git" tuşlarıyla | **native cihazda doğrulandı** — odak parolaya geçti, klavye açık kaldı, form klavyenin üstüne kaydı, "git" ile giriş 200. Not: ADB ile gönderilen donanım ENTER'ı (keyevent 66) React Native'de tek satırlı alanda klavyeyi kapatır; bu test aracının davranışı, kullanıcı klavyenin tuşunu kullanır |
| UI-04 | Antrenman sekmesi | **native cihazda doğrulandı** — Hızlı başlangıç / Rutinler / Rutinlerim düzeni, tek "Yeni rutin" girişi |
| UI-05 | Aylık rapor yeni bölümleri | **native cihazda doğrulandı** — ayın rekorları (`46,25 kg × 8`, tarihli) ve hacme göre hareketler (`13.365 kg`) |
| — | Bilgisayar uykusundan sonra | `adb reverse` bağlantı yenilenince silinmişti; yeniden kuruldu. Backend ayakta kaldı |
| UI-06 | Altıgen radar (son build) | **native cihazda doğrulandı** — İstatistikler, Gelişmiş istatistikler ve Kas dağılımı ekranlarında altı köşeli radar; köşe adları ve set sayıları doğru tarafta; önceki dönem kesikli çizgi (7 günde önceki haftanın göğüs/omuz setleri görünüyor); listede önceki dönem işareti. API: `previousMuscleSets` week/month/calendar_month için dolu, `weeks` için yok |
| — | Uygulamaya ait crash | logcat'te yok |

Otomatik kontroller (2. tur sonu): shared build + 13/13 test, backend `tsc` temiz + 56/56 test (test DB), mobil `tsc` temiz, web `tsc` temiz, ESLint backend/web/mobil (tüm `src`) temiz, locale JSON'ları parse ediliyor.

Cihaz kontrolünde yapılan hata: 1. turun sonunda giriş ekranında BACK uygulamadan çıkardı, sonraki dokunmalar SnapTube'u açtı ve oraya `qa_a` / `motionmeet.test` yazılıp aratılmış olabilir. Sonrasında bütün dokunma/yazma komutları "odakta MotionMeet yoksa dur" korumasıyla çalıştırıldı.

## 3. tur (23 Ekim 2026 öğleden sonra)

Ortam: aynı cihaz, QA APK (bu turun 1. build'i 16 dk 32 sn, `adb install -r` Success, oturum korundu), backend dev DB'de 4000, sentetik `qa_a` hesabı.

| ID | Senaryo | Sonuç |
| --- | --- | --- |
| DATA-02 | Egzersizler sekmesi "Egzersiz bulunamadı" | **API'de doğrulandı** — `/api/exercise`, `/api/routine`, `/api/user/suggested`, `/api/story/get`, `/api/post/feed`, `/api/muscle-groups`, `/api/equipment`, `/api/exercise/records` QA hesabıyla 200. Neden istemcide: sekme listeyi bir kez istiyor, hata alınca boş listeyi "bulunamadı" diye gösteriyordu. Düzeltme sonrası **native cihazda doğrulandı** — katalog Türkçe etiketlerle yükleniyor |
| UI-07 | Feed: öneri kartları, gönderide takip, sıradaki antrenman satırı, başlıkta "+" | **native cihazda doğrulandı** — 150 pt dikey kart, 72 pt avatar, 30 pt takip düğmesi, × ile gizleme; gönderide mavi "Takip Et" yazısı |
| UI-08 | Profil (Instagram + Hevy) | **native cihazda doğrulandı** — kullanıcı adı başlıkta, "+" ve ☰ kenarlarda, 80 pt avatar, iki gri düğme, haftalık çubuk + Süre/Hacim/Antrenman çipleri, 2×2 kısayol, son 5 antrenman (süre + hacim) |
| UI-09 | Profili düzenle | **native cihazda doğrulandı** — etiket–değer satırları, "Kaydet" başlıkta; en alttaki Boy alanına odaklanınca alan klavyenin hemen üstünde (Gboard sayı klavyesi) |
| UI-10 | İstatistikler | **native cihazda doğrulandı** — 30 günlük 2×2 rakamlar, 16 haftalık antrenman takvimi (36 gün, 13 hafta seri), radar, raporlar listesi; profildeki çubuk grafik tekrarlanmıyor |
| UI-11 | Ayarlar | **native cihazda doğrulandı** — geri oku var (önce yoktu), cümle düzeninde bölüm başlıkları, 48 pt satırlar, "SSS ve iletişim" Türkçe |
| UI-12 | Story konum sayfası | **native cihazda doğrulandı** — tam ekran, arama alanı başlık satırında, yakındaki yerler satır olarak, yazılan "Kadikoy" ilk satırda "Bu adla ekle"; seçince etiket editörde. Story yayınlanmadı; sentetik test görseli telefondan ve medya dizininden silindi |
| DATA-03 | Egzersiz detayı istatistikleri (3. build) | **native cihazda doğrulandı** — Barbell deadlift: 125 kg rekor, 12 seans, en ağır set ilerleme çizgisi (önce 0 kg / 0 seans) |
| UI-13 | Aktif antrenman (Hevy düzeni) | **native cihazda doğrulandı** — ince başlık + küçük "Bitir", kartsız egzersiz bloğu, set alanına "62,5" yazınca alan klavyenin üstünde; test antrenmanı kaydedilmeden iptal edildi |
| UI-14 | Aylık rapor / Gelişmiş istatistikler | **native cihazda doğrulandı** — birikimli çizgi + ay takvimi + kas payı şeridi; gelişmiş istatistiklerde lolipop + "antrenman başına" ortalamalar |
| CHAT-01 | Sohbet (4. build) | **native cihazda doğrulandı** — kullanıcının 15:55'teki kısa/uzun/fotoğraflı mesajları yeni düzende: ortada saat satırı, uzun mesaj %78 genişlikte düzgün kırılıyor, fotoğraf çerçevesiz ve kendi oranında; klavye açıkken yazma alanı klavyenin hemen üstünde (önce ~48 dp boşluk); yazınca "Gönder"; sentetik QA hesabına metin ve sentetik fotoğraf gönderildi, fotoğraf yüklenince 4:3 oranına geçti; iki test mesajı uzun basmayla silindi, test görseli telefondan kaldırıldı (yüklenen nesne medya depolamasında kalabilir). Bulgu: seçicide zorunlu 4:3 kırpma ekranı vardı — kaldırıldı (5. build) |
| CHAT-02 | Son mesaj silinince sohbetin kaybolması | **API'de ve cihazda doğrulandı** — düzeltme + 013 onarımından sonra `/api/message/conversations` QA User D sohbetini döndürüyor, telefonda Mesajlar listesinde görünüyor; web sohbeti de listeliyor. Regresyon testi düzeltmesiz kodda başarısız, düzeltmeyle geçti; backend 57/57 (test DB) |
| UI-15 | Gönderi oluşturma (6. build) | **native cihazda doğrulandı** — "Paylaş" başlığın sağında, metin yazarken klavye açıkken erişilebilir; görünürlük çipleri ince; gönderi paylaşılmadan kapatıldı |
| WEB-01 | Web ekranları (Chrome headless, QA hesabı, 1440 ve 390 px) | **tarayıcıda doğrulandı** — Feed (sağ sütun 1200 px'ten itibaren, mavi "Takip Et"), Profil (Instagram web düzeni, Hevy kısayolları), İstatistikler (tek liste), Mesajlar (sohbet yeni balon düzeninde). Bulgular düzeltildi: menüde iki "Keşfet" (akış → "Ana sayfa"), "Your story", telefonda tekrarlanan sayfa başlığı |

Otomatik kontroller (3. tur sonu): mobil `tsc` + ESLint (`src`) temiz; web `tsc` + ESLint temiz; backend `tsc` + ESLint temiz, 57/57 test (test DB).
