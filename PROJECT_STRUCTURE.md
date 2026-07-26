# MotionMeet - Kapsamlı Proje Mimarisi ve Yapı Analizi

MotionMeet, sporcular ve fitness tutkunları için tasarlanmış geniş çaplı bir sosyal ağ platformudur. Bu proje, **pnpm workspaces** ve **Turborepo** kullanılarak monorepo mimarisiyle inşa edilmiştir.

## 📁 Kök Dizin Yapılandırmaları (Root Configurations)

Kök dizin, projenin ortak bağımlılıklarının ve çalışma kurallarının belirlendiği merkezdir:
- **`package.json`**: Monorepo paket yöneticisi `pnpm` ayarlamalarını, ortak betikleri (`dev`, `build`, `test`) ve çalışma alanı (workspace) tanımlarını içerir.
- **`turbo.json`**: Turborepo için caching (önbelleğe alma) ve görev paralelleştirme kurallarını belirler. `build` işlemlerinin sırasını ayarlar.
- **`pnpm-workspace.yaml`**: `packages/*` dizini altındaki tüm klasörlerin birbiriyle nasıl paket bağımlılığı kurduğunu (symlink) gösterir.

---

## 🛠 Katman 1: `packages/backend` (API & Real-time Server)
Projenin ana beyni. Node.js ve Express.js üzerinde çalışır. Socket.IO ile canlı mesajlaşma ve bildirimleri yönetir.

### Veritabanı Modelleri (`models/`)
Veriler MongoDB üzerinde Mongoose ile tutulur. Ana modeller:
- **`User`**: Kullanıcı profili (boy, kilo, bio), roller (`user`, `admin`, `superadmin`), gizlilik ayarları (arama, mesaj izinleri) ve abonelik (`plan`) verilerini tutar.
- **`Workout` & `Routine`**: Sporcunun antrenman şablonları (`Routine`) ve tamamlanmış antrenman geçmişi (`Workout`). Hacim (Volume) ve süre hesaplamalarını kaydeder.
- **`Exercise` & `Equipment` & `MuscleGroup`**: Platformun ana egzersiz veritabanını oluşturur. Egzersizlerin birincil/ikincil kas gruplarını bağlar.
- **`Post`, `PostLike`, `PostComment`**: Sosyal akış için gerekli metin, görsel/video gönderileri ve etkileşim modelleri.
- **`Story`**: Hikaye (24 saatlik) modelleri ve görüntülenme sayaçları.
- **`Message`**: Kullanıcılar arası birebir (P2P) gerçek zamanlı sohbet geçmişi.
- **`UploadReservation` & `Usage`**: Kullanıcıların kota yönetimi (AWS S3 ImageKit yüklemeleri, rutin limitleri) için sistem.

### API Rotaları (`routes/`) ve Kontrolcüler (`controllers/`)
- `/api/auth`: Login, Register, JWT Refresh ve Logout (Token blacklist) işlemleri.
- `/api/user`: Hesap ayarları, gizlilik yönetimi, veri dışa aktarma (GDPR).
- `/api/post` & `/api/story`: Sosyal medya işlemleri (Feed akışı, Like/Comment mekanizması).
- `/api/workout` & `/api/routine`: Antrenman başlatma, bitirme, istatistik hesaplama ve rutin (şablon) oluşturma.
- `/api/rbac`: Superadmin yetkilendirme ve rol/plan yönetimi rotaları.

### Servisler (`services/`) ve Arka Plan İşleri (`workers/`)
- İş katmanı, Route/Controller bağımlılıklarından ayrılmıştır. DB mantığı buradadır.
- **`cronJobs.js`**: Süresi dolmuş rezervasyonları ve eski hikayeleri düzenli olarak veritabanından ve AWS S3/ImageKit üzerinden siler.

### Realtime (Socket.IO)
- **`socketRegistry.js` & `socketHandlers.js`**: Aktif kullanıcıların soket ID'lerini hafızada veya Redis üzerinde tutarak; anlık mesajlaşma (`receive_message`), bildirimler, ve yazıyor (`typing`) olaylarını yönetir.

---

## 💻 Katman 2: `packages/web` (React Frontend)
Kullanıcıların masaüstü veya tarayıcı üzerinden eriştiği arayüz.

### Teknolojiler
- **Core**: React 19, Vite, React Router DOM
- **UI Kit**: Material-UI (MUI v5), Tailwind CSS
- **State**: Redux Toolkit (global state) & Context API (auth state)

### Sayfa Yapısı (`src/pages/`)
- **Genel & Auth:** `Landing`, `Login`, `Signup`, `About`, `Pricing`, `Features`
- **Sosyal Ağ:** `Feed`, `Profile`, `Messages`, `CreatePost`
- **Antrenman Yönetimi:** `WorkoutsDetail`, `Routines`, `ActiveWorkout`, `WorkoutSummary`, `Exercises`
- **İstatistiksel Ekranlar:** `Statistics`, `AdvancedStatistics`, `MonthlyReport`, `PersonalRecords`, `MuscleDistribution`, `VolumeDetail`, `DurationDetail`, `SetsDetail`

### Bileşenler (`src/components/`)
- **Modallar:** `RoutineBuilderModal` (Rutin yaratma), `CustomExerciseModal`, `CreatePostModal` (Gönderi yaratma ve ImageKit yükleme entegrasyonu).
- **Listeler:** `WorkoutCard`, `PostCard`, `UserCard` (Kullanıcı bağlantıları).
- **Navigasyon:** `Sidebar`, `BottomNav`, `Header`.

---

## 📱 Katman 3: `packages/mobile` (React Native App)
iOS ve Android için geliştirilmiş mobil istemci.

### Teknolojiler
- **Core**: React Native (Expo SDK), React Navigation
- **UI Kit**: React Native Paper, React Native Chart Kit
- **Native Eklentiler**: ImagePicker (Kamera/Galeri), Async Storage (Lokal hafıza)

### Ekranlar (`src/pages/`)
Web projesinin %100 mobil uyumlu karşılıklarıdır.
- **Sosyal:** `Feed.js`, `Profile.js`, `Messages.js`, `ChatBox.js`
- **Antrenman:** `ActiveWorkoutScreen.js`, `WorkoutDetailScreen.js`, `Routines.js`
- **İstatistik:** `Statistics.js`, `MonthlyReportScreen.js`, `MuscleDistribution.js`
- **Ekstralar:** `LeaderboardScreen.js` (Sıralama panosu), `NotificationsScreen.js` (Bildirim merkezi).

---

## 🔗 Katman 4: `packages/shared` (Ortak Klasör)
Monorepo'nun temel gücü olan paket.
- Web ve Mobile tarafından **ortak** olarak çağrılır (`import { API_ROUTES } from '@motionmeet/shared'`).
- İçerisinde tüm API uç noktalarının (Endpoints) sabitlendiği `API_ROUTES`, gizlilik varsayılanları (`PRIVACY_DEFAULTS`) ve sayfalama kuralları (`PAGINATION_DEFAULTS`) yer alır. Böylece tek bir yerde yapılan URL değişikliği, tüm platformları aynı anda günceller.

---

## ⚙️ Çevresel Değişkenler ve API İletişimi (.env Entegrasyonu)

- **Backend (`.env`)**: `MONGODB_URL`, `JWT_SECRET`, ImageKit ayarları (`IMAGEKIT_URL_ENDPOINT`) ve AWS S3 bağlantıları buradan yapılandırılır.
- **Web (`.env.development`)**: `VITE_BASEURL` (örn: `http://localhost:4000`) üzerinden frontend'in API'ye istek atması sağlanır.
- **Mobile (`.env`)**: `EXPO_PUBLIC_API_URL` (örn: `http://192.168.1.146:4000`) üzerinden, cep telefonlarının veya emülatörlerin lokal sunucuya erişimi sağlanır.

> Uygulamanın tüm API iletişimi, **Axios** aracı (`api/axios.js`) üzerinden Bearer Token kullanılarak interceptor yapısıyla gerçekleşir. Süresi dolan tokenlar otomatik olarak `refresh` ucu ile yenilenir.
