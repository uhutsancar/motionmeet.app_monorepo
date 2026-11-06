import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import PublicLayout from "./PublicLayout";
import { Reveal } from "./site/parts";
import motionmeetLogo from "../assets/motionmeet_logo.svg";
import plateLeap from "../assets/site/muybridge-high-leap.webp";
import plateRunning from "../assets/site/muybridge-running.webp";
import plateHighJump from "../assets/site/muybridge-high-jump.webp";
import plateSwing from "../assets/site/muybridge-swinging-pick.webp";

/**
 * What MotionMeet is for and how it treats the people who use it, written as
 * a short letter. Every statement here is something the app actually does;
 * there is no invented team, history or figure.
 */
const About = () => {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t("site.title_about");
  }, [t]);

  const facts = ["free", "location", "card"] as const;

  return (
    <PublicLayout>
      <header className="mm-wrap mm-about-hero">
        <Reveal>
          <h1>{t("site.about_h1")}</h1>
          <p className="mm-lead" style={{ marginTop: 24 }}>{t("site.about_lead")}</p>
        </Reveal>
        <figure>
          <img src={plateLeap} alt={t("site.plate_leap_alt")} width={1400} height={1174} fetchPriority="high" />
          <figcaption className="mm-caption">{t("site.plate_leap_caption")}</figcaption>
        </figure>
      </header>

      <section className="mm-wrap mm-section" aria-labelledby="mm-letter-title">
        <Reveal className="mm-letter">
          <span className="mm-letter__mark"><img src={motionmeetLogo} alt="" width={26} height={26} /></span>
          <h2 id="mm-letter-title" style={{ fontSize: "clamp(28px, 3vw, 40px)" }}>{t("site.letter_h")}</h2>
          <p>{t("site.letter_1")}</p>
          <p>{t("site.letter_2a")} <mark>{t("site.letter_2b")}</mark> {t("site.letter_2c")}</p>
          <p>{t("site.letter_3")}</p>
          <p>{t("site.letter_4")}</p>
          <div>
            <p className="mm-letter__sign">MotionMeet</p>
            <p className="mm-muted" style={{ fontSize: 14 }}>motionmeet.app</p>
          </div>
        </Reveal>
      </section>

      <section className="mm-wrap" aria-labelledby="mm-facts-title" style={{ paddingBottom: "clamp(96px, 13vw, 200px)" }}>
        <Reveal>
          <h2 id="mm-facts-title" style={{ marginBottom: 48, maxWidth: "14ch" }}>{t("site.facts_h")}</h2>
        </Reveal>
        <div className="mm-facts">
          {facts.map((fact) => (
            <Reveal key={fact} className="mm-fact">
              <h3>{t(`site.fact_${fact}_h`)}</h3>
              <p>{t(`site.fact_${fact}_p`)}</p>
            </Reveal>
          ))}
        </div>
        <div className="mm-plates" style={{ marginTop: 8 }}>
          <figure>
            <img className="mm-drift" src={plateRunning} alt={t("site.plate_running_alt")} width={760} height={545} loading="lazy" decoding="async" />
          </figure>
          <div className="mm-plates__side">
            <figure>
              <img src={plateHighJump} alt={t("site.plate_jump_alt")} width={800} height={353} loading="lazy" decoding="async" />
            </figure>
            <figure>
              <img src={plateSwing} alt={t("site.plate_swing_alt")} width={822} height={580} loading="lazy" decoding="async" />
            </figure>
          </div>
        </div>
        <p className="mm-caption">{t("site.plates_caption")} {t("site.plate_swing_caption")}</p>
        <p style={{ marginTop: 48, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link to="/signup" className="mm-btn">{t("site.hero_cta")}</Link>
          <Link to="/features" className="mm-btn mm-btn--quiet">{t("nav.features")}</Link>
        </p>
      </section>
    </PublicLayout>
  );
};

export default About;
