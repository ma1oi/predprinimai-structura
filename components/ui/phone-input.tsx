"use client";

import { useRef, type ChangeEvent } from "react";

export function PhoneInput() {
  const previousValue = useRef("");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const cursor = input.selectionStart ?? input.value.length;
    let digits = input.value.replace(/\D/g, "");
    let digitsBeforeCursor = input.value.slice(0, cursor).replace(/\D/g, "").length;
    const inputType = (event.nativeEvent as InputEvent).inputType;

    // Deleting a separator should remove the neighbouring digit, including on touch keyboards.
    if (digits && digits === previousValue.current.replace(/\D/g, "") && inputType?.startsWith("deleteContent")) {
      const backwards = inputType === "deleteContentBackward";
      const index = digitsBeforeCursor - (backwards ? 1 : 0);
      if (index >= 1 || digits.length === 1) {
        digits = digits.slice(0, index) + digits.slice(index + 1);
        if (backwards) digitsBeforeCursor = Math.max(0, digitsBeforeCursor - 1);
      }
    }

    let formatted = "";
    if (digits) {
      const hasPrefix = /^[78]/.test(digits);
      const local = (hasPrefix ? digits.slice(1) : digits).slice(0, 10);
      if (!hasPrefix) digitsBeforeCursor += 1;
      formatted = "+7";
      if (local.length) formatted += ` (${local.slice(0, 3)}`;
      if (local.length >= 3) formatted += ") ";
      if (local.length > 3) formatted += local.slice(3, 6);
      if (local.length > 6) formatted += ` ${local.slice(6, 8)}`;
      if (local.length > 8) formatted += `-${local.slice(8, 10)}`;
    }

    let caret = 0;
    let seen = 0;
    while (caret < formatted.length && seen < digitsBeforeCursor) {
      if (/\d/.test(formatted[caret])) seen += 1;
      caret += 1;
    }
    // Keep typing past inserted separators without jumping to the end during edits.
    while (caret < formatted.length && /\D/.test(formatted[caret])) caret += 1;
    input.value = formatted;
    input.setSelectionRange(caret, caret);
    previousValue.current = formatted;
  }

  return <input type="tel" name="phone" inputMode="tel" autoComplete="tel" placeholder="+7 (999) 999 99-99" required pattern={String.raw`\+7 \(\d{3}\) \d{3} \d{2}-\d{2}`} title="Введите номер полностью: +7 (999) 999 99-99" onChange={handleChange} />;
}
