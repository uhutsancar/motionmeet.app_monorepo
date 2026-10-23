# MotionMeet yükseltme — durum

**Başlangıç commit'i:** `d75beb1` (admob and paddle added). Değişiklikler çalışma ağacında, commit edilmedi.
**Son güncelleme:** 23 Ekim 2026 (3. tur).

## Tamamlanan (kod)

- A1 ödeme kaldırma: backend/shared/web/mobil runtime, env şablonları, bağımlılıklar ve lockfile, 012 migration (arşivli), 410 uç noktaları, teknik kullanım limitleri. Artık dosyalar silindi.
- MM-01 web konum izni header'ı.
- Antrenman: kalıcı taslak (mobil + web), ondalık virgül, immutable set güncellemesi, önceki-set yüklemesi, süre hesabı, kayıt idempotency'si, yerel biçimli önceki set ve hacim.
- Paylaşım: kart → düzenlenebilir story taslağı, kart önbelleği, çıkışta temizlik, sahte "tamamlandı" işaretleri.
- Feed: beğeni uzlaşması, eski sayfa yarışı.
- Reklam: native sponsorlu feed kartı, kararlı yerleşim, Explore etiket/no-fill.
- 2. tur tasarım (Hevy/Instagram düzeni, `DESIGN.md` kuralları): kendi grafik bileşenleri (react-native-svg) ve ondan fazla ekranın yeniden yazımı, profil başlığı, egzersiz kataloğu etiketlerinin Türkçeleştirilmesi.
- 2. tur klavye: edge-to-edge Android için tek standart (`KeyboardAwareScrollView`, `useKeyboardInset`), giriş/kayıt formunda alanlar arası geçiş.
- 2. tur veri: kas grubu eşlemesi, 12 haftalık seri, kas başına set sayısı.

- 3. tur tasarım (Hevy/Instagram, mobil + web): ölçek ve ağırlık (800/900 → 700, `TYPE`/`ICON`/`CONTROL`), 44 pt başlık + kenar eylemleri + kaydırınca beliren çizgi, Instagram öneri kartları, Instagram profil ve profil düzenleme, tam ekran konum seçiciler, grafik çeşitliliği (antrenman takvimi, birikimli çizgi, kas payı şeridi, lolipop, ilerleme çizgisi), Hevy aktif antrenman. Web teması, profil, yan menü, istatistikler, ayarlar.
- 3. tur veri: egzersiz/rutin listesinin ağ hatasında boş kalması (DATA-02), egzersiz istatistik yanıtının yanlış okunması (DATA-03).

Ayrıntı: `FINDINGS.md`. Kanıtlar: `VERIFICATION.md`.

## Kullanıcıdan beklenen

1. **Hesabının parolası.** Verilen parola dev DB'deki `sancaruhut@gmail.com` hesabında 401 döndü. Parolayı sıfırlamak ya da hash'i değiştirmek kullanıcı verisine dokunmak olduğu için yapılmadı; ekranlar sentetik `qa_a` hesabı ve ona eklenen sentetik geçmişle incelendi.
2. AdMob panelinde UMP onay formu tanımlanmalı (`consent-update-failed`).
3. Kullanıcının yerel `packages/backend/.env` dosyasında `PADDLE_*` değişkenleri duruyor; artık okunmuyor.
4. Katalogda 4 bozuk kodlanmış egzersiz adı (DATA-01).

## Ortamın bırakıldığı durum

- Telefonda son QA APK kurulu, `qa_a` ile oturum açık, `adb reverse tcp:4000` aktif.
- Backend dev DB'ye bağlı olarak 4000 portunda çalışıyor (oturumdaki arka plan görevi).
- Dev DB'de 012 uygulandı; öncesinin yedeği `D:\motionmeet_backups\motionmeetdb-before-012-20261022-2252.dump`.
- Dev DB'deki sentetik veri: `qa_user_a…d` (`@motionmeet.test`) hesapları, `qa_user_a`'ya eklenmiş 12 haftalık antrenman geçmişi ve 24 saatte sona erecek bir test story'si.
- `motionmeet_test-postgres-test-1` konteyneri (tmpfs, 5433) çalışıyor; kullanıcı verisi içermez.
- Kök `.env.local` (QA APK origin'leri) duruyor; mağaza build'inden önce silinmeli (bkz. `docs/mobile-qa-apk.md`).

## Sıradaki işler

- Feed ve Keşfet ekranlarının aynı dille elden geçirilmesi; aktif antrenmanda set türleri (ısınma/drop/tükeniş) ve kartsız bölüm düzeni; Instagram tarzı yorum sayfası (alt sheet).
- ADS-04 story arası reklam, MM-03 OG yönlendirmesi, MM-14, MM-15, MM-18…MM-24.
- Web Playwright turu (MCP bağlanamadı); STORY-03 çoklu dokunma.
