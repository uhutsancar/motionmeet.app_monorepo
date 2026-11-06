import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import PublicLayout from "./PublicLayout";
import OpenSignup from "./site/OpenSignup";
import {
  ChatFragment,
  LibraryFragment,
  MeasurementFragment,
  MuscleMapFragment,
  NearbyFragment,
  PrivacyFragment,
  Reveal,
  RoutineFragment,
  SetLogFragment,
  ShareCardFragment,
  StoriesFragment,
} from "./site/parts";
import plateSwing from "../assets/site/muybridge-swinging-pick.webp";

const CARD_WORKOUT = {
  name: "Leg day",
  startTime: "2026-10-22T07:30:00.000Z",
  durationMinutes: 58,
  volumeKg: 9860,
  totalSets: 16,
  exercises: [
    { exerciseName: "Barbell squat", sets: [{}, {}, {}, {}, {}], equipment: "barbell", muscleGroup: "legs" },
    { exerciseName: "Romanian deadlift", sets: [{}, {}, {}, {}], equipment: "barbell", muscleGroup: "hamstrings" },
    { exerciseName: "Walking lunge", sets: [{}, {}, {}], equipment: "dumbbell", muscleGroup: "legs" },
    { exerciseName: "Standing calf raise", sets: [{}, {}, {}, {}], equipment: "machine", muscleGroup: "calves" },
  ],
};

/**
 * Each capability as a statement beside the piece of the app that does it,
 * at its real size. Bullets list only what the app really offers today.
 */
const ROWS: Array<{ key: string; bullets: number; ui: () => ReactNode; dark?: boolean }> = [
  { key: "log", bullets: 3, ui: () => <SetLogFragment /> },
  { key: "routines", bullets: 3, ui: () => <RoutineFragment /> },
  { key: "library", bullets: 3, ui: () => <LibraryFragment /> },
  { key: "map", bullets: 3, ui: () => <MuscleMapFragment />, dark: true },
  { key: "card", bullets: 3, ui: () => <ShareCardFragment workout={CARD_WORKOUT} /> },
  { key: "social", bullets: 3, ui: () => <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 440 }}><StoriesFragment /><ChatFragment /></div> },
  { key: "measure", bullets: 3, ui: () => <MeasurementFragment /> },
  { key: "nearby", bullets: 3, ui: () => <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 440 }}><NearbyFragment /><PrivacyFragment /></div>, dark: true },
];

const Features = () => {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t("site.title_features");
  }, [t]);

  return (
    <PublicLayout>
      <header className="mm-wrap mm-pagehead">
        <Reveal>
          <h1>{t("site.features_h1")}</h1>
          <p className="mm-lead" style={{ marginTop: 24 }}>{t("site.features_lead")}</p>
        </Reveal>
        <figure style={{ margin: 0 }}>
          <img src={plateSwing} alt={t("site.plate_swing_alt")} width={822} height={580} style={{ borderRadius: "var(--radius)", width: "100%" }} />
          <figcaption className="mm-caption">{t("site.plate_swing_caption")}</figcaption>
        </figure>
      </header>

      <div className="mm-wrap mm-rows" style={{ paddingBottom: "clamp(96px, 13vw, 200px)" }}>
        {ROWS.map((row) => (
          <section key={row.key} className={`mm-row${row.dark ? " mm-row--wide" : ""}`} aria-labelledby={`mm-f-${row.key}`}>
            <Reveal className="mm-row__text">
              <h2 id={`mm-f-${row.key}`}>{t(`site.f_${row.key}_h`)}</h2>
              <p>{t(`site.f_${row.key}_p`)}</p>
              <ul>
                {Array.from({ length: row.bullets }, (_, index) => (
                  <li key={index}>{t(`site.f_${row.key}_b${index + 1}`)}</li>
                ))}
              </ul>
            </Reveal>
            <div className="mm-row__stage">{row.ui()}</div>
          </section>
        ))}
      </div>

      <OpenSignup />
    </PublicLayout>
  );
};

export default Features;
