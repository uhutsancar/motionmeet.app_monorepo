# Mobil responsive ve geri bildirim denetimi

Bu belge, fiziksel Android cihaz görüntülerinde görülen sorunların kök nedenlerini,
uygulanan ortak kuralları ve regresyon kontrol matrisini kaydeder.

## Tespit edilen kök nedenler

1. Form ekranları üç farklı klavye davranışı kullanıyordu. Bazı ekranlarda Android
   için davranış hiç tanımlanmamıştı. Uzun formlarda odaklanan alan için ek kaydırma
   alanı da bulunmuyordu.
2. Tam ekran içerik oluşturma akışları `pageSheet`, Paper `Portal` modalı ve native
   modal arasında dağılmıştı. Bu yüzden bazı Android pencere/nav-bar
   kombinasyonlarında alttaki sekmeler ve önceki ekran görünür kalabiliyordu.
3. Grid kararları kullanılabilir içerik genişliği yerine doğrudan cihaz genişliği
   ve yüzde tabanlı kart genişlikleriyle veriliyordu. Yüzdeler ile sabit `gap`
   toplamı bazı yoğunluklarda bir satıra sığmayıp yarım genişlikte tek kart
   bırakabiliyordu.
4. Beklenen API hataları `console.error` ile yazıldığı için geliştirme yapısında
   LogBox kullanıcı arayüzünün üzerine açılıyordu. Başarı için native alert,
   hata için ham backend JSON'u ve bazı yerlerde toast aynı anda gösterilebiliyordu.
5. Antrenman özeti ekranı, seçilen görselin gerçek türü ne olursa olsun yüklemeyi
   `image/jpeg` olarak etiketliyordu. Sunucunun dosya imzası doğrulaması bu doğru
   olmayan MIME etiketi nedeniyle yüklemeyi reddediyordu.

## Uygulanan ortak kurallar

- Android pencere klavye modu `resize` olarak ayarlandı.
- Uzun formlar `KeyboardAwareScrollView` kullanır. Klavye yüksekliği kadar ek
  kaydırma alanı açılır ve odaklanan native input klavyenin üstüne taşınır.
- Tam ekran oluşturma akışları `FullScreenModal`; seçim ve form sheet'leri
  `BottomSheetModal` kullanır. İki yapı da safe-area, status bar, navigation bar
  ve güncel pencere yüksekliğini hesaba katar.
- Responsive kararlar `useResponsiveLayout` ile kullanılabilir içerik genişliği
  ve sistem yazı ölçeğinden üretilir. Telefonlarda riskli grid'ler tek sütuna,
  yeterli alanı olan geniş ekranlarda iki sütuna geçer.
- Başarı, bilgi ve işlem hataları global `AppToast` katmanından gösterilir.
  Silme/iptal gibi kullanıcı kararı gereken durumlarda native onay diyaloğu
  korunur.
- Medya yükleme, picker varlığını bütünüyle taşır; dosyanın ilk byte'larından
  JPEG, PNG, GIF, WebP, HEIC/HEIF, MP4, QuickTime ve WebM imzası mümkün olduğunda
  doğrulanır. Dosya adı ve MIME türü aynı gerçek türe normalize edilir.

## Ekran kapsaması

| Akış | Uygulanan kontrol |
| --- | --- |
| Giriş / kayıt | Klavye farkındalıklı form ve odak kaydırma |
| Akış yorumları | Klavye inset'i, drag ile kapatma, tab bar'ın klavyede gizlenmesi |
| Yeni gönderi | Gerçek tam ekran modal, safe-area, sabit alt aksiyonun klavye üstünde kalması |
| Hikaye oluşturma / görüntüleme | Tam ekran pencere, dinamik önizleme yüksekliği, status/nav bar kapsaması |
| Aktif antrenman | Klavye farkındalıklı liste, dar ekranda küçülen set alanları |
| Antrenman özeti | Klavye farkındalıklı açıklama, saran istatistik kartları, gerçek medya türü |
| Profil düzenleme | Klavye farkındalıklı form, dar ekranda boy/kilo alanlarının dikey yerleşimi |
| Gizlilik / hesap silme | Klavye ile yeniden ölçülen parola diyaloğu |
| Mesajlaşma | Android `height` kaçınması, safe-area, dar ekranda ölçeklenen medya balonu |
| Egzersiz / rutin modalları | Pencere yüksekliğine bağlı bottom-sheet ve odak kaydırma |
| İstatistik / aylık rapor / kas dağılımı | İçerik genişliğinden hesaplanan bir-iki sütun ve grafik genişliği |

## Regresyon matrisi

Fiziksel cihaz veya emulator kontrolünde aşağıdaki kombinasyonlar kullanılmalıdır:

- Genişlik: 280, 320, 360, 390, 412, 600 ve 768 dp.
- Kullanılabilir yükseklik: yaklaşık 480/568 dp kompakt ve 800+ dp standart.
- Yazı ölçeği: 1.0 ve en az 1.3.
- Klavye: metin, çok satırlı metin, numeric/decimal; gesture ve üç tuşlu
  navigation bar.
- Safe-area: çentik/delik kamera, düz ekran ve tablet.
- Modal: klavye kapalı/açık, donanım geri tuşu, backdrop kapatma ve yükleme
  sırasında kapatma engeli.

## Otomatik doğrulama

```text
pnpm --filter @motionmeet/mobile typecheck
pnpm --filter @motionmeet/mobile lint
pnpm --filter @motionmeet/backend test
pnpm --filter @motionmeet/mobile exec expo export --platform web
```

Bu kontroller tip/import hatalarını, lint regresyonlarını, medya imza
doğrulamasını ve Metro paketlenebilirliğini kapsar. IME yüksekliği ve üreticiye
özgü navigation bar davranışı için matrisin fiziksel Android ve iOS cihaz
kontrolleri ayrıca yapılmalıdır.
