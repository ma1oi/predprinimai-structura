"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import type { Prediction } from "@/lib/prediction-types";
import type { RegistrationInput } from "@/lib/registration-types";
import styles from "./registration-footer.module.css";

function PredictionText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const paper = element?.parentElement;
    if (!element || !paper) return;
    let active = true;
    const fit = () => {
      if (!active) return;
      let scale = 1;
      element.style.setProperty("--prediction-scale", "1");
      while (element.offsetHeight > paper.clientHeight * 0.4 && scale > 0.5) {
        scale = Math.max(0.5, scale - 0.05);
        element.style.setProperty("--prediction-scale", String(scale));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(paper);
    void document.fonts.ready.then(fit);
    return () => { active = false; observer.disconnect(); };
  }, [text]);
  return <p ref={ref} className={styles.paperText} role="status" aria-live="polite">{text}</p>;
}

export function RegistrationSection({ initialPredictions }: { initialPredictions: Prediction[] }) {
  const [predictions, setPredictions] = useState(initialPredictions);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const currentPrediction = predictions.find((item) => item.id === predictionId);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/predictions", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result.predictions)) setPredictions(result.predictions);
      } catch {
        // Preserve the last published texts when the connection is interrupted.
      }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const [formMessage, setFormMessage] = useState("");
  const [formState, setFormState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const submitting = useRef(false);
  const request = useRef<{ id: string; signature: string } | null>(null);

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const values = {
      name: String(fields.get("name") || "").trim(),
      phone: String(fields.get("phone") || "").trim(),
      company: String(fields.get("company") || "").trim(),
      consent: fields.get("consent") === "on",
    };
    const signature = JSON.stringify(values);
    if (request.current?.signature !== signature) request.current = { id: crypto.randomUUID(), signature };
    const payload: RegistrationInput = { ...values, requestId: request.current.id };
    submitting.current = true;
    setFormState("submitting");
    setFormMessage("Отправляем заявку…");
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setFormState("error");
        setFormMessage(typeof result?.error === "string" ? result.error : "Не удалось отправить заявку. Попробуйте ещё раз.");
        return;
      }
      if (result?.success !== true) throw new Error("Unexpected registration response");
      setFormState("success");
      setFormMessage(result.duplicate ? "Заявка на этот номер уже получена. До встречи на фестивале!" : "Заявка принята! До встречи на фестивале");
      form.reset();
      request.current = null;
    } catch {
      setFormState("error");
      setFormMessage("Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <section id="registration" className={styles.registration} aria-labelledby="registration-title">
      <h2 id="registration-title" className={styles.heading}>Займи место</h2>
      {predictions.length > 0 && <p className={styles.subtitle}>А еще у нас есть предсказание для тебя</p>}
      <div className={styles.columns} data-predictions={predictions.length > 0}>
        <form className={styles.form} onSubmit={submitForm} aria-busy={formState === "submitting"}>
          <fieldset className={styles.fields} disabled={formState === "submitting"} aria-label="Регистрация на фестиваль">
            <label className={styles.field}>
              <span>Фамилия и имя</span>
              <input type="text" name="name" placeholder="Как тебя зовут?" autoComplete="name" required minLength={2} maxLength={120} pattern={String.raw`.*\S.*`} />
            </label>
            <label className={styles.field}>
              <span>Номер телефона</span>
              <PhoneInput />
            </label>
            <label className={styles.field}>
              <span>Компания или ВУЗ</span>
              <input className={styles.company} type="text" name="company" placeholder="Где работаешь или учишься?" autoComplete="organization" maxLength={200} />
            </label>
            <label className={styles.consent}>
              <input type="checkbox" name="consent" required />
              <span>Я даю <a href="/documents/personal-data-consent.pdf" target="_blank" rel="noopener noreferrer">согласие на обработку персональных данных</a> в соответствии с <a href="/documents/personal-data-policy.pdf" target="_blank" rel="noopener noreferrer">политикой конфиденциальности</a></span>
            </label>
            <Button variant="pink" icon="arrow" type="submit" className={styles.submit}>{formState === "submitting" ? "отправляем…" : "зарегистрироваться"}</Button>
            <p className={styles.formMessage} data-status={formState} role={formState === "error" ? "alert" : "status"}>{formMessage}</p>
          </fieldset>
        </form>

        {predictions.length > 0 && <div className={styles.prediction}>
          <h3>Предсказание на год<br />для твоего бизнеса</h3>
          {!currentPrediction ? (
            <>
              <picture>
                <source media="(max-width: 767px)" srcSet="/assets/page/mobile/reg-star-left.webp" width={242} height={160} />
                <Image src="/assets/page/prediction-star-left.webp" width={258} height={185} alt="" className={styles.starLeft} sizes="(max-width: 767px) 62vw, 258px" />
              </picture>
              <picture>
                <source media="(max-width: 767px)" srcSet="/assets/page/mobile/reg-star-right.webp" width={115} height={80} />
                <Image src="/assets/page/prediction-star-right.webp" width={158} height={93} alt="" className={styles.starRight} sizes="(max-width: 767px) 30vw, 158px" />
              </picture>
              <Image src="/assets/page/prediction-person.webp" width={447} height={362} alt="Девушка с хрустальным шаром" className={styles.person} sizes="(max-width: 767px) 75vw, 447px" />
            </>
          ) : (
            <div key={currentPrediction.id} className={styles.paper}>
              <picture>
                <source media="(max-width: 767px)" srcSet="/assets/mobile/prediction-paper-shadow.webp" width={311.5} height={203.5} />
                <Image src="/assets/page/prediction-paper-shadow.webp" width={449} height={214.5} alt="" className={styles.paperShadow} sizes="(max-width: 1100px) 80vw, 32vw" />
              </picture>
              <picture>
                <source media="(max-width: 767px)" srcSet="/assets/mobile/prediction-paper.svg" width={312} height={204} />
                <Image src="/assets/page/prediction-paper.svg" width={449} height={215} alt="" className={styles.paperShape} />
              </picture>
              <PredictionText text={currentPrediction.text} />
            </div>
          )}
          <Button className={styles.predictionButton} onClick={() => setPredictionId(predictions[(predictions.findIndex((item) => item.id === predictionId) + 1) % predictions.length].id)}>
            {!currentPrediction ? "получить предсказание" : "еще одно предсказание"}
            {currentPrediction && <picture className={styles.refreshIcon}>
              <source media="(max-width: 767px)" srcSet="/assets/mobile/prediction-refresh.svg" />
              <Image src="/assets/figma/refresh.svg" width={20} height={20} alt="" aria-hidden="true" />
            </picture>}
          </Button>
        </div>}
      </div>
    </section>
  );
}

export function FestivalFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <span className={styles.date}>20 ноября</span>
        <div className={styles.socials} aria-label="Социальные сети фестиваля">
          <a href="https://t.me/pdrmru" target="_blank" rel="noopener noreferrer" aria-label="Telegram фестиваля">
            <Image src="/assets/page/telegram.svg" width={50} height={50} alt="" />
          </a>
        </div>
      </div>
      <p className={styles.footerSubtitle}>Фестиваль молодых предпринимателей</p>
      <a href="#home" className={styles.wordmark}>предпринимай</a>
      <div className={styles.footerBottom}>
        <a href="/documents/personal-data-policy.pdf" target="_blank" rel="noopener noreferrer" className={styles.privacy}>Политика обработки персональных данных</a>
        <a href="/documents/personal-data-consent.pdf" target="_blank" rel="noopener noreferrer" className={styles.privacy}>Согласие на обработку персональных данных</a>
      </div>
    </footer>
  );
}
