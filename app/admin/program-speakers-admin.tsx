"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { ProgramSpeaker, ProgramSpeakerDocument, ProgramSpeakerId } from "@/lib/program-speaker-types";
import styles from "./admin.module.css";

interface Props {
  active: boolean;
  onSessionExpired: () => void;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
}

class ProgramApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ProgramApiError(body.error || "Не удалось выполнить запрос. Попробуйте ещё раз.", response.status);
  return body as T;
}

export function ProgramSpeakersAdmin({ active, onSessionExpired, onStateChange }: Props) {
  const [speakers, setSpeakers] = useState<ProgramSpeaker[]>([]);
  const [revision, setRevision] = useState("");
  const [saved, setSaved] = useState("[]");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<ProgramSpeakerId | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<ProgramSpeakerId, HTMLInputElement | null>>>({});
  const dirty = loaded && JSON.stringify(speakers) !== saved;
  const locked = busy || uploading !== null;

  const handleError = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : "Произошла ошибка. Попробуйте ещё раз.");
    if (reason instanceof ProgramApiError && reason.status === 401) onSessionExpired();
    if (reason instanceof ProgramApiError && reason.status === 409) setConflict(true);
  }, [onSessionExpired]);

  const load = useCallback(async () => {
    setBusy(true); setError(""); setSuccess("");
    try {
      const document = await request<ProgramSpeakerDocument>("/api/admin/program-speakers");
      setSpeakers(document.speakers); setRevision(document.revision); setSaved(JSON.stringify(document.speakers));
      setLoaded(true); setConflict(false); setConfirmReload(false);
    } catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }, [handleError]);

  useEffect(() => {
    let cancelled = false;
    // Defer initial loading so a hidden panel does not start a request when switching tabs.
    void Promise.resolve().then(() => { if (!cancelled && active && !loaded) return load(); });
    return () => { cancelled = true; };
  }, [active, loaded, load]);

  useEffect(() => { onStateChange({ dirty, busy: locked }); }, [dirty, locked, onStateChange]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function updateSpeaker(id: ProgramSpeakerId, patch: Partial<Omit<ProgramSpeaker, "id">>) {
    setSpeakers((current) => current.map((speaker) => speaker.id === id ? { ...speaker, ...patch } : speaker));
    setSuccess("");
  }

  function addEvent() {
    const id = crypto.randomUUID();
    setSpeakers((current) => [...current, { id, title: "", time: "17:00–17:30", description: "", name: "", job: "", photo: "" }]);
    setSuccess("");
    requestAnimationFrame(() => document.getElementById(`program-title-${id}`)?.focus());
  }

  function moveEvent(index: number, direction: number) {
    setSpeakers((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSuccess("");
  }

  async function uploadPhoto(id: ProgramSpeakerId, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) { setError("Выберите фото в формате JPG, PNG, WebP или AVIF."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Фото должно весить не больше 8 МБ."); return; }
    const form = new FormData(); form.set("file", file);
    setUploading(id); setError(""); setSuccess("");
    try {
      const result = await request<{ url: string }>("/api/admin/upload", { method: "POST", body: form });
      updateSpeaker(id, { photo: result.url });
    } catch (reason) { handleError(reason); }
    finally { setUploading(null); }
  }

  async function save() {
    const invalidEvent = speakers.find((speaker) => !speaker.title.trim() || !/^([01]\d|2[0-3]):[0-5]\d–([01]\d|2[0-3]):[0-5]\d$/.test(speaker.time) || speaker.time.split("–")[0] >= speaker.time.split("–")[1]);
    if (invalidEvent) {
      setError("Заполните название и время каждого пункта. Окончание должно быть позже начала.");
      document.getElementById(`program-${!invalidEvent.title.trim() ? "title" : "start"}-${invalidEvent.id}`)?.focus();
      return;
    }
    const invalid = speakers.find((speaker) => !speaker.name.trim() && (speaker.job.trim() || speaker.photo));
    if (invalid) {
      setError("Укажите имя спикера или очистите его описание и фото.");
      document.getElementById(`program-name-${invalid.id}`)?.focus();
      return;
    }
    setBusy(true); setError(""); setSuccess("");
    try {
      const document = await request<ProgramSpeakerDocument>("/api/admin/program-speakers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ speakers, revision }) });
      setSpeakers(document.speakers); setRevision(document.revision); setSaved(JSON.stringify(document.speakers));
      setConflict(false); setSuccess("Сохранено. Программа и её спикеры обновлены на сайте.");
    } catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }

  return <>
    <div className={styles.pageHeading}><div><h1>Программа и спикеры</h1><p className={styles.muted}>Расписание блока «Как пройдет день»: пункты, время и свои данные спикера для каждого пункта. Ниже — карточки карусели.</p></div><a className={styles.previewLink} href="/#schedule" target="_blank" rel="noopener noreferrer">Посмотреть на сайте <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 4h10v10M16 4 4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></a></div>
    {(error || conflict) && <div className={styles.error} role="alert"><p>{error || "Программа изменена в другой вкладке."}</p>{conflict && <><p>Ваши правки остались в этой вкладке. Загрузите актуальные данные, чтобы продолжить.</p><button className={styles.secondary} disabled={locked} onClick={() => setConfirmReload(true)}>Загрузить актуальные данные</button></>}</div>}
    {success && <p className={styles.success} role="status">{success}</p>}
    {confirmReload && <div className={styles.confirmation} role="alert"><p>Загрузить программу с сервера? Несохранённые правки в программе будут потеряны.</p><div className={styles.actions}><button className={styles.danger} disabled={locked} onClick={() => void load()}>Загрузить и заменить правки</button><button className={styles.secondary} disabled={locked} onClick={() => setConfirmReload(false)}>Продолжить редактирование</button></div></div>}
    {!loaded ? <section className={styles.loading} aria-busy={busy}><h2>{busy ? "Загружаем программу…" : "Не удалось загрузить программу"}</h2>{!busy && <button className={styles.secondary} onClick={() => void load()}>Повторить загрузку</button>}</section> : <>
      <div className={styles.listHeading}><h2>Расписание <span>{speakers.length} из 100</span></h2><button type="button" className={styles.addButton} disabled={locked || speakers.length >= 100} onClick={addEvent}>Добавить пункт</button></div>
      <p className={styles.listHint}>Пункты отображаются на сайте в этом порядке. Спикер необязателен. Если добавляете фото или должность, укажите его имя.</p>
      {speakers.length === 0 && <div className={styles.empty}><h3>В программе пока нет пунктов</h3><p>Добавьте первый пункт и укажите его время.</p></div>}
      <div className={styles.programPhotos}>{speakers.map((speaker, index) => {
        return <section key={speaker.id} className={styles.editor} aria-labelledby={`program-${speaker.id}-heading`}>
          <div className={styles.editorHeading}><h2 id={`program-${speaker.id}-heading`}>Пункт {index + 1}</h2><div className={styles.actions}><button type="button" className={styles.secondary} disabled={locked || index === 0} aria-label={`Поднять пункт ${index + 1}`} onClick={() => moveEvent(index, -1)}>Выше</button><button type="button" className={styles.secondary} disabled={locked || index === speakers.length - 1} aria-label={`Опустить пункт ${index + 1}`} onClick={() => moveEvent(index, 1)}>Ниже</button></div></div>
          <fieldset className={styles.fields} disabled={locked}>
            <legend className={styles.srOnly}>Пункт программы {index + 1}</legend>
            <div className={styles.field}><label htmlFor={`program-title-${speaker.id}`}>Название пункта <span>обязательно</span></label><textarea id={`program-title-${speaker.id}`} rows={3} maxLength={300} required value={speaker.title} onChange={(event) => updateSpeaker(speaker.id, { title: event.target.value })} /></div>
            <div className={styles.programTimes}>{(["start", "end"] as const).map((part, timeIndex) => <div key={part} className={styles.field}><label htmlFor={`program-${part}-${speaker.id}`}>{part === "start" ? "Начало" : "Окончание"}</label><input id={`program-${part}-${speaker.id}`} type="time" required value={speaker.time.split("–")[timeIndex] || ""} onChange={(event) => { const times = speaker.time.split("–"); times[timeIndex] = event.target.value; updateSpeaker(speaker.id, { time: times.join("–") }); }} /></div>)}</div>
            <div className={styles.field}><label htmlFor={`program-description-${speaker.id}`}>Описание пункта</label><textarea id={`program-description-${speaker.id}`} rows={3} maxLength={2000} value={speaker.description} onChange={(event) => updateSpeaker(speaker.id, { description: event.target.value })} /></div>
            <h3 className={styles.programSpeakerHeading}>Спикер этого пункта</h3>
            <div className={styles.field}><label htmlFor={`program-name-${speaker.id}`}>Имя и фамилия спикера</label><input id={`program-name-${speaker.id}`} maxLength={120} autoComplete="off" value={speaker.name} onChange={(event) => updateSpeaker(speaker.id, { name: event.target.value })} placeholder="Например, Анна Смирнова" /></div>
            <div className={styles.field}><label htmlFor={`program-job-${speaker.id}`}>Должность и описание</label><textarea id={`program-job-${speaker.id}`} rows={3} maxLength={300} value={speaker.job} onChange={(event) => updateSpeaker(speaker.id, { job: event.target.value })} placeholder="Должность, компания или коротко о спикере" /></div>
            <div className={`${styles.photoField} ${styles.programPhotoField}`}>
              <div className={`${styles.photoPreview} ${styles.lavender}`}>{speaker.photo ? <Image src={speaker.photo} alt={`Фото: ${speaker.name || "спикер"}`} width={116} height={142} unoptimized /> : <span>Фото<br />не загружено</span>}</div>
              <div className={styles.photoControls}><label htmlFor={`program-photo-${speaker.id}`}>Фотография</label><input ref={(element) => { inputs.current[speaker.id] = element; }} id={`program-photo-${speaker.id}`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-describedby={`program-photo-help-${speaker.id}`} className={styles.fileInput} onChange={(event) => void uploadPhoto(speaker.id, event)} /><button type="button" className={styles.secondary} onClick={() => inputs.current[speaker.id]?.click()}>{uploading === speaker.id ? "Загружаем…" : speaker.photo ? "Заменить фото" : "Загрузить фото"}</button><p id={`program-photo-help-${speaker.id}`}>JPG, PNG, WebP или AVIF, до 8 МБ.<br />Фото необязательно.</p>{speaker.photo && <button type="button" className={styles.removePhoto} onClick={() => updateSpeaker(speaker.id, { photo: "" })}>Убрать фото</button>}</div>
            </div>
            {(speaker.name || speaker.job || speaker.photo) && <button type="button" className={styles.removePhoto} onClick={() => updateSpeaker(speaker.id, { name: "", job: "", photo: "" })}>Очистить данные спикера</button>}
          </fieldset>
          <div className={styles.deleteArea}>{deleteId === speaker.id ? <div className={styles.deleteConfirmation}><p>Удалить пункт «{speaker.title || "Без названия"}»? Он исчезнет с сайта после сохранения программы.</p><div className={styles.actions}><button type="button" className={styles.danger} disabled={locked} onClick={() => { setSpeakers((current) => current.filter((item) => item.id !== speaker.id)); setDeleteId(null); setSuccess(""); }}>Да, удалить пункт</button><button type="button" className={styles.secondary} disabled={locked} onClick={() => setDeleteId(null)}>Отмена</button></div></div> : <button type="button" className={styles.removePhoto} disabled={locked} onClick={() => setDeleteId(speaker.id)}>Удалить пункт</button>}</div>
        </section>;
      })}</div>
      <div className={styles.saveBar}><div aria-live="polite"><strong>{uploading ? "Загружаем фотографию…" : busy ? "Сохраняем программу…" : dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}</strong><p>{dirty ? "Сохранение обновит расписание и спикеров его пунктов на сайте." : "Можно открыть сайт и проверить программу."}</p></div><button type="button" className={styles.primary} disabled={locked || !dirty || conflict} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить программу"}</button></div>
    </>}
  </>;
}
