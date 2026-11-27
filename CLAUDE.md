# ระบบงานองค์กร (Department)

Full notes live in the `Em-O-Cha/apps-script` repo's CLAUDE.md (backend = `departments` folder there). Rules that always apply here:

- **Executive dashboard = department dashboard (standing rule, user asked 26/11/69):** every time a department dashboard (`*_dash`) is changed (new section, layout, removed box), make the same change in that department's view on the executive card (`executive.js` / backend `Executive.gs`) in the same deploy. Reuse the module's renderer (e.g. `PRDM.dashHtml`, `QAM.costHtml`, `ACC.mountCmp`) and the same backend data function, and check both pages in the preview.
- Never leave the user waiting in silence: every user-started request shows the "กำลังดำเนินการ…" popup (global `call()` in index.html / leave.html); multi-step flows show named step popups.
- Run the `ux-review` skill (`.claude/skills/ux-review/`) before showing a preview or deploying any UI change.
- This repo is public: never put passwords, sheet IDs or emails in it.
- Fast data (standing rule, user asked 27/11/69): every department may get the Supabase read copy like ACC / HR — reads from the copy, saves to the sheet, only the saved tabs are re-read, no images in Supabase, page shows the last result at once and refreshes quietly. Full recipe in the apps-script repo's CLAUDE.md ("Standing rule: fast data for every department").
