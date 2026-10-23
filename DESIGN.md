# MotionMeet design system

Sakin, atletik ve içerik önde. Sosyal akışta medya, antrenmanda sayılar konuşur; arayüz geri çekilir.
Bu belge iki platformun (web MUI teması `packages/web/src/theme/appTheme.ts`, mobil Paper + `packages/mobile/src/context/ThemeContext.tsx`) aynı anlamı taşıması içindir. Piksel eşitliği değil, aynı rol ve aynı karar hedeflenir.

## Renk rolleri

Değerler mobil temadan alınmıştır. Web paleti aynı rolleri taşır; ana mor tonu iki platformda hâlâ farklı (web `#6558F5`/`#9187FF`, mobil `#5D50E6`/`#948AFF`) — tek değere indirilmesi açık iş.

| Rol | Açık | Koyu | Kullanım |
| --- | --- | --- | --- |
| background | `#F6F7F5` | `#090B0E` | Ekran zemini |
| surface | `#FFFFFF` | `#14171B` | Sayfadan ayrılması gereken yüzey (sheet, kart) |
| surfaceLight | `#F0F2EF` | `#1D2126` | Alan dolgusu, yüklenirken medya yeri |
| text / textSecondary / textMuted | `#121417` / `#555D68` / `#69717D` | `#F5F6F4` / `#B5BBC4` / `#929AA5` | İçerik / açıklama / metadata |
| border | `#E0E4DF` | `#292E35` | Yalnız anlamlı sınır: alan, bölüm ayrımı |
| primary / primarySoft | `#5D50E6` / `#EEECFF` | `#948AFF` / `#2A2645` | Ekranda tek birincil eylem; seçili durum |
| energy / energySoft | `#B9ED56` / `#F1F9DE` | `#C2F263` / `#2A361C` | Antrenman vurgusu, ikon zemini |
| success | `#0D9468` | `#39C08E` | Tamamlanan set (her zaman ikonla birlikte) |
| danger | `#D94249` | `#F1686E` | Silme, hata |

Kurallar: bir ekranda en fazla bir birincil eylem rengi; yeşil yalnız "tamamlandı", kırmızı yalnız hata/silme; durum hiçbir zaman yalnız renkle anlatılmaz. Koyu tema renklerin tersi değil, ayrı kontrol edilmiş bir palettir.

## Boşluk, şekil, tipografi

- Boşluk 4'ün katları; sık kullanılanlar 8 / 12 / 16 / 24 / 32. Feed içeriği `FEED_GUTTER = 16`.
- Köşe: kart 12, düğme ve alan 10, medya kartı (paylaşım) 22, avatar daire. Yeni bileşen yeni bir radius getirmez.
- Gölge yerine boşluk ve hizalama; çizgi yalnız `hairlineWidth` ve anlamlı yerde.
- Mobil sistem fontu; web gövde DM Sans, başlık Manrope. Ölçek mobilde `config/layout.ts` içindeki `TYPE` (360 pt telefon için, Instagram/Hevy ölçüleri): sekme ekranı başlığı 21, itilen ekran başlığı 16,5, bölüm başlığı 15, satır adı 14,5, gövde 14, metadata 12, düğme 13,5, başlık rakamı 20. Paper varyantları (`titleLarge` 18, `titleMedium` 15, `headlineSmall` 20…) `ThemeContext` içinde aynı ölçeğe indirildi.
- Ağırlık: başlık ve rakam 700, isim ve düğme 600, satır 400–500. **800/900 kullanılmaz** — Android'de Roboto Black'e düşüyor ve her şeyi "kalın ve kaba" gösteriyordu (2. tur kullanıcı geri bildirimi).
- İkonlar `ICON`: başlık ve sekme 24, satır 19, düğme içi 15; tek set, dış hatlı, gri.
- Kontroller `CONTROL`: düğme 32 pt (Instagram), ekranın asıl eylemi 40 pt (`SoftButton large`), arama/alan 38 pt, köşe 8. 50 pt'lik mor tam genişlik düğme yok.
- Dokunma hedefi en az 44 pt; küçük ikonların çevresinde yeterli hit alanı (hitSlop).

## Ekran kalıpları

- **Başlık (`ScreenHeader`):** 44 pt, solda geri/kapat, başlık 16,5. Altında çizgi yok; içerik kaydıkça ince çizgi yumuşakça belirir (`useScrollEdge` → `scrolled`). Kenarlar ekranın kendi eylemlerini taşır (ayarlar, ekle, takvim, "Kaydet" metni `textAction`); yalnız geri oku taşıyan 72 pt'lik bant yapılmaz. Sekme ekranları `large` (21 pt, geri yok).
- **Formlar (Profili düzenle, ölçüm girişi):** Instagram düzeni — solda sabit etiket sütunu, sağda değer, yalnız değerin altında ince çizgi; kutu içinde kutu yok; kaydetme başlığın sağ kenarında.
- **Konum seçiciler (story konumu, profil konumu):** tam ekran; arama alanı başlık satırında geri okunun yanında; sonuçlar kutusuz tam genişlik satır; story'de yazılan yer ilk satır ("Bu adla ekle").
- **Kişi kartları (öneriler, yakındakiler):** Instagram "Senin için önerilenler" kartı — 150 pt genişlik, ortada 72 pt avatar, ad, tek satır açıklama, 30 pt takip düğmesi, köşede kapat (×).
- **Gönderide takip:** dolgulu düğme değil, ismin yanında vurgu renginde "Takip et" yazısı.

- **Feed:** tam genişlik gönderi, üstte yazar satırı (38 pt avatar), medya, eylem satırı. Ara satırlar (öneriler, yakındakiler, sponsorlu) aynı gutter ve ritmi kullanır, kutulanmaz.
- **Sponsorlu içerik:** organik gönderiyle aynı ritim, başlıkta düz metin "Sponsorlu", SDK'nın AdChoices işareti köşede serbest, beğeni/yorum yok, yalnız SDK asset'leri tıklanabilir. Dolmayan reklam yer kaplamaz.
- **Aktif antrenman:** üstte süre, hacim, set; set satırında önceki değer, ağırlık (`decimal-pad`), tekrar (`number-pad`), tamamlandı onayı. Ekranı kapatmak antrenmanı bitirmez; feed ve rutinlerde "Devam et" girişi görünür.
- **Story editörü:** 9:16 alan, metin/konum katmanları normalize koordinatta; paylaşım kartı da buraya başlangıç medyası olarak gelir, doğrudan yayınlanmaz.
- **Profil (Instagram + Hevy):** başlıkta kullanıcı adı, sağ kenarda "+" (antrenman) ve ☰ (ayarlar); 80 pt avatar, yanında sayılar; altında ad, bio, konum; "Profili düzenle" + "Profili paylaş" (32 pt gri). Sonra Hevy düzeni: seçili haftanın değeri + 12 haftalık çubuk + metrik çipleri (Süre/Hacim/Antrenman), 2×2 kısayol (İstatistikler, Aylık rapor, Ölçümler, Rekorlar), son antrenmanlar. Gizlilik/Destek/Çıkış Ayarlar'da. Kapak yalnız fotoğraf varsa görünür.
- **Listeler:** kartsız tam genişlik satır, `hairlineWidth` ayırıcı, solda görsel ya da gri dış hatlı ikon, sağda değer veya chevron (`components/ui/NavRow`). Sayı sayacı yalnız gerçek toplamı gösteriyorsa konur.
- **Dönem seçimi:** `components/ui/PillTabs` — düz etiketler, seçilende yumuşak gri hap; vurgu rengi grafiğe kalır.

## İstatistik ve grafikler

Bileşenler `packages/mobile/src/components/charts/`: `StatStrip`, `BarChart`, `LineChart`, `BarList`, ölçek yardımcıları `scale.ts`. Sayılar `utils/format.ts` ile (`10.340 kg`, `1 sa 2 dk`, `12,5`); katalog değerleri `utils/exerciseLabels.ts` ile.

- KPI'lar kutu değil, `hairlineWidth` ile bölünmüş tek şerit metin; şerit aynı zamanda grafiğin metrik sekmesidir (seçilinin altında 2 pt vurgu çizgisi).
- Grafik başına tek renk (`primary`); seçili çubuk tam, diğerleri soluk. Lejant tek seride yok. Sıfır değerde çubuk çizilmez, sıfır gizlenmez.
- 3–5 soluk yatay çizgi, eksenin üst değeri yuvarlak, sayımlar tamsayı tick. Y değerleri sağ şeritte; ilk ve son x etiketi kenara hizalı, hiçbir etiket kırpılmaz.
- Varsayılan seçim son aktif gün/hafta; seçimin değeri grafiğin üstünde okunur.
- Kas dağılımı altıgen radarla (`RadarChart`, Hevy'deki gibi): altı sabit köşe (göğüs, sırt, bacak, omuz, kol, karın), altıgen halkalar, bu dönem dolu şekil, önceki dönem kesikli çizgi, her köşede ad ve set sayısı. Kullanıcı bu şekli istiyor; düz listeye çevrilmez. Kesin sıralama gerektiğinde radarın altında `BarList` (önceki dönem 2 pt işaretle). Kas yükü gibi "neyi atladım" sorusu sabit sıralı, tek renk tonlu ızgarayla.
- Her ekran aynı grafik türüne dönüşmez (kullanıcı "sürekli aynı grafik, sıkıcı" dedi). Dağılım:
  - Profil: 12 haftalık çubuk (`WeeklyActivity`, süre saat cinsinden eksen).
  - İstatistikler: 16 haftalık antrenman takvimi ısı haritası (`ActivityCalendar`) + altıgen radar.
  - Aylık rapor: ay boyunca birikimli çizgi (`LineChart`), ay takvimi, kas payı şeridi (`ShareBar`).
  - Gelişmiş istatistikler: lolipop (ince sap + nokta; dinlenme günleri boş kalır, çizginin sıfıra düşen testere dişi yok) + "antrenman başına" ortalamalar.
  - Kas dağılımı: radar + `BarList`. Kas yükü: tonlu ızgara. Ölçümler: sıfırdan bağımsız çizgi.
  - Egzersiz detayı: seanslara göre en ağır set çizgisi (Hevy). Antrenman detayı: kas payı şeridi.
  - Günlük çubuklar yalnız aylık metrik detay ekranlarında.
- Ölçüm gibi sıfırdan uzak seriler `LineChart zeroBased={false}`; artış/azalış işareti gri, iyi/kötü diye boyanmaz.

## Klavye

- Tam ekran liste + arama (konum seçiciler) listenin alt boşluğuna `useKeyboardInset().height` ekler; son satır klavyenin üstünde kalır.
- Android edge-to-edge çalışır; pencere klavyeye göre küçülmez. Kaydırılan formlar `components/KeyboardAwareScrollView`, modal/sheet içindeki alt öğeler `hooks/useKeyboardInset` kullanır. Elle `KeyboardAvoidingView` eklenmez.
- Form alanları `returnKeyType="next"` ile sıradakine geçer, son alan formu gönderir; `textContentType`/`autoComplete` doldurulur.

## Hareket

Geri bildirim 120–220 ms; gesture parmağı gecikmeden izler; sürekli parlayan CTA, bounce ve ağır blur yok. Reduced motion açıkken süs animasyonları kapanır.

## Erişilebilirlik

Her etkileşimli öğede rol ve etiket; gesture'ın düğme eşdeğeri; hata metni alanın yanında, yalnız toast'ta değil; büyük yazı ayarında taşma yok; Türkçe karakterler fontta ve export'ta doğru.

## Veri yükleme

- Ağ hatasında GET istekleri `api/client.ts` içinde iki kez yeniden denenir (yanıt hiç gelmediyse; yazma istekleri asla). Kas grubu/ekipman listeleri hata alırsa kendini yeniden yükler.
- Sekme ekranları ilk yüklemede hata alırsa boş liste ("bulunamadı") göstermez: hata + "Tekrar dene", sekmeye dönüşte ve aşağı çekince yeniden yükler.

## Kaçınılacaklar

Kart içinde kart, 800/900 yazı ağırlığı, yalnız geri oku taşıyan kalın başlık bandı, büyük harfli harf aralıklı etiketler, her bloğa gölge, aynı ekranda birden fazla vurgu rengi, renkli kare içinde ikon, eşik renkleriyle (kırmızı/turuncu/sarı) boyanmış değerler, gökkuşağı grafik, kalın çerçeveli tam genişlik düğme, uydurma metrik veya reklamveren bilgisi, işlevsiz "beğen" düğmeli reklam, ekran görüntüsünü maket olarak koymak.
