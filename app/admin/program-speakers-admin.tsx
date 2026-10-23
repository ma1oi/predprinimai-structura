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

  function updatePhoto(id: ProgramSpeakerId, photo: string) {
    setSpeakers((current) => current.map((speaker) => speaker.id === id ? { ...speaker, photo } : speaker));
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
      updatePhoto(id, result.url);
    } catch (reason) { handleError(reason); }
    finally { setUploading(null); }
  }

  async function save() {
    setBusy(true); setError(""); setSuccess("");
    try {
      const document = await request<ProgramSpeakerDocument>("/api/admin/program-speakers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ speakers, revision }) });
      setSpeakers(document.speakers); setRevision(document.revision); setSaved(JSON.stringify(document.speakers));
      setConflict(false); setSuccess("Сохранено. Фотографии в программе уже обновлены на сайте.");
    } catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }

  return <>
    <div className={styles.pageHeading}><div><h1>Программа</h1><p className={styles.muted}>Фотографии спикеров в блоке «Как пройдет день».</p></div><a className={styles.previewLink} href="/#schedule" target="_blank" rel="noopener noreferrer">Посмотреть на сайте <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 4h10v10M16 4 4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></a></div>
    {(error || conflict) && <div className={styles.error} role="alert"><p>{error || "Фотографии изменены в другой вкладке."}</p>{conflict && <><p>Ваши правки остались в этой вкладке. Загрузите актуальные фотографии, чтобы продолжить.</p><button className={styles.secondary} disabled={locked} onClick={() => setConfirmReload(true)}>Загрузить актуальные фотографии</button></>}</div>}
    {success && <p className={styles.success} role="status">{success}</p>}
    {confirmReload && <div className={styles.confirmation} role="alert"><p>Загрузить фотографии с сервера? Несохранённые правки в программе будут потеряны.</p><div className={styles.actions}><button className={styles.danger} disabled={locked} onClick={() => void load()}>Загрузить и заменить правки</button><button className={styles.secondary} disabled={locked} onClick={() => setConfirmReload(false)}>Продолжить редактирование</button></div></div>}
    {!loaded ? <section className={styles.loading} aria-busy={busy}><h2>{busy ? "Загружаем фотографии…" : "Не удалось загрузить фотографии"}</h2>{!busy && <button className={styles.secondary} onClick={() => void load()}>Повторить загрузку</button>}</section> : <>
      <div className={styles.programPhotos}>{speakers.map((speaker) => <section key={speaker.id} className={styles.editor} aria-labelledby={`program-${speaker.id}-heading`}><div className={styles.editorHeading}><h2 id={`program-${speaker.id}-heading`}>{speaker.name}</h2></div><fieldset className={styles.fields} disabled={locked}><legend className={styles.srOnly}>Фотография: {speaker.name}</legend><div className={`${styles.photoField} ${styles.programPhotoField}`}><div className={`${styles.photoPreview} ${styles.lavender}`}>{speaker.photo ? <Image src={speaker.photo} alt={`Фото: ${speaker.name}`} width={116} height={142} unoptimized /> : <span>Фото<br />не загружено</span>}</div><div className={styles.photoControls}><label htmlFor={`program-photo-${speaker.id}`}>Фотография</label><input ref={(element) => { inputs.current[speaker.id] = element; }} id={`program-photo-${speaker.id}`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-describedby={`program-photo-help-${speaker.id}`} className={styles.fileInput} onChange={(event) => void uploadPhoto(speaker.id, event)} /><button type="button" className={styles.secondary} onClick={() => inputs.current[speaker.id]?.click()}>{uploading === speaker.id ? "Загружаем…" : speaker.photo ? "Заменить фото" : "Загрузить фото"}</button><p id={`program-photo-help-${speaker.id}`}>JPG, PNG, WebP или AVIF, до 8 МБ.<br />Лучше вертикальный портрет.</p>{speaker.photo && <button type="button" className={styles.removePhoto} onClick={() => updatePhoto(speaker.id, "")}>Убрать фото</button>}</div></div></fieldset></section>)}</div>
      <div className={styles.saveBar}><div aria-live="polite"><strong>{uploading ? "Загружаем фотографию…" : busy ? "Сохраняем фотографии…" : dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}</strong><p>{dirty ? "Сохранение обновит фотографии в программе на сайте." : "Можно открыть сайт и проверить программу."}</p></div><button type="button" className={styles.primary} disabled={locked || !dirty || conflict} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить фотографии"}</button></div>
    </>}
  </>;
}
