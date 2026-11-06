/**
 * Working pieces of the product for the public pages.
 *
 * Each fragment is a small, true piece of MotionMeet at its real size - the
 * set table, the muscle map, the nearby list - built in HTML with believable
 * demo content and real behaviour, rather than a screenshot or a mock-up of
 * grey bars. The share card is not even a copy: it is drawn by the same
 * renderer the app and the server use.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  SHARE_CARD_TEMPLATES,
  bodyFigureDocument,
  type ShareCardTemplate,
  type ShareCardWorkoutLike,
} from "@motionmeet/shared";
import { svgSrc, useShareCard } from "./cardData";


/** Lets a section's parts rise in turn the first time it scrolls into view. */
export const Reveal = ({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "header" }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    // Only hidden once script is known to run, so nothing stays invisible without it.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.9) return undefined;
    setShown(false);
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShown(true);
        observer.disconnect();
      }
    }, { rootMargin: "0px 0px -12% 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <Tag ref={ref as never} className={`mm-reveal ${className}`} data-shown={shown}>{children}</Tag>;
};

/* ── The live card ─────────────────────────────────────────────────────── */

const TEMPLATE_KEYS: Record<ShareCardTemplate, string> = {
  summary: "site.tpl_summary",
  stats: "site.tpl_stats",
  exercises: "site.tpl_exercises",
  highlight: "site.tpl_highlight",
  minimal: "site.tpl_minimal",
};

/** The card, with the five layouts to switch between. */
export const ShareCardFragment = ({ workout }: { workout: ShareCardWorkoutLike }) => {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<ShareCardTemplate>("summary");
  const src = useShareCard(workout, template, "square");
  return (
    <div data-ui="" style={{ display: "grid", gap: 12, maxWidth: 540 }}>
      <img className="ui-card-img" src={src} alt={t("site.card_alt", { title: workout.name })} width={1080} height={1080} />
      <div className="ui-seg" role="group" aria-label={t("site.tpl_label")} style={{ overflowX: "auto" }}>
        {SHARE_CARD_TEMPLATES.map((id) => (
          <button key={id} type="button" aria-pressed={template === id} onClick={() => setTemplate(id)}>
            {t(TEMPLATE_KEYS[id])}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── Fragments ─────────────────────────────────────────────────────────── */

const BENCH_SETS = [
  { kg: 60, reps: 10 },
  { kg: 80, reps: 8 },
  { kg: 80, reps: 8 },
  { kg: 80, reps: 7 },
];

/** A set table: tick a set and the session's volume adds it. */
export const SetLogFragment = () => {
  const { t } = useTranslation();
  const [done, setDone] = useState([true, true, false, false]);
  const volume = BENCH_SETS.reduce((sum, set, index) => sum + (done[index] ? set.kg * set.reps : 0), 0);
  return (
    <div data-ui="">
      <div className="ui-between">
        <div className="ui-row">
          <span className="ui-avatar" aria-hidden="true">B</span>
          <div>
            <div className="ui-title">Barbell bench press</div>
            <div className="ui-sub">{t("site.ui_chest")} · {t("site.ui_barbell")}</div>
          </div>
        </div>
      </div>
      <table className="ui-table">
        <thead>
          <tr><th>{t("site.ui_set")}</th><th>KG</th><th>{t("site.ui_reps")}</th><th aria-label={t("site.ui_done")} /></tr>
        </thead>
        <tbody>
          {BENCH_SETS.map((set, index) => (
            <tr key={index} className={done[index] ? "is-done" : undefined}>
              <td>{index === 0 ? "W" : index}</td>
              <td>{set.kg}</td>
              <td>{set.reps}</td>
              <td style={{ textAlign: "right" }}>
                <button
                  type="button"
                  className="ui-check"
                  aria-pressed={done[index]}
                  aria-label={t("site.ui_mark_set", { n: index + 1 })}
                  onClick={() => setDone((current) => current.map((value, i) => (i === index ? !value : value)))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ui-between" style={{ marginTop: 12 }}>
        <span className="ui-sub">{t("site.ui_volume")}</span>
        <span className="ui-title" style={{ fontVariantNumeric: "tabular-nums" }}>{volume.toLocaleString()} kg</span>
      </div>
    </div>
  );
};

const PERIODS = {
  "7": { chest: 12, back: 10, legs: 14, shoulders: 6, arms: 8, abs: 0 },
  "30": { chest: 46, back: 41, legs: 52, shoulders: 22, arms: 30, abs: 9 },
  "365": { chest: 512, back: 488, legs: 590, shoulders: 260, arms: 344, abs: 120 },
} as const;
type Period = keyof typeof PERIODS;
const GROUP_KEYS = ["chest", "back", "legs", "shoulders", "arms", "abs"] as const;

/** The front and back muscle map for a period, with the set count per group. */
export const MuscleMapFragment = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("30");
  const counts = PERIODS[period];
  const worked = GROUP_KEYS.filter((group) => counts[group] > 0);
  const src = useMemo(() => svgSrc(bodyFigureDocument([...worked])), [worked.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-ui="" style={{ display: "grid", gap: 14 }}>
      <div className="ui-seg" role="group" aria-label={t("site.ui_period")}>
        {(Object.keys(PERIODS) as Period[]).map((id) => (
          <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)}>
            {t(`site.ui_period_${id}`)}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "center" }}>
        <img src={src} alt={t("site.ui_map_alt")} width={188} height={218} style={{ width: "100%" }} />
        <div className="ui-list">
          {GROUP_KEYS.map((group) => (
            <div key={group} className="ui-between">
              <span className={counts[group] ? undefined : "ui-sub"}>{t(`site.ui_${group}`)}</span>
              <span className="ui-title" style={{ fontVariantNumeric: "tabular-nums" }}>{counts[group]} {t("site.ui_sets_short")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** People nearby: a coarse band and a city, never a figure in metres. */
export const NearbyFragment = () => {
  const { t } = useTranslation();
  const people = [
    { initial: "D", name: "Deniz Kaya", handle: "denizlifts", area: "Kadıköy, İstanbul", band: t("site.band_2_5") },
    { initial: "E", name: "Ece Yılmaz", handle: "ece.runs", area: "Üsküdar, İstanbul", band: t("site.band_5_10") },
    { initial: "M", name: "Mert Aydın", handle: "mertsquats", area: "İstanbul", band: t("site.band_city") },
  ];
  return (
    <div data-ui="">
      <div className="ui-between" style={{ marginBottom: 6 }}>
        <span className="ui-title">{t("site.ui_nearby")}</span>
        <span className="ui-sub">{t("site.ui_updated")}</span>
      </div>
      <div className="ui-list">
        {people.map((person) => (
          <div key={person.handle} className="ui-row">
            <span className="ui-avatar" aria-hidden="true">{person.initial}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ui-title">{person.name}</div>
              <div className="ui-sub">@{person.handle} · {person.area}</div>
            </div>
            <span className="ui-pill">{person.band}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const RoutineFragment = () => {
  const { t } = useTranslation();
  const moves = ["Barbell bench press", "Overhead press", "Incline dumbbell press", "Lateral raise", "Triceps pushdown"];
  return (
    <div data-ui="" style={{ display: "grid", gap: 12 }}>
      <div>
        <div className="ui-title">{t("site.ui_routine_name")}</div>
        <div className="ui-sub">{t("site.ui_routine_meta", { count: moves.length })}</div>
      </div>
      <div className="ui-sub">{moves.join(", ")}</div>
      <button type="button" className="ui-primary">{t("site.ui_start_routine")}</button>
    </div>
  );
};

const LIBRARY = [
  ["Barbell bench press", "chest", "barbell"],
  ["Incline dumbbell press", "chest", "dumbbell"],
  ["Cable fly", "chest", "cable"],
  ["Barbell squat", "legs", "barbell"],
  ["Romanian deadlift", "legs", "barbell"],
  ["Lat pulldown", "back", "cable"],
  ["Seated cable row", "back", "cable"],
  ["Lateral raise", "shoulders", "dumbbell"],
  ["Hammer curl", "arms", "dumbbell"],
  ["Hanging leg raise", "abs", "bodyweight"],
] as const;

/** The exercise search, filtering as you type. */
export const LibraryFragment = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("press");
  const results = LIBRARY.filter(([name]) => name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 4);
  return (
    <div data-ui="">
      <label className="ui-field">
        <svg className="ui-sub" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
        <input className="ui-input" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t("site.ui_search")} />
      </label>
      <div className="ui-list" style={{ marginTop: 6 }}>
        {results.length ? results.map(([name, group, equipment]) => (
          <div key={name}>
            <div className="ui-title" style={{ fontSize: 14 }}>{name}</div>
            <div className="ui-sub">{t(`site.ui_${group}`)} · {t(`site.ui_${equipment}`)}</div>
          </div>
        )) : <div className="ui-sub">{t("site.ui_no_results")}</div>}
      </div>
    </div>
  );
};

export const MeasurementFragment = () => {
  const { t } = useTranslation();
  const rows = [
    [t("site.ui_weight"), "78,4 kg", "−0,6"],
    [t("site.ui_waist"), "82 cm", "−1"],
    [t("site.ui_arm"), "36,5 cm", "+0,5"],
  ];
  return (
    <div data-ui="">
      <div className="ui-sub" style={{ marginBottom: 4 }}>{t("site.ui_last_entry")}</div>
      <div className="ui-list">
        {rows.map(([label, value, change]) => (
          <div key={label} className="ui-between">
            <span>{label}</span>
            <span className="ui-row" style={{ gap: 12 }}>
              <span className="ui-sub" style={{ fontVariantNumeric: "tabular-nums" }}>{change}</span>
              <span className="ui-title" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChatFragment = () => {
  const { t } = useTranslation();
  return (
    <div data-ui="" style={{ display: "grid", gap: 8 }}>
      <div className="ui-bubble ui-bubble--them">{t("site.ui_chat_1")}</div>
      <div className="ui-bubble ui-bubble--me">{t("site.ui_chat_2")}</div>
      <div className="ui-sub" style={{ textAlign: "right" }}>{t("site.ui_seen")}</div>
      <div className="ui-field"><span className="ui-sub">{t("site.ui_type_message")}</span></div>
    </div>
  );
};

export const StoriesFragment = () => {
  const { t } = useTranslation();
  const rings = [
    { label: t("site.ui_your_story"), initial: "+", seen: false },
    { label: "denizlifts", initial: "D", seen: false },
    { label: "ece.runs", initial: "E", seen: false },
    { label: "mertsquats", initial: "M", seen: true },
  ];
  return (
    <div data-ui="" style={{ display: "flex", gap: 14, overflowX: "auto" }}>
      {rings.map((ring) => (
        <div key={ring.label} style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 64 }}>
          <span className={`ui-ring${ring.seen ? " ui-ring--seen" : ""}`}><span>{ring.initial}</span></span>
          <span className="ui-sub" style={{ fontSize: 12, maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ring.label}</span>
        </div>
      ))}
    </div>
  );
};

/** Who sees the profile location - the real four choices. */
export const PrivacyFragment = () => {
  const { t } = useTranslation();
  const options = ["everyone", "followers", "connections", "me"] as const;
  const [choice, setChoice] = useState<(typeof options)[number]>("followers");
  return (
    <div data-ui="" style={{ display: "grid", gap: 10 }}>
      <div className="ui-title">{t("site.ui_who_sees")}</div>
      <div className="ui-seg" role="group" aria-label={t("site.ui_who_sees")} style={{ flexWrap: "wrap" }}>
        {options.map((id) => (
          <button key={id} type="button" aria-pressed={choice === id} onClick={() => setChoice(id)}>{t(`site.ui_vis_${id}`)}</button>
        ))}
      </div>
      <div className="ui-sub">{t("site.ui_vis_note")}</div>
    </div>
  );
};
