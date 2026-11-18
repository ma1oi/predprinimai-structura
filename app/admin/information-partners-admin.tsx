"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { InformationPartner, InformationPartnerDocument } from "@/lib/information-partner-types";
import styles from "./admin.module.css";

interface Props {
  active: boolean;
  onSessionExpired: () => void;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
}

class InformationPartnerApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new InformationPartnerApiError(body.error || "Не удалось выполнить запрос. Попробуйте ещё раз.", response.status);
  return body as T;
}

export function InformationPartnersAdmin({ active, onSessionExpired, onStateChange }: Props) {
  const [partners, setInformationPartners] = useState<InformationPartner[]>([]);
  const [revision, setRevision] = useState("");
  const [saved, setSaved] = useState("[]");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const dirty = loaded && JSON.stringify(partners) !== saved;
  const locked = busy || uploading !== null;

  const handleError = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : "Не удалось обновить партнёров.");
    if (reason instanceof InformationPartnerApiError && reason.status === 401) onSessionExpired();
    if (reason instanceof InformationPartnerApiError && reason.status === 409) setConflict(true);
  }, [onSessionExpired]);

  const load = useCallback(async () => {
    setBusy(true); setError(""); setSuccess("");
    try {
      const document = await request<InformationPartnerDocument>("/api/admin/information-partners");
      setInformationPartners(document.partners); setSaved(JSON.stringify(document.partners)); setRevision(document.revision);
      setLoaded(true); setConflict(false); setConfirmReload(false); setDeleteId(null);
    } catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }, [handleError]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled && active && !loaded) return load(); });
    return () => { cancelled = true; };
  }, [active, loaded, load]);
  useEffect(() => { onStateChange({ dirty, busy: locked }); }, [dirty, locked, onStateChange]);
  useEffect(() => {
    if (!dirty && !uploading) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, uploading]);

  function updateInformationPartner(id: string, patch: Partial<InformationPartner>) {
    setInformationPartners((current) => current.map((partner) => partner.id === id ? { ...partner, ...patch } : partner));
    setSuccess("");
  }
  function move(index: number, direction: number) {
    setInformationPartners((current) => {
      const updated = [...current];
      [updated[index], updated[index + direction]] = [updated[index + direction], updated[index]];
      return updated;
    });
    setSuccess("");
  }
  async function uploadPhoto(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) { setError("Выберите фото в формате PNG, WebP, JPG или AVIF."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Фото должен весить не больше 8 МБ."); return; }
    const form = new FormData(); form.set("file", file);
    setUploading(id); setError(""); setSuccess("");
    try {
      const result = await request<{ url: string }>("/api/admin/upload", { method: "POST", body: form });
      updateInformationPartner(id, { photo: result.url });
    } catch (reason) { handleError(reason); }
    finally { setUploading(null); }
  }
  async function save() {
    const invalid = partners.find((partner) => !partner.name.trim() || (partner.published && (!partner.photo || !partner.socialUrl.trim())));
    if (invalid) {
      setError("Укажите имя. Для публикации нужны фотография и ссылка на соцсеть.");
      document.getElementById(`information-name-${invalid.id}`)?.focus();
      return;
    }
    setBusy(true); setError(""); setSuccess("");
    try {
      const document = await request<InformationPartnerDocument>("/api/admin/information-partners", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partners, revision }) });
      setInformationPartners(document.partners); setSaved(JSON.stringify(document.partners)); setRevision(document.revision);
      setConflict(false); setSuccess("Сохранено. Информационные партнеры обновлены на сайте.");
    } catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }

  return <>
    <div className={styles.pageHeading}>
      <div><h1>Информационные партнеры</h1><p className={styles.muted}>Блогеры в ленте под формой регистрации. Порядок карточек задаёт порядок на сайте.</p></div>
      <a className={styles.previewLink} href="/#information-partners" target="_blank" rel="noopener noreferrer">Посмотреть ленту</a>
    </div>
    {(error || conflict) && <div className={styles.error} role="alert"><p>{error || "Список партнёров изменён в другой вкладке."}</p>{conflict && <><p>Ваши правки остались здесь. Загрузите актуальный список, чтобы продолжить.</p><button type="button" className={styles.secondary} disabled={locked} onClick={() => setConfirmReload(true)}>Загрузить актуальных партнёров</button></>}</div>}
    {success && <p className={styles.success} role="status">{success}</p>}
    {confirmReload && <div className={styles.confirmation} role="alert"><p>Загрузить список с сервера? Несохранённые изменения партнёров будут потеряны.</p><div className={styles.actions}><button type="button" className={styles.danger} disabled={locked} onClick={() => void load()}>Загрузить и заменить правки</button><button type="button" className={styles.secondary} onClick={() => setConfirmReload(false)}>Продолжить редактирование</button></div></div>}
    {!loaded ? <section className={styles.loading} aria-busy={busy}><h2>{busy ? "Загружаем партнёров…" : "Не удалось загрузить партнёров"}</h2>{!busy && <button type="button" className={styles.secondary} onClick={() => void load()}>Повторить загрузку</button>}</section> : <>
      <div className={styles.partnerListHeading}><p className={styles.muted}>В ленте: {partners.filter((partner) => partner.published && partner.photo).length} из {partners.length}</p><button type="button" className={styles.primary} disabled={locked || partners.length >= 100} onClick={() => { setInformationPartners((current) => [...current, { id: crypto.randomUUID(), name: "", photo: "", job: "", socialUrl: "", published: false }]); setSuccess(""); }}>Добавить партнёра</button></div>
      {!partners.length && <div className={styles.registrationEmpty}><h2>Партнёров пока нет</h2><p>Добавьте блогера, загрузите фото, укажите ссылку на соцсеть и включите показ в ленте.</p></div>}
      <div className={styles.partnerEditors}>{partners.map((partner, index) => <section key={partner.id} className={styles.editor} aria-label={partner.name || "Новый партнёр"}>
        <div className={styles.editorHeading}><h2>{partner.name || "Новый партнёр"}</h2><span className={styles.position}>{index + 1} / {partners.length}</span></div>
        <fieldset className={styles.fields} disabled={locked}>
          <legend className={styles.srOnly}>Данные партнёра {index + 1}</legend>
          <div className={styles.informationPhotoPreview}>{partner.photo ? <Image src={partner.photo} alt={`Фото: ${partner.name || "партнёр"}`} fill unoptimized sizes="180px" /> : <span>Фото не загружено</span>}</div>
          <div className={styles.photoControls}><label htmlFor={`information-photo-${partner.id}`}>Фото</label><input ref={(element) => { inputs.current[partner.id] = element; }} id={`information-photo-${partner.id}`} className={styles.fileInput} type="file" accept="image/png,image/webp,image/jpeg,image/avif" onChange={(event) => void uploadPhoto(partner.id, event)} /><button type="button" className={styles.secondary} onClick={() => inputs.current[partner.id]?.click()}>{uploading === partner.id ? "Загружаем…" : partner.photo ? "Заменить фото" : "Загрузить фото"}</button><p>PNG, WebP, JPG или AVIF, до 8 МБ. Лучше портрет по центру фотографии.</p>{partner.photo && <button type="button" className={styles.removePhoto} onClick={() => updateInformationPartner(partner.id, { photo: "", published: false })}>Убрать фото</button>}</div>
          <div className={styles.field}><label htmlFor={`information-name-${partner.id}`}>Имя и фамилия</label><input id={`information-name-${partner.id}`} value={partner.name} onChange={(event) => updateInformationPartner(partner.id, { name: event.target.value })} maxLength={160} autoComplete="off" required placeholder="Например, Анна Смирнова" /></div>
          <div className={styles.field}><label htmlFor={`information-job-${partner.id}`}>Должность или описание</label><textarea id={`information-job-${partner.id}`} value={partner.job} onChange={(event) => updateInformationPartner(partner.id, { job: event.target.value })} maxLength={300} rows={2} placeholder="Например, автор блога о бизнесе" /></div>
          <div className={styles.field}><label htmlFor={`information-social-${partner.id}`}>Ссылка на соцсеть</label><input id={`information-social-${partner.id}`} type="url" value={partner.socialUrl} onChange={(event) => updateInformationPartner(partner.id, { socialUrl: event.target.value })} maxLength={2048} autoComplete="off" placeholder="https://t.me/…" /></div>
          <label className={styles.visibility}><input type="checkbox" checked={partner.published} onChange={(event) => updateInformationPartner(partner.id, { published: event.target.checked })} /><span><strong>Показывать в ленте</strong><span>Фото появится после сохранения.</span></span></label>
        </fieldset>
        <div className={styles.partnerRowActions}><button type="button" className={styles.secondary} disabled={locked || index === 0} aria-label={`Поднять ${partner.name || "партнёра"}`} onClick={() => move(index, -1)}>Выше</button><button type="button" className={styles.secondary} disabled={locked || index === partners.length - 1} aria-label={`Опустить ${partner.name || "партнёра"}`} onClick={() => move(index, 1)}>Ниже</button><button type="button" className={styles.removePhoto} disabled={locked} onClick={() => setDeleteId(partner.id)}>Удалить</button></div>
        {deleteId === partner.id && <div className={styles.deleteConfirmation}><p>Удалить партнёра? После сохранения его фото исчезнет из ленты.</p><div className={styles.actions}><button type="button" className={styles.danger} disabled={locked} onClick={() => { setInformationPartners((current) => current.filter((item) => item.id !== partner.id)); setDeleteId(null); setSuccess(""); }}>Да, удалить</button><button type="button" className={styles.secondary} onClick={() => setDeleteId(null)}>Отмена</button></div></div>}
      </section>)}</div>
      <div className={styles.saveBar}><div aria-live="polite"><strong>{uploading ? "Загружаем фото…" : busy ? "Сохраняем партнёров…" : dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}</strong><p>{dirty ? "Сохранение обновит блок под формой регистрации." : "Фотографии показываются в круге; имена и ссылки — под ними."}</p></div><button type="button" className={styles.primary} disabled={locked || !dirty || conflict} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить партнёров"}</button></div>
    </>}
  </>;
}
