"use client";

import { useCallback, useEffect, useState } from "react";
import type { Prediction, PredictionDocument } from "@/lib/prediction-types";
import styles from "./admin.module.css";

interface Props {
  active: boolean;
  onSessionExpired: () => void;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
}
class PredictionApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/admin/predictions", { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new PredictionApiError(body.error || "Не удалось обновить предсказания. Попробуйте ещё раз.", response.status);
  return body as T;
}

export function PredictionsAdmin({ active, onSessionExpired, onStateChange }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [revision, setRevision] = useState("");
  const [saved, setSaved] = useState("[]");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const dirty = loaded && JSON.stringify(predictions) !== saved;

  const handleError = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : "Не удалось обновить предсказания.");
    if (reason instanceof PredictionApiError && reason.status === 401) onSessionExpired();
    if (reason instanceof PredictionApiError && reason.status === 409) setConflict(true);
  }, [onSessionExpired]);
  const load = useCallback(async () => {
    setBusy(true); setError(""); setSuccess("");
    try {
      const document = await request<PredictionDocument>();
      setPredictions(document.predictions); setSaved(JSON.stringify(document.predictions)); setRevision(document.revision);
      setLoaded(true); setConflict(false); setConfirmReload(false); setDeleteId(null);
    } catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }, [handleError]);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled && active && !loaded) return load(); });
    return () => { cancelled = true; };
  }, [active, loaded, load]);
  useEffect(() => { onStateChange({ dirty, busy }); }, [dirty, busy, onStateChange]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function update(id: string, patch: Partial<Prediction>) {
    setPredictions((current) => current.map((prediction) => prediction.id === id ? { ...prediction, ...patch } : prediction));
    setSuccess("");
  }
  function move(index: number, direction: number) {
    setPredictions((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
    setSuccess("");
  }
  async function save() {
    const invalid = predictions.find((item) => !item.text.trim());
    if (invalid) {
      setError("Заполните текст предсказания перед сохранением.");
      document.getElementById(`prediction-text-${invalid.id}`)?.focus();
      return;
    }
    setBusy(true); setError(""); setSuccess("");
    try {
      const document = await request<PredictionDocument>({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ predictions, revision }) });
      setPredictions(document.predictions); setSaved(JSON.stringify(document.predictions)); setRevision(document.revision);
      setConflict(false); setSuccess("Сохранено. Предсказания обновлены на сайте.");
    } catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }

  return <>
    <div className={styles.pageHeading}><div><h1>Предсказания</h1><p className={styles.muted}>Тексты на бумажке в блоке «Займи место». На сайте они появляются по очереди.</p></div><a className={styles.previewLink} href="/#registration" target="_blank" rel="noopener noreferrer">Посмотреть на сайте</a></div>
    {(error || conflict) && <div className={styles.error} role="alert"><p>{error || "Предсказания изменены в другой вкладке."}</p>{conflict && <><p>Ваши правки остались здесь. Загрузите актуальный список, чтобы продолжить.</p><button className={styles.secondary} type="button" disabled={busy} onClick={() => setConfirmReload(true)}>Загрузить актуальные предсказания</button></>}</div>}
    {success && <p className={styles.success} role="status">{success}</p>}
    {confirmReload && <div className={styles.confirmation} role="alert"><p>Загрузить список с сервера? Несохранённые предсказания будут потеряны.</p><div className={styles.actions}><button type="button" className={styles.danger} disabled={busy} onClick={() => void load()}>Загрузить и заменить правки</button><button type="button" className={styles.secondary} onClick={() => setConfirmReload(false)}>Продолжить редактирование</button></div></div>}
    {!loaded ? <section className={styles.loading} aria-busy={busy}><h2>{busy ? "Загружаем предсказания…" : "Не удалось загрузить предсказания"}</h2>{!busy && <button type="button" className={styles.secondary} onClick={() => void load()}>Повторить загрузку</button>}</section> : <>
      <div className={styles.partnerListHeading}><p className={styles.muted}>На сайте: {predictions.filter((item) => item.published).length} из {predictions.length}. До 100 символов в каждом тексте.</p><button type="button" className={styles.primary} disabled={busy || predictions.length >= 100} onClick={() => { setPredictions((current) => [...current, { id: crypto.randomUUID(), text: "", published: false }]); setSuccess(""); }}>Добавить предсказание</button></div>
      {!predictions.length && <div className={styles.registrationEmpty}><h2>Предсказаний пока нет</h2><p>Добавьте текст и включите показ на сайте.</p></div>}
      <div className={styles.predictionEditors}>{predictions.map((item, index) => <section key={item.id} className={styles.editor} aria-label={`Предсказание ${index + 1}`}>
        <div className={styles.editorHeading}><h2>Предсказание {index + 1}</h2><span className={styles.position}>{index + 1} / {predictions.length}</span></div>
        <fieldset className={styles.fields} disabled={busy}><legend className={styles.srOnly}>Редактирование предсказания {index + 1}</legend>
          <div className={styles.field}><label htmlFor={`prediction-text-${item.id}`}>Текст предсказания</label><textarea id={`prediction-text-${item.id}`} rows={3} maxLength={100} required value={item.text} onChange={(event) => update(item.id, { text: event.target.value })} aria-describedby={`prediction-count-${item.id}`} placeholder="Например, случайная встреча станет началом большого проекта" /><p id={`prediction-count-${item.id}`} className={styles.muted}>{item.text.length} / 100 символов</p></div>
          <p className={styles.predictionPreview} aria-hidden="true">{item.text || "Здесь появится ваше предсказание"}</p>
          <label className={styles.visibility}><input type="checkbox" checked={item.published} onChange={(event) => update(item.id, { published: event.target.checked })} /><span><strong>Показывать на сайте</strong><span>Изменения появятся после сохранения.</span></span></label>
        </fieldset>
        <div className={styles.partnerRowActions}><button type="button" className={styles.secondary} disabled={busy || index === 0} aria-label={`Поднять предсказание ${index + 1}`} onClick={() => move(index, -1)}>Выше</button><button type="button" className={styles.secondary} disabled={busy || index === predictions.length - 1} aria-label={`Опустить предсказание ${index + 1}`} onClick={() => move(index, 1)}>Ниже</button><button type="button" className={styles.removePhoto} disabled={busy} onClick={() => setDeleteId(item.id)}>Удалить предсказание</button></div>
        {deleteId === item.id && <div className={styles.deleteConfirmation}><p>Удалить это предсказание? Оно исчезнет с сайта после сохранения.</p><div className={styles.actions}><button type="button" className={styles.danger} disabled={busy} onClick={() => { setPredictions((current) => current.filter((prediction) => prediction.id !== item.id)); setDeleteId(null); setSuccess(""); }}>Да, удалить</button><button type="button" className={styles.secondary} onClick={() => setDeleteId(null)}>Отмена</button></div></div>}
      </section>)}</div>
      <div className={styles.saveBar}><div aria-live="polite"><strong>{busy ? "Сохраняем предсказания…" : dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}</strong><p>{dirty ? "Сохранение обновит тексты на сайте." : "Порядок карточек задаёт порядок предсказаний."}</p></div><button type="button" className={styles.primary} disabled={busy || !dirty || conflict} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить предсказания"}</button></div>
    </>}
  </>;
}
