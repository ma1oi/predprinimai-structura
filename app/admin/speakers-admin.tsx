"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Speaker, SpeakerDocument } from "@/lib/speaker-types";
import { RegistrationsAdmin } from "./registrations-admin";
import { ProgramSpeakersAdmin } from "./program-speakers-admin";
import { PartnersAdmin } from "./partners-admin";
import { PredictionsAdmin } from "./predictions-admin";
import styles from "./admin.module.css";

type Session = "checking" | "guest" | "authenticated";
type Confirmation = "reload" | "logout" | null;
type AdminSection = "speakers" | "registrations" | "program" | "partners" | "predictions";

function currentSection(): AdminSection {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "registrations" || tab === "program" || tab === "partners" || tab === "predictions" ? tab : "speakers";
}

class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error || "Не удалось выполнить запрос. Попробуйте ещё раз.", response.status);
  return body as T;
}

function Arrow({ down = false }: { down?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={down ? { transform: "rotate(180deg)" } : undefined}><path d="m5 9 5-5 5 5M10 4v12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function SpeakersAdmin() {
  const [session, setSession] = useState<Session>("checking");
  const [section, setSection] = useState<AdminSection>("speakers");
  const [programState, setProgramState] = useState({ dirty: false, busy: false });
  const [programKey, setProgramKey] = useState(0);
  const [partnersState, setPartnersState] = useState({ dirty: false, busy: false });
  const [partnersKey, setPartnersKey] = useState(0);
  const [predictionsState, setPredictionsState] = useState({ dirty: false, busy: false });
  const [predictionsKey, setPredictionsKey] = useState(0);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [revision, setRevision] = useState("");
  const [saved, setSaved] = useState("[]");
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const dirty = loaded && JSON.stringify(speakers) !== saved;
  const selected = speakers.find((speaker) => speaker.id === selectedId);
  const locked = busy || uploading || programState.busy || partnersState.busy || predictionsState.busy;

  const expireSession = useCallback(() => {
    setSession("guest");
    setError("Время входа истекло. Войдите снова — ваши изменения остались в этой вкладке.");
  }, []);

  const handleError = useCallback((reason: unknown) => {
    const message = reason instanceof Error ? reason.message : "Произошла ошибка. Попробуйте ещё раз.";
    if (reason instanceof ApiError && reason.status === 401) {
      expireSession();
    } else {
      setError(message);
      if (reason instanceof ApiError && reason.status === 409) setConflict(true);
    }
  }, [expireSession]);

  const loadSpeakers = useCallback(async () => {
    const document = await request<SpeakerDocument>("/api/admin/speakers");
    setSpeakers(document.speakers);
    setRevision(document.revision);
    setSaved(JSON.stringify(document.speakers));
    setSelectedId((current) => document.speakers.some((speaker) => speaker.id === current) ? current : document.speakers[0]?.id ?? null);
    setLoaded(true);
    setConflict(false);
    setDeleteId(null);
    setConfirmation(null);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const result = await request<{ authenticated: boolean; configured: boolean }>("/api/admin/session");
        if (!active) return;
        setSection(currentSection());
        setConfigured(result.configured);
        setSession(result.authenticated ? "authenticated" : "guest");
        if (result.authenticated) {
          setBusy(true);
          await loadSpeakers();
        }
      } catch (reason) {
        if (active) { setSession("guest"); handleError(reason); }
      } finally { if (active) setBusy(false); }
    }
    void initialize();
    return () => { active = false; };
  }, [handleError, loadSpeakers]);

  useEffect(() => {
    const syncSection = () => setSection(currentSection());
    window.addEventListener("popstate", syncSection);
    return () => window.removeEventListener("popstate", syncSection);
  }, []);

  function changeSection(next: AdminSection) {
    setSection(next);
    const url = new URL(window.location.href);
    if (next !== "speakers") url.searchParams.set("tab", next);
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  useEffect(() => {
    if (!dirty && !uploading) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, uploading]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      await request("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      setSession("authenticated"); setPassword("");
      if (!loaded) await loadSpeakers();
    } catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError("");
    try {
      await request("/api/admin/session", { method: "DELETE" });
      setSession("guest"); setSpeakers([]); setSaved("[]"); setLoaded(false); setRevision("");
      setSelectedId(null); setConfirmation(null); setSuccess(""); setConflict(false);
      setProgramKey((current) => current + 1); setProgramState({ dirty: false, busy: false });
      setPartnersKey((current) => current + 1); setPartnersState({ dirty: false, busy: false });
      setPredictionsKey((current) => current + 1); setPredictionsState({ dirty: false, busy: false });
    } catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }

  function updateSpeaker(patch: Partial<Speaker>) {
    setSpeakers((current) => current.map((speaker) => speaker.id === selectedId ? { ...speaker, ...patch } : speaker));
    setSuccess("");
  }

  function addSpeaker() {
    const speaker: Speaker = { id: crypto.randomUUID(), name: "", job: "", topic: "", time: "", photo: "", color: "lavender", published: false, art: "blue" };
    setSpeakers((current) => [...current, speaker]); setSelectedId(speaker.id); setDeleteId(null); setSuccess("");
    window.requestAnimationFrame(() => editorRef.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus());
  }

  function moveSpeaker(index: number, direction: number) {
    setSpeakers((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
    setSuccess("");
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !selectedId) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) { setError("Выберите фото в формате JPG, PNG, WebP или AVIF."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Фото должно весить не больше 8 МБ."); return; }
    const targetId = selectedId;
    const form = new FormData(); form.set("file", file);
    setUploading(true); setError(""); setSuccess("");
    try {
      const result = await request<{ url: string }>("/api/admin/upload", { method: "POST", body: form });
      setSpeakers((current) => current.map((speaker) => speaker.id === targetId ? { ...speaker, photo: result.url } : speaker));
    } catch (reason) { handleError(reason); }
    finally { setUploading(false); }
  }

  async function save() {
    const invalid = speakers.find((speaker) => !speaker.name.trim());
    if (invalid) { setSelectedId(invalid.id); setError("Укажите имя спикера перед сохранением."); window.requestAnimationFrame(() => editorRef.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus()); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const document = await request<SpeakerDocument>("/api/admin/speakers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ speakers, revision }) });
      setSpeakers(document.speakers); setRevision(document.revision); setSaved(JSON.stringify(document.speakers));
      setConflict(false); setSuccess("Сохранено. Опубликованные спикеры уже на сайте.");
    } catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }

  async function reload() {
    setBusy(true); setError(""); setSuccess("");
    try { await loadSpeakers(); }
    catch (reason) { handleError(reason); }
    finally { setBusy(false); }
  }

  const notices = <>
    {error && <div className={styles.error} role="alert"><p>{error}</p>{conflict && <><p>Список изменился в другой вкладке. Ваши правки сохранены здесь. Загрузите актуальный список, чтобы продолжить.</p><button className={styles.secondary} disabled={locked} onClick={() => setConfirmation("reload")}>Загрузить актуальный список</button></>}</div>}
    {success && <p className={styles.success} role="status">{success}</p>}
    {confirmation && <div className={styles.confirmation} role="alert"><p>{confirmation === "reload" ? "Загрузить список с сервера? Несохранённые правки в этой вкладке будут потеряны." : "Выйти без сохранения? Несохранённые правки будут потеряны."}</p><div className={styles.actions}><button className={styles.danger} disabled={locked} onClick={() => void (confirmation === "reload" ? reload() : logout())}>{confirmation === "reload" ? "Загрузить и заменить правки" : "Выйти без сохранения"}</button><button className={styles.secondary} disabled={locked} onClick={() => setConfirmation(null)}>Продолжить редактирование</button></div></div>}
  </>;

  return <div className={styles.shell}>
    <header className={styles.header}><a className={styles.brand} href="/" target="_blank" rel="noopener noreferrer">предпринимай</a><span className={styles.headerLabel}>Управление сайтом</span>{session === "authenticated" && <button className={styles.logout} disabled={locked} onClick={() => dirty || programState.dirty || partnersState.dirty || predictionsState.dirty ? setConfirmation("logout") : void logout()}>Выйти</button>}</header>
    {session === "checking" ? <main className={styles.login}><h1>Вход в управление</h1><p role="status">Проверяем вход…</p></main> : session === "guest" ? <main className={styles.login}>
      <h1>Управление сайтом</h1><p className={styles.muted}>Войдите, чтобы редактировать спикеров, партнёров, предсказания и фотографии в программе, просматривать заявки и скачивать их в Excel.</p>
      {notices}
      {!configured ? <p className={styles.error} role="alert">Вход ещё не настроен. Добавьте пароль администратора в настройки сервера.</p> : <form onSubmit={login} className={styles.loginForm}><label htmlFor="admin-password">Пароль администратора</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} autoFocus /><button className={styles.primary} type="submit" disabled={busy || !password}>{busy ? "Входим…" : "Войти"}</button></form>}
      <a className={styles.textLink} href="/" target="_blank" rel="noopener noreferrer">Открыть сайт</a>
    </main> : null}
    <main className={styles.main} hidden={session !== "authenticated"}>
      <nav className={styles.sectionNav} aria-label="Разделы управления"><button type="button" aria-pressed={section === "speakers"} aria-controls="speakers-section" onClick={() => changeSection("speakers")}>Спикеры{dirty && <><span className={styles.unsavedDot} aria-hidden="true" /><span className={styles.srOnly}> — есть несохранённые изменения</span></>}</button><button type="button" aria-pressed={section === "registrations"} aria-controls="registrations-section" onClick={() => changeSection("registrations")}>Заявки</button><button type="button" aria-pressed={section === "program"} aria-controls="program-section" onClick={() => changeSection("program")}>Программа{programState.dirty && <><span className={styles.unsavedDot} aria-hidden="true" /><span className={styles.srOnly}> — есть несохранённые изменения</span></>}</button><button type="button" aria-pressed={section === "partners"} aria-controls="partners-section" onClick={() => changeSection("partners")}>Партнёры{partnersState.dirty && <><span className={styles.unsavedDot} aria-hidden="true" /><span className={styles.srOnly}> — есть несохранённые изменения</span></>}</button><button type="button" aria-pressed={section === "predictions"} aria-controls="predictions-section" onClick={() => changeSection("predictions")}>Предсказания{predictionsState.dirty && <><span className={styles.unsavedDot} aria-hidden="true" /><span className={styles.srOnly}> — есть несохранённые изменения</span></>}</button></nav>
      {notices}
      <section id="registrations-section" aria-label="Заявки" hidden={section !== "registrations"}>{session === "authenticated" && section === "registrations" && <RegistrationsAdmin onSessionExpired={expireSession} />}</section>
      <section id="program-section" aria-label="Программа" hidden={section !== "program"}><ProgramSpeakersAdmin key={programKey} active={session === "authenticated" && section === "program"} onSessionExpired={expireSession} onStateChange={setProgramState} /></section>
      <section id="partners-section" aria-label="Партнёры" hidden={section !== "partners"}><PartnersAdmin key={partnersKey} active={session === "authenticated" && section === "partners"} onSessionExpired={expireSession} onStateChange={setPartnersState} /></section>
      <section id="predictions-section" aria-label="Предсказания" hidden={section !== "predictions"}><PredictionsAdmin key={predictionsKey} active={session === "authenticated" && section === "predictions"} onSessionExpired={expireSession} onStateChange={setPredictionsState} /></section>
      <section id="speakers-section" aria-label="Спикеры" hidden={section !== "speakers"}>
      <div className={styles.pageHeading}><div><h1>Спикеры</h1><p className={styles.muted}>Карточки, порядок и видимость на сайте фестиваля.</p></div><a className={styles.previewLink} href="/#speakers" target="_blank" rel="noopener noreferrer">Посмотреть на сайте <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 4h10v10M16 4 4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></a></div>
      {!loaded ? <section className={styles.loading} aria-busy={busy}><h2>{busy ? "Загружаем спикеров…" : "Не удалось загрузить список"}</h2>{!busy && <button className={styles.secondary} onClick={() => void reload()}>Повторить загрузку</button>}</section> : <>
        <div className={styles.workspace}>
          <section className={styles.listPanel} aria-labelledby="speaker-list-heading"><div className={styles.listHeading}><h2 id="speaker-list-heading">На сайте <span>{speakers.filter((speaker) => speaker.published).length} из {speakers.length}</span></h2><button className={styles.addButton} onClick={addSpeaker} disabled={locked || speakers.length >= 100}>Добавить спикера</button></div><p className={styles.listHint}>Порядок в списке — порядок карточек на сайте.</p>
            {speakers.length === 0 ? <div className={styles.empty}><h3>Добавьте первого спикера</h3><p>Загрузите фото и заполните карточку. Включите «Показывать на сайте», когда всё готово.</p><button className={styles.primary} onClick={addSpeaker} disabled={locked}>Добавить спикера</button></div> : <ol className={styles.speakerList}>{speakers.map((speaker, index) => <li key={speaker.id} className={`${styles.speakerRow} ${selectedId === speaker.id ? styles.selected : ""}`}><button className={styles.selectSpeaker} onClick={() => { setSelectedId(speaker.id); setDeleteId(null); }} disabled={locked} aria-pressed={selectedId === speaker.id}><span className={`${styles.avatar} ${styles[speaker.color]}`}>{speaker.photo ? <Image src={speaker.photo} alt="" width={56} height={68} unoptimized /> : <span aria-hidden="true">{speaker.name.trim().charAt(0) || "?"}</span>}</span><span className={styles.rowText}><strong>{speaker.name || "Новый спикер"}</strong><span className={styles.rowJob}>{speaker.job || "Должность не указана"}</span><span className={speaker.published ? styles.published : styles.draft}>{speaker.published ? "На сайте" : "Скрыт"}</span></span></button><div className={styles.reorder}><button aria-label={`Поднять ${speaker.name || "нового спикера"}`} title="Поднять" disabled={locked || index === 0} onClick={() => moveSpeaker(index, -1)}><Arrow /></button><button aria-label={`Опустить ${speaker.name || "нового спикера"}`} title="Опустить" disabled={locked || index === speakers.length - 1} onClick={() => moveSpeaker(index, 1)}><Arrow down /></button></div></li>)}</ol>}
            {speakers.length >= 100 && <p className={styles.listHint}>Достигнут лимит: 100 спикеров.</p>}
          </section>
          <section ref={editorRef} className={styles.editor} aria-labelledby="speaker-editor-heading">
            {selected ? <><div className={styles.editorHeading}><h2 id="speaker-editor-heading">Карточка спикера</h2><span className={styles.position}>{speakers.findIndex((speaker) => speaker.id === selected.id) + 1} / {speakers.length}</span></div>
              <fieldset disabled={locked} className={styles.fields}><legend className={styles.srOnly}>Данные спикера</legend><div className={styles.photoField}><div className={`${styles.photoPreview} ${styles[selected.color]}`}>{selected.photo ? <Image src={selected.photo} alt={`Фото: ${selected.name || "спикер"}`} width={116} height={142} unoptimized /> : <span>Фото<br />спикера</span>}</div><div className={styles.photoControls}><label htmlFor="speaker-photo">Фотография</label><input ref={uploadRef} id="speaker-photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-describedby="photo-help" className={styles.fileInput} onChange={(event) => void uploadPhoto(event)} /><button className={styles.secondary} type="button" onClick={() => uploadRef.current?.click()}>{uploading ? "Загружаем…" : selected.photo ? "Заменить фото" : "Загрузить фото"}</button><p id="photo-help">JPG, PNG, WebP или AVIF, до 8 МБ.<br />Лучше вертикальный портрет.</p>{selected.photo && <button className={styles.removePhoto} type="button" onClick={() => updateSpeaker({ photo: "" })}>Убрать фото</button>}</div></div>
                <div className={styles.field}><label htmlFor="speaker-name">Имя и фамилия <span>обязательно</span></label><input id="speaker-name" name="name" maxLength={120} autoComplete="off" required value={selected.name} onChange={(event) => updateSpeaker({ name: event.target.value })} placeholder="Например, Анна Смирнова" /></div>
                <div className={styles.field}><label htmlFor="speaker-job">Должность и компания</label><textarea id="speaker-job" rows={2} maxLength={300} value={selected.job} onChange={(event) => updateSpeaker({ job: event.target.value })} placeholder="Основатель компании…" /></div>
                <div className={styles.field}><label htmlFor="speaker-topic">Тема выступления</label><textarea id="speaker-topic" rows={3} maxLength={300} value={selected.topic} onChange={(event) => updateSpeaker({ topic: event.target.value })} placeholder="О чём расскажет спикер" /></div>
                <div className={styles.field}><label htmlFor="speaker-time">Время выступления</label><input id="speaker-time" maxLength={80} value={selected.time} onChange={(event) => updateSpeaker({ time: event.target.value })} placeholder="Например, 12:30–13:00" /></div>
                <label className={styles.visibility}><input type="checkbox" checked={selected.published} onChange={(event) => updateSpeaker({ published: event.target.checked })} /><span><strong>Показывать на сайте</strong><span>Карточка появится после сохранения изменений.</span></span></label>
              </fieldset>
              <div className={styles.deleteArea}>{deleteId === selected.id ? <div className={styles.deleteConfirmation}><p>Удалить {selected.name || "этого спикера"}? Карточка исчезнет с сайта после сохранения.</p><div className={styles.actions}><button className={styles.danger} disabled={locked} onClick={() => { const remaining = speakers.filter((speaker) => speaker.id !== selected.id); setSpeakers(remaining); setSelectedId(remaining[0]?.id ?? null); setDeleteId(null); setSuccess(""); }}>Да, удалить</button><button className={styles.secondary} disabled={locked} onClick={() => setDeleteId(null)}>Отмена</button></div></div> : <button className={styles.removePhoto} disabled={locked} onClick={() => setDeleteId(selected.id)}>Удалить спикера</button>}</div>
            </> : <div className={styles.editorEmpty}><h2 id="speaker-editor-heading">Редактор карточки</h2><p>Выберите спикера из списка или добавьте нового.</p></div>}
          </section>
        </div>
        <div className={styles.saveBar}><div aria-live="polite"><strong>{uploading ? "Загружаем фотографию…" : busy ? "Сохраняем изменения…" : dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}</strong><p>{dirty ? "Сохранение обновит спикеров на сайте." : "Можно открыть сайт и проверить карточки."}</p></div><button className={styles.primary} disabled={locked || !dirty || conflict} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить изменения"}</button></div>
      </>}
      </section>
    </main>
  </div>;
}
