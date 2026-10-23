import ExcelJS from "exceljs";
import type { Registration } from "./registration-types";

const moscowDate = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function registrationExportFilename(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  return `registrations-${part("year")}-${part("month")}-${part("day")}.xlsx`;
}

export async function buildRegistrationWorkbook(registrations: Registration[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Предпринимай";
  const sheet = workbook.addWorksheet("Заявки", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Дата регистрации (МСК)", width: 27 },
    { header: "Имя", width: 32 },
    { header: "Телефон", width: 23 },
    { header: "Компания или вуз", width: 42 },
    { header: "Согласие", width: 15 },
  ];
  sheet.autoFilter = `A1:E${registrations.length + 1}`;
  const header = sheet.getRow(1);
  header.height = 30;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4200F6" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  for (const registration of registrations) {
    // ExcelJS treats primitive strings as literal cells, even when they begin with =, +, - or @.
    const row = sheet.addRow([
      moscowDate.format(new Date(registration.createdAt)), registration.name,
      registration.phone, registration.company, "Да",
    ]);
    row.eachCell((cell) => {
      cell.numFmt = "@";
      cell.alignment = { vertical: "top", wrapText: true };
    });
  }
  return workbook.xlsx.writeBuffer();
}
