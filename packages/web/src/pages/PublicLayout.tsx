import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation } from "react-router";
import motionmeetLogo from "../assets/motionmeet_logo.svg";
import { useAppTheme } from "../context/appThemeContext";
import { changeLanguage } from "../i18n";
import "./site/site.css";

/**
 * The shell of the public pages: a plain bar (the mark, three links, one
 * action) and a footer that is one quiet line. Everything is scoped under
 * .mm-site so the signed-in app keeps its own look.
 */
const PublicNavbar = () => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Non-English catalogues are fetched on demand, so switching is async.
  const toggleLanguage = () => {
    void changeLanguage(i18n.language.startsWith("tr") ? "en" : "tr");
  };

  const links = [
    { to: "/features", label: t("nav.features") },
    { to: "/about", label: t("nav.about") },
    { to: "/login", label: t("nav.login") },
  ];
  const other = i18n.language.startsWith("tr") ? "EN" : "TR";

  return (
    <header className="mm-bar">
      <div className="mm-wrap mm-bar__row">
        <RouterLink to="/" className="mm-brand" aria-label="MotionMeet">
          <img src={motionmeetLogo} alt="" width={30} height={30} />
          MotionMeet
        </RouterLink>
        <nav className="mm-nav" aria-label={t("site.nav_label")}>
          {links.map((link) => (
            <RouterLink key={link.to} to={link.to} className="mm-link" aria-current={pathname === link.to ? "page" : undefined}>
              {link.label}
            </RouterLink>
          ))}
          <button type="button" className="mm-iconbtn" onClick={toggleLanguage} aria-label={t("site.switch_language")} title={t("site.switch_language")}>
            {other}
          </button>
          <button
            type="button"
            className="mm-iconbtn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("nav.mode_light") : t("nav.mode_dark")}
            title={theme === "dark" ? t("nav.mode_light") : t("nav.mode_dark")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {theme === "dark"
                ? <><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
                : <path d="M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5a8.5 8.5 0 1 0 10.9 10.9z" />}
            </svg>
          </button>
          <RouterLink to="/signup" className="mm-btn">{t("nav.signup")}</RouterLink>
          <button
            type="button"
            className="mm-iconbtn mm-menu"
            aria-expanded={menuOpen}
            aria-controls="mm-drawer"
            aria-label={t("site.menu")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </nav>
      </div>
      <div id="mm-drawer" className="mm-drawer" data-open={menuOpen}>
        {links.map((link) => (
          <RouterLink key={link.to} to={link.to} className="mm-link">{link.label}</RouterLink>
        ))}
        <div className="mm-drawer__tools">
          <button type="button" className="mm-iconbtn" onClick={toggleLanguage} aria-label={t("site.switch_language")}>{other}</button>
          <button type="button" className="mm-btn mm-btn--quiet" onClick={toggleTheme}>
            {theme === "dark" ? t("nav.mode_light") : t("nav.mode_dark")}
          </button>
        </div>
      </div>
    </header>
  );
};

const PublicFooter = () => {
  const { t } = useTranslation();
  return (
    <footer className="mm-foot">
      <div className="mm-wrap">
        <div className="mm-foot__row">
          <span className="mm-muted">{t("site.footer_what")}</span>
          <nav className="mm-foot__links" aria-label={t("site.footer_label")}>
            <RouterLink to="/features" className="mm-link">{t("nav.features")}</RouterLink>
            <RouterLink to="/about" className="mm-link">{t("nav.about")}</RouterLink>
            <RouterLink to="/login" className="mm-link">{t("nav.login")}</RouterLink>
          </nav>
          <span className="mm-foot__end">
            <span>© 2026</span>
            <a className="mm-link" href="https://motionmeet.app/privacy">{t("footer.privacy")}</a>
            <a className="mm-link" href="https://motionmeet.app/terms">{t("footer.terms")}</a>
          </span>
        </div>
        <p className="mm-foot__credit">{t("site.credit")}</p>
      </div>
    </footer>
  );
};

const PublicLayout = ({ children, noFooter = false }: { children: ReactNode; noFooter?: boolean }) => {
  const { theme } = useAppTheme();
  return (
    <div className="mm-site" data-theme={theme === "dark" ? "dark" : "light"}>
      <PublicNavbar />
      <main>{children}</main>
      {!noFooter && <PublicFooter />}
    </div>
  );
};

export default PublicLayout;
