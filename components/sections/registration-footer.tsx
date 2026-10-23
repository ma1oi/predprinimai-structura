"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import type { RegistrationInput } from "@/lib/registration-types";
import styles from "./registration-footer.module.css";

const predictions = [
  "Твой следующий партнёр сидит через два ряда от тебя",
  "Случайная встреча станет началом большого проекта.",
  "Идея, которую ты откладываешь, найдёт своих людей.",
  "Твой следующий шаг окажется смелее, чем ты думаешь.",
  "Хороший разговор откроет новую возможность.",
  "Рядом окажется человек, с которым получится больше.",
  "Маленький эксперимент вырастет во что-то большое.",
];

export function RegistrationSection() {
  const [predictionIndex, setPredictionIndex] = useState(-1);
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
      <p className={styles.subtitle}>А еще у нас есть предсказание для тебя</p>
      <div className={styles.columns}>
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
              <span>Я даю согласие на обработку персональных данных в соответствии с политикой конфиденциальности</span>
            </label>
            <Button variant="pink" icon="arrow" type="submit" className={styles.submit}>{formState === "submitting" ? "отправляем…" : "зарегистрироваться"}</Button>
            <p className={styles.formMessage} data-status={formState} role={formState === "error" ? "alert" : "status"}>{formMessage}</p>
          </fieldset>
        </form>

        <div className={styles.prediction}>
          <h3>Предсказание на год<br />для твоего бизнеса</h3>
          {predictionIndex < 0 ? (
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
            <div key={predictionIndex} className={styles.paper}>
              <picture>
                <source media="(max-width: 767px)" srcSet="/assets/mobile/prediction-paper-shadow.webp" width={311.5} height={203.5} />
                <Image src="/assets/page/prediction-paper-shadow.webp" width={449} height={214.5} alt="" className={styles.paperShadow} sizes="(max-width: 1100px) 80vw, 32vw" />
              </picture>
              <picture>
                <source media="(max-width: 767px)" srcSet="/assets/mobile/prediction-paper.svg" width={312} height={204} />
                <Image src="/assets/page/prediction-paper.svg" width={449} height={215} alt="" className={styles.paperShape} />
              </picture>
              <p className={styles.paperText} role="status" aria-live="polite">{predictions[predictionIndex]}</p>
            </div>
          )}
          <Button className={styles.predictionButton} onClick={() => setPredictionIndex((current) => (current + 1) % predictions.length)}>
            {predictionIndex < 0 ? "получить предсказание" : "еще одно предсказание"}
            {predictionIndex >= 0 && <picture className={styles.refreshIcon}>
              <source media="(max-width: 767px)" srcSet="/assets/mobile/prediction-refresh.svg" />
              <Image src="/assets/figma/refresh.svg" width={20} height={20} alt="" aria-hidden="true" />
            </picture>}
          </Button>
        </div>
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
          <button type="button" disabled aria-label="Telegram — ссылка появится позже" title="Ссылка появится позже">
            <Image src="/assets/page/telegram.svg" width={50} height={50} alt="Telegram" />
          </button>
          <button type="button" disabled aria-label="ВКонтакте — ссылка появится позже" title="Ссылка появится позже">
            <Image src="/assets/page/vk.svg" width={50} height={50} alt="ВКонтакте" />
          </button>
        </div>
      </div>
      <p className={styles.footerSubtitle}>Фестиваль молодых предпринимателей</p>
      <a href="#home" className={styles.wordmark}>предпринимай</a>
      <div className={styles.footerBottom}>
        <button type="button" disabled title="Документ появится позже" className={styles.privacy}>Политика конфиденциальности</button>
      </div>
    </footer>
  );
}
