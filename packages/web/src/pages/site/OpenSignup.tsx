import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Reveal } from "./parts";

/** The close: the first screen of the app, already open. */
const OpenSignup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = username.trim().replace(/^@/, "");
    navigate(clean ? `/signup?username=${encodeURIComponent(clean)}` : "/signup");
  };
  return (
    <section className="mm-cta" aria-labelledby="mm-cta-title">
      <Reveal className="mm-cta__copy">
        <h2 id="mm-cta-title">{t("site.cta_h")}</h2>
        <p>{t("site.cta_p")}</p>
      </Reveal>
      <form data-ui="" className="ui-dialog mm-cta__dialog" onSubmit={submit}>
        <div className="ui-title" style={{ fontSize: 18 }}>{t("site.cta_dialog_title")}</div>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="ui-sub">{t("site.cta_username")}</span>
          <span className="ui-field">
            <span className="ui-sub">@</span>
            <input
              className="ui-input"
              value={username}
              onChange={(event) => setUsername(event.target.value.slice(0, 30))}
              placeholder={t("site.cta_username_ph")}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          </span>
        </label>
        <span className="ui-sub">{t("site.cta_private_note")}</span>
        <button type="submit" className="ui-primary">{t("site.cta_button")}</button>
      </form>
    </section>
  );
};

export default OpenSignup;
