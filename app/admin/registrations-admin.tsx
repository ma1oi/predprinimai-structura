"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Registration } from "@/lib/registration-types";
import type { YandexDiskSyncStatus } from "@/lib/yandex-disk-types";
import styles from "./admin.module.css";

const PAGE_SIZE = 50;
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Дата не указана" : dateFormatter.format(date);
}

function downloadFilename(disposition: string | null) {
  const fallback = "zayavki-predprinimai.xlsx";
  if (!disposition) return fallback;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  let filename = disposition.match(/filename="([^"]+)"/i)?.[1] ?? disposition.match(/filename=([^;]+)/i)?.[1];
  if (encoded) {
    try { filename = decodeURIComponent(encoded.trim()); }
    catch { return fallback; }
  }
  const safe = filename?.trim().replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").slice(0, 160);
  return safe && /\.xlsx$/i.test(safe) ? safe : fallback;
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export function RegistrationsAdmin({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [yandexDisk, setYandexDisk] = useState<YandexDiskSyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const listController = useRef<AbortController | null>(null);
  const exportController = useRef<AbortController | null>(null);
  const syncController = useRef<AbortController | null>(null);

  const load = useCallback((signal: AbortSignal) => {
    return fetch("/api/admin/registrations", { cache: "no-store", signal }).then(async (response) => {
      if (response.status === 401) { onSessionExpired(); return; }
      if (!response.ok) throw new Error(await responseError(response, "Не удалось загрузить заявки. Повторите загрузку."));
      const body: { registrations: Registration[]; yandexDisk?: YandexDiskSyncStatus } = await response.json();
      if (!Array.isArray(body.registrations)) throw new Error("Не удалось прочитать список заявок. Повторите загрузку.");
      if (!signal.aborted) {
        setRegistrations(body.registrations);
        setYandexDisk(body.yandexDisk ?? null);
        setLoaded(true);
      }
    }).catch((reason: unknown) => {
      if (!signal.aborted) setError(reason instanceof Error ? reason.message : "Не удалось загрузить заявки. Повторите загрузку.");
    }).finally(() => {
      if (!signal.aborted) setLoading(false);
    });
  }, [onSessionExpired]);

  useEffect(() => {
    const controller = new AbortController();
    listController.current = controller;
    void load(controller.signal);
    return () => { listController.current?.abort(); exportController.current?.abort(); syncController.current?.abort(); };
  }, [load]);

  function reload() {
    listController.current?.abort();
    const controller = new AbortController();
    listController.current = controller;
    setLoading(true);
    setError("");
    void load(controller.signal);
  }

  async function syncRegistrations() {
    if (syncing) return;
    const controller = new AbortController();
    syncController.current = controller;
    setSyncing(true);
    setSyncMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/registrations/sync", { method: "POST", signal: controller.signal });
      if (response.status === 401) { onSessionExpired(); return; }
      const body = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (body?.yandexDisk) setYandexDisk(body.yandexDisk);
      if (!response.ok) {
        if (!body?.yandexDisk) setError(body?.error || "Не удалось отправить заявки в Яндекс Диск. Попробуйте ещё раз.");
        return;
      }
      setSyncMessage(`Синхронизация завершена. Заявок сайта синхронизировано: ${body.yandexDisk.total}.`);
    } catch {
      if (!controller.signal.aborted) setError("Не удалось связаться с сервером. Заявки сохранены; повторите синхронизацию.");
    } finally {
      if (!controller.signal.aborted) setSyncing(false);
    }
  }

  async function exportRegistrations() {
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setError("");
    setExportMessage("");
    try {
      const response = await fetch("/api/admin/registrations/export", { cache: "no-store", signal: controller.signal });
      if (response.status === 401) { onSessionExpired(); return; }
      if (!response.ok) throw new Error(await responseError(response, "Не удалось скачать Excel. Попробуйте ещё раз."));
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadFilename(response.headers.get("Content-Disposition"));
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportMessage("Файл Excel подготовлен. Скачивание началось.");
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Не удалось скачать Excel. Попробуйте ещё раз.");
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru-RU");
    if (!query) return registrations;
    const digits = query.replace(/\D/g, "");
    return registrations.filter((registration) =>
      [registration.name, registration.phone, registration.company].some((value) => value.toLocaleLowerCase("ru-RU").includes(query))
      || (digits.length >= 3 && /^[+\d\s().-]+$/.test(query) && registration.phone.replace(/\D/g, "").includes(digits)),
    );
  }, [registrations, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return <>
    <div className={`${styles.pageHeading} ${styles.registrationHeading}`}>
      <div><h1>Заявки</h1><p className={styles.muted}>Регистрации участников фестиваля. Новые заявки — в начале списка.</p></div>
      <div className={styles.registrationActions}>
        <button className={styles.secondary} type="button" onClick={reload} disabled={loading}>{loading ? "Загружаем…" : "Обновить список"}</button>
        <button className={styles.primary} type="button" onClick={() => void exportRegistrations()} disabled={exporting || loading || !loaded || registrations.length === 0}>{exporting ? "Готовим Excel…" : "Скачать Excel"}</button>
      </div>
    </div>
    {error && <div className={styles.error} role="alert"><p>{error}</p></div>}
    {exportMessage && <p className={styles.success} role="status">{exportMessage}</p>}
    {yandexDisk && <section className={styles.yandexDiskPanel} aria-label="Синхронизация с Яндекс Диском" aria-busy={syncing}>
      <div><h2>Яндекс Таблицы</h2><p>{!yandexDisk.configured ? "Подключение ещё не настроено. Заявки сохраняются в админке и доступны в Excel." : yandexDisk.syncing || syncing ? "Синхронизируем заявки…" : yandexDisk.lastSyncedAt ? `Последняя синхронизация: ${formatDate(yandexDisk.lastSyncedAt)}. Заявок: ${yandexDisk.total}.` : "Новые заявки автоматически обновляют XLSX на Яндекс Диске. Для выгрузки сохранённых заявок нажмите «Синхронизировать»."}</p>
        <p className={styles.muted}>Файл: {yandexDisk.path}. Формируется заново из заявок сайта; ручные правки в нём будут заменены.</p>
        {yandexDisk.error && <p className={styles.yandexDiskError} role="alert">{yandexDisk.error}</p>}
        {syncMessage && <p className={styles.success} role="status">{syncMessage}</p>}
      </div>
      <div className={styles.yandexDiskActions}>{yandexDisk.url && <a href={yandexDisk.url} target="_blank" rel="noopener noreferrer">Открыть Яндекс Диск</a>}<button className={styles.secondary} type="button" disabled={!yandexDisk.configured || syncing} onClick={() => void syncRegistrations()}>{syncing ? "Синхронизируем…" : "Синхронизировать"}</button></div>
    </section>}
    {!loaded ? <section className={styles.loading} aria-busy={loading}><h2>{loading ? "Загружаем заявки…" : "Список заявок не загружен"}</h2>{!loading && <button className={styles.secondary} type="button" onClick={reload}>Повторить загрузку</button>}</section> : <div className={styles.registrations} aria-busy={loading}>
      <div className={styles.registrationToolbar}>
        <div className={styles.registrationCount} role="status"><strong>Всего заявок: {registrations.length}</strong><p>Excel содержит все заявки, включая скрытые поиском.</p></div>
        <div className={styles.registrationSearch}><label htmlFor="registration-search">Поиск по имени, телефону или компании</label><input id="registration-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Найти заявку" autoComplete="off" /></div>
      </div>
      {registrations.length === 0 ? <div className={styles.registrationEmpty}><h2>Заявок пока нет</h2><p>После регистрации на сайте участники появятся здесь. Нажмите «Обновить список», чтобы проверить новые заявки.</p></div> : filtered.length === 0 ? <div className={styles.registrationEmpty}><h2>По этому запросу ничего не найдено</h2><p>Проверьте имя, телефон или компанию либо очистите поиск.</p><button className={styles.secondary} type="button" onClick={() => { setSearch(""); setPage(1); }}>Сбросить поиск</button></div> : <>
        <p className={styles.registrationResults} role="status">{search.trim() ? `Найдено: ${filtered.length}. ` : ""}Показаны {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} из {filtered.length}. Время московское.</p>
        <div className={styles.registrationTableScroll} tabIndex={0} role="region" aria-label="Таблица заявок, прокрутка по горизонтали">
          <table className={styles.registrationTable}>
            <caption className={styles.srOnly}>Заявки участников фестиваля, сначала новые. Дата и время по Москве.</caption>
            <thead><tr><th scope="col">Дата и время, МСК</th><th scope="col">Имя и фамилия</th><th scope="col">Телефон</th><th scope="col">Компания</th><th scope="col">Согласие на обработку данных</th></tr></thead>
            <tbody>{visible.map((registration) => <tr key={registration.id}><td className={styles.registrationDate}><time dateTime={registration.createdAt}>{formatDate(registration.createdAt)}</time></td><td className={styles.registrationName}>{registration.name}</td><td className={styles.registrationPhone}><a href={`tel:${registration.phone.replace(/[^+\d]/g, "")}`}>{registration.phone}</a></td><td>{registration.company || "Не указана"}</td><td><span className={styles.registrationConsent}>Получено</span></td></tr>)}</tbody>
          </table>
        </div>
        {pageCount > 1 && <nav className={styles.registrationPagination} aria-label="Страницы заявок"><button className={styles.secondary} type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Назад</button><p aria-live="polite">Страница {currentPage} из {pageCount}</p><button className={styles.secondary} type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Далее</button></nav>}
      </>}
    </div>}
  </>;
}
