---
name: ux-review
description: UX/UI review the user asked for on 23/11/69. Use EVERY time a system or page is created or changed — any UI in Department (index.html, department modules, leave.html), Members, Order, Dashboard-Meeting, BoothCRM, admin pages, LINE Flex cards, printed forms / PDF / Excel layouts. Check the design against core UX principles, find issues, fix them before showing a preview or deploying.
---

# UX/UI review before finalizing a design

The user asked (23/11/69): every time a system is built or changed, evaluate the UI against core UX/UI principles **before** presenting the final design. Find the problems, explain why they matter, fix them, and only then show the preview and deploy. **User needs come before looks.**

## When

- Any new page, screen, dialog, form, dashboard, list, card, menu, LINE message card, printed form or export layout.
- Any change to existing UI, even small: a button, a label, a colour, moving a section.
- Backend-only changes that change what the user sees (new error messages, new statuses) count too.

## Steps

1. **Build the change.**
2. **Look at it.** Use the Playwright harness (scratchpad only) at phone width 390 px and desktop 1280 px. Include the empty state, a loading state, an error state and a full / long-data state. For LINE cards, look at the Flex JSON in the simulator layout or a harness render.
3. **Check it against the 8 principles below**, writing down each issue you find.
4. **Fix the issues** that are in scope. If a fix needs a decision from the user, ask, with a recommended option.
5. **Re-check** with a new screenshot.
6. **Report to the user in short Thai**:
   - what was built;
   - a short "ตรวจ UX แล้ว" list: the issues found, why they matter and what was fixed, in 1 line each, with only the important ones;
   - anything left for them to decide;
   - send the preview screenshot.

## The 8 principles: what to check

1. **Usability.** Can a non-technical staff member use it the first time without explanation? Is the main task obvious? Do things work on a phone, which most staff use?
2. **Consistency.** Does it follow the existing patterns of that system?
   - Department site (index.html):
     - `ask({title, text, ok, cancel, tone})` for confirmations; never `confirm()` / `alert()` / `prompt()`.
     - `toast()` for success messages.
     - `openModal` dialogs.
     - `.panel` / `.pbox` cards, `.kpi` tiles, `.chip` filters, `.btn` / `.btn-line` / `.btn-primary` buttons.
     - The department colour `--c`.
     - Dashboard skin `#main.dash`; charts from `dcharts.js`.
     - No `p.lead` text under headings (removed on purpose).
   - Status colours: green = done / approved / OK, orange = waiting / pending, red = problem / rejected / overdue, blue = info, grey = past / disabled.
   - Thai Buddhist year in dates (dd/mm/yy 69).
   - The same word for the same thing everywhere.
3. **Hierarchy.**
   - The most important information or action first: largest and highest-contrast.
   - Secondary information is smaller or grey.
   - One primary button per area.
   - Group related items in boxes, with clear separation between different reports or sections.
4. **Accessibility.**
   - Text contrast at least 4.5:1, so no light grey on white for important text.
   - Body text at least 14 px on phones.
   - Touch targets at least 44 px high and spaced apart.
   - Colour is never the only signal: add an icon or a word (✓ / ✕ / ⏳).
   - Inputs have labels.
   - Nothing overflows its box at 390 px; watch for iOS date inputs.
   - Long Thai or Burmese names wrap rather than being cut off.
5. **Feedback.**
   - **Never leave the user waiting in silence (user asked 26/11/69, applies to every department).** Any action that talks to the server or takes more than a moment must show a popup that says what is happening ("กำลังโหลดข้อมูล…", "กำลังค้นหาผู้ขาย…", "กำลังบันทึก…") with a spinner and "กรุณารอสักครู่ ไม่ต้องกดซ้ำ", until the next screen is ready. A dialog must never just close and leave a blank gap while the next step loads.
     - Department site: the global `call()` in `index.html` already shows this popup (`.busyov`, after 0.4 s) for every request started by a click / submit / change / Enter; background polls stay quiet. Check that new code goes through `call()`, and for multi-step flows (save → reload → open the next dialog) show a named step popup (e.g. purchasing.js `waitBox` / `reloadTo`) instead of `closeModal()` followed by a silent reload.
     - `leave.html` has the same popup in its own `call()` (Thai / Burmese).
     - Other systems (Members, Order, Dashboard-Meeting, BoothCRM, admin pages): add the same kind of popup when touching that code.
   - Every action shows what happened: a spinner or disabled button while saving, then a toast or result.
   - Errors are shown in plain Thai with what to do next, never a bare "เชื่อมต่อไม่ได้".
   - Empty states say why it is empty and what to do.
   - New or changed items are visibly marked.
6. **Efficiency.**
   - Fewest taps for the common task.
   - Sensible defaults: today, last used value, remembered choices.
   - No duplicated boxes or information on the same page (the user often asks to remove duplicates).
   - Pages load progressively instead of waiting for everything.
7. **Error prevention.**
   - Validate before saving (required fields, number ranges, date order).
   - Destructive actions use `ask` with `tone: 'danger'`.
   - Warn about duplicates and unsaved changes.
   - Make undo or edit possible.
   - Disable buttons while a request runs, to prevent double submits.
8. **Clarity.**
   - Labels, instructions and button text say exactly what happens, as a verb + object ("บันทึกการลา", "ส่งเข้ากลุ่ม LINE").
   - Units are always shown (ชม. / วัน / ลัง / บาท).
   - No technical words such as "token", "sync", "ID" or "API" in staff-facing text.
   - Thai first; Burmese where the page already supports it (leave.html).

## Output format for the user (Thai, short; phone reader)

```
ตรวจ UX แล้ว:
- <ปัญหา> → <ทำไมสำคัญ> → <แก้แล้ว / ต้องให้เลือก>
```

Keep it to the 2–5 most important points. Do not list principles that had no issues.
