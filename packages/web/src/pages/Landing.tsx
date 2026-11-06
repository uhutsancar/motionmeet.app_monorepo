import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
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
import { parseWorkoutLog, useShareCard } from "./site/cardData";
import platesRunning from "../assets/site/muybridge-running.webp";
import plateHighJump from "../assets/site/muybridge-high-jump.webp";
import plateHighLeap from "../assets/site/muybridge-high-leap.webp";

const HERO_WORKOUT = {
  name: "Push day",
  startTime: "2026-10-24T18:00:00.000Z",
  durationMinutes: 64,
  volumeKg: 7420,
  totalSets: 18,
  exercises: [
    { exerciseName: "Barbell bench press", sets: [{}, {}, {}, {}], equipment: "barbell", muscleGroup: "chest" },
    { exerciseName: "Overhead press", sets: [{}, {}, {}, {}], equipment: "barbell", muscleGroup: "shoulders" },
    { exerciseName: "Incline dumbbell press", sets: [{}, {}, {}], equipment: "dumbbell", muscleGroup: "chest" },
    { exerciseName: "Lateral raise", sets: [{}, {}, {}, {}], equipment: "dumbbell", muscleGroup: "shoulders" },
    { exerciseName: "Triceps pushdown", sets: [{}, {}, {}], equipment: "cable", muscleGroup: "triceps" },
  ],
};

/** The hero: the headline split around the card the app makes after a session. */
const Hero = () => {
  const { t } = useTranslation();
  const card = useShareCard(HERO_WORKOUT, "summary", "square");
  return (
    <section className="mm-wrap mm-hero" aria-labelledby="mm-hero-title">
      {/* The card sits inside the headline so the two halves can meet around
          it; it is described once, below, rather than read as part of the title. */}
      <h1 id="mm-hero-title">
        <span className="mm-hero__half">{t("site.hero_a")}</span>
        <span className="mm-hero__frame" aria-hidden="true">
          <img src={card} alt="" width={1080} height={1080} fetchPriority="high" />
        </span>
        <span className="mm-hero__half mm-hero__half--end">{t("site.hero_b")}</span>
      </h1>
      <div className="mm-hero__foot">
        <p>{t("site.hero_sub")} <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{t("site.hero_card_alt")}</span></p>
        <Link to="/signup" className="mm-btn">{t("site.hero_cta")}</Link>
      </div>
    </section>
  );
};

/** What you type on the left; the card MotionMeet draws from it on the right. */
const Showcase = () => {
  const { t } = useTranslation();
  const [log, setLog] = useState(() => t("site.log_sample"));
  const workout = useMemo(() => parseWorkoutLog(log, t("site.log_untitled")), [log, t]);
  return (
    <section className="mm-split" aria-labelledby="mm-showcase-title">
      <h2 id="mm-showcase-title" className="mm-visually-hidden" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {t("site.show_h_a")} {t("site.show_h_b")}
      </h2>
      <div className="mm-split__in">
        <label htmlFor="mm-log" style={{ display: "block", marginBottom: 12, fontWeight: 700 }}>{t("site.log_label")}</label>
        <textarea id="mm-log" className="mm-log" value={log} onChange={(event) => setLog(event.target.value)} spellCheck={false} rows={7} />
        <p className="mm-split__hint">{t("site.log_hint")}</p>
        <span className="mm-split__h" aria-hidden="true">{t("site.show_h_a")}</span>
      </div>
      <div className="mm-split__out">
        <ShareCardFragment workout={workout} />
        <p className="mm-muted" style={{ fontSize: 15, maxWidth: 440 }}>
          {t("site.show_note", { exercises: workout.exercises.length, sets: workout.totalSets })}
        </p>
        <span className="mm-split__h" aria-hidden="true">{t("site.show_h_b")}</span>
      </div>
    </section>
  );
};

const STEPS: Array<{ key: string; ui: () => ReactNode }> = [
  { key: "log", ui: () => <SetLogFragment /> },
  { key: "map", ui: () => <MuscleMapFragment /> },
  { key: "near", ui: () => <NearbyFragment /> },
];

/** Three statements scroll past one held fragment, which changes with each. */
const Story = () => {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = refs.current.indexOf(entry.target as HTMLDivElement);
        if (index < 0) continue;
        setActive((current) => {
          if (current === index) return current;
          setLeaving(true);
          window.setTimeout(() => setLeaving(false), 200);
          return index;
        });
      }
    }, { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="mm-wrap mm-section" aria-labelledby="mm-story-title">
      <Reveal>
        <h2 id="mm-story-title" style={{ maxWidth: "12ch" }}>{t("site.story_h")}</h2>
      </Reveal>
      <div className="mm-story">
        <div className="mm-story__pin" aria-hidden="true">
          <div className="mm-swap" data-leaving={leaving} style={{ width: "100%", display: "grid", placeItems: "center" }}>
            {STEPS[active].ui()}
          </div>
        </div>
        <div className="mm-story__steps">
          {STEPS.map((step, index) => (
            <div key={step.key} className="mm-story__step" ref={(node) => { refs.current[index] = node; }}>
              <h3 style={{ fontSize: "var(--h2)", lineHeight: 1.02 }}>{t(`site.story_${step.key}_h`)}</h3>
              <p className="mm-lead">{t(`site.story_${step.key}_p`)}</p>
              <div className="mm-story__inline">{step.ui()}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/** Muybridge's athletes: motion recorded frame by frame, a set at a time. */
const Plates = () => {
  const { t } = useTranslation();
  return (
    <section className="mm-wrap" aria-labelledby="mm-plates-title" style={{ paddingBottom: "clamp(96px, 13vw, 200px)" }}>
      <Reveal>
        <h2 id="mm-plates-title" style={{ maxWidth: "16ch", marginBottom: 20 }}>{t("site.plates_h")}</h2>
        <p className="mm-lead mm-muted" style={{ marginBottom: 48 }}>{t("site.plates_p")}</p>
      </Reveal>
      <div className="mm-plates">
        <figure>
          <img className="mm-drift" src={platesRunning} alt={t("site.plate_running_alt")} width={760} height={545} loading="lazy" decoding="async" />
        </figure>
        <div className="mm-plates__side">
          <figure>
            <img src={plateHighJump} alt={t("site.plate_jump_alt")} width={800} height={353} loading="lazy" decoding="async" />
          </figure>
          <figure>
            <img src={plateHighLeap} alt={t("site.plate_leap_alt")} width={1400} height={1174} loading="lazy" decoding="async" />
          </figure>
        </div>
      </div>
      <p className="mm-caption">{t("site.plates_caption")}</p>
    </section>
  );
};

const CELLS: Array<{ key: string; ui: () => ReactNode }> = [
  { key: "routines", ui: () => <RoutineFragment /> },
  { key: "library", ui: () => <LibraryFragment /> },
  { key: "stories", ui: () => <StoriesFragment /> },
  { key: "messages", ui: () => <ChatFragment /> },
  { key: "measure", ui: () => <MeasurementFragment /> },
  { key: "privacy", ui: () => <PrivacyFragment /> },
];

const Cells = () => {
  const { t } = useTranslation();
  return (
    <section className="mm-wrap mm-section" style={{ paddingTop: 0 }} aria-labelledby="mm-cells-title">
      <Reveal>
        <h2 id="mm-cells-title">{t("site.cells_h")}</h2>
      </Reveal>
      <div className="mm-cells">
        {CELLS.map((cell, index) => (
          // Text on top, then the fragment on top, alternating, so the pieces
          // of interface form a checkerboard rather than a row of equal cards.
          <Reveal key={cell.key} className={`mm-cell${(index + Math.floor(index / 3)) % 2 ? " mm-cell--flip" : ""}`}>
            <div className="mm-cell__text">
              <h3>{t(`site.cell_${cell.key}_h`)}</h3>
              <p>{t(`site.cell_${cell.key}_p`)}</p>
            </div>
            <div className="mm-cell__ui">{cell.ui()}</div>
          </Reveal>
        ))}
      </div>
      <p style={{ marginTop: 32 }}>
        <Link to="/features" className="mm-link" style={{ color: "var(--accent)" }}>{t("site.cells_more")} →</Link>
      </p>
    </section>
  );
};

const Landing = () => {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t("site.title_home");
  }, [t]);
  return (
    <PublicLayout>
      <Hero />
      <Showcase />
      <Story />
      <Plates />
      <Cells />
      <OpenSignup />
    </PublicLayout>
  );
};

export default Landing;
