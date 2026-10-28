import type { Registration } from "./registration-types";

export const registrationSheetHeaders = ["ID заявки", "Дата и время (МСК)", "Фамилия и имя", "Телефон", "Компания или ВУЗ", "Согласие на обработку данных"];
type SheetProperties = { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } };
type SheetsResponse = {
  sheets?: { properties: SheetProperties }[];
  replies?: { addSheet?: { properties: SheetProperties } }[];
  values?: unknown[][];
  updates?: { updatedRows?: number };
};
export type SheetsRequest = (path: string, init?: RequestInit) => Promise<SheetsResponse>;

const dateFormat = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "medium" });

/** One dedicated tab; the registration ID column is reserved for retry deduplication. */
export class GoogleSheetsRegistrationExporter {
  readonly tabName: string;
  readonly request: SheetsRequest;

  constructor(config: { tabName: string }, request: SheetsRequest) {
    if (!config.tabName || config.tabName.length > 100 || /[\[\]*?:/\\]/.test(config.tabName)) throw new Error("Некорректное название листа Google Таблицы.");
    this.tabName = config.tabName;
    this.request = request;
  }

  async sync(registrations: Registration[]) {
    if (registrations.length > 20_000) throw new Error("Превышен лимит синхронизации заявок.");
    const metadata = await this.request("?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))");
    let sheet = metadata.sheets?.find((entry) => entry.properties.title === this.tabName)?.properties;
    const created = !sheet;
    if (!sheet) {
      const result = await this.request(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: this.tabName, gridProperties: { rowCount: 1000, columnCount: 6, frozenRowCount: 1 } } } }] }),
      });
      sheet = result.replies?.[0]?.addSheet?.properties;
    }
    if (!sheet || (sheet.gridProperties?.columnCount ?? 6) < 6) throw new Error("Лист заявок должен содержать не менее шести столбцов.");
    const quotedTab = `'${this.tabName.replace(/'/g, "''")}'`;
    const range = (cells: string) => `/values/${encodeURIComponent(`${quotedTab}!${cells}`)}`;
    const rowCount = sheet.gridProperties?.rowCount ?? 1000;
    if (rowCount > 100_000) throw new Error("Лист заявок превышает поддерживаемый размер. Проверьте его перед синхронизацией.");
    const ids = rowCount > 1 ? await this.request(`${range(`A2:A${rowCount}`)}?valueRenderOption=UNFORMATTED_VALUE`) : {};
    const existingIds = new Set((ids.values ?? []).map((row) => String(row[0] ?? "")));
    const header = created ? [] : (await this.request(range("A1:F1"))).values?.[0] ?? [];
    const empty = header.every((value) => value === "" || value == null);
    if (!created && empty) {
      const contents = await this.request(range(`A1:F${rowCount}`));
      if (contents.values?.some((row) => row.some((value) => value !== "" && value != null))) throw new Error("У листа нет ожидаемых заголовков, но в нём уже есть данные. Они не изменены.");
    }
    if (!created && !(empty && existingIds.size === 0) && !registrationSheetHeaders.every((value, index) => header[index] === value)) {
      throw new Error("Заголовки листа заявок отличаются от ожидаемых. Существующие данные не изменены.");
    }
    if (created || empty) {
      const sheetId = sheet.sheetId;
      await this.request(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({ requests: [
          { updateCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 }, rows: [{ values: registrationSheetHeaders.map((value) => ({ userEnteredValue: { stringValue: value } })) }], fields: "userEnteredValue" } },
          { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
          { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.933, green: 0.906, blue: 1 }, textFormat: { bold: true, foregroundColor: { red: 0.259, green: 0, blue: 0.965 } }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
          ...[285, 190, 230, 170, 260, 270].map((pixelSize, index) => ({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 }, properties: { pixelSize }, fields: "pixelSize" } })),
          { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 6 } } } },
        ] }),
      });
    }
    const pending = [...registrations].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).filter((record) => !existingIds.has(record.id));
    for (let offset = 0; offset < pending.length; offset += 500) {
      const batch = pending.slice(offset, offset + 500);
      const result = await this.request(`${range("A:F")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: JSON.stringify({ majorDimension: "ROWS", values: batch.map((record) => [record.id, dateFormat.format(new Date(record.createdAt)), record.name, record.phone, record.company, "Да"]) }),
      });
      if (result.updates?.updatedRows !== batch.length) throw new Error("Google не подтвердил запись всех строк. Повторите синхронизацию.");
    }
    return { exported: pending.length, total: registrations.length, syncedAt: new Date().toISOString() };
  }
}
