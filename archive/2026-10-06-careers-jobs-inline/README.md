# Инлайн-код блока вакансий на /careers (06.10.2026)

`fetch-embed.html` — содержимое HTML Embed «fetch» в секции Open Roles страницы Careers
(`6a5fec4a42e5c7475885bd0e`, Container Contextual → fetch), снято со staging 06.10.2026
(публикация 12:41 UTC). Код написала коллега по просьбе клиента.

Код перенесён в `webflow-scripts/careers/open-roles.css` и `open-roles.js`; в embed остаются
`<div id="ctx-jobs">` и подключение файлов (карточка https://trello.com/c/x5G7NdRd).

Отличия перенесённой версии от архивной:
- шрифты — только токены `--_fonts---family--*` без фолбэков, литерал `Inter` заменён токеном body;
- стрелка `pe-c8-arrow.svg` берётся относительно адреса скрипта (`../global/`), а не с jsDelivr `@main`;
- комментарии на английском без длинных тире, убран комментарий `/* 100% */`.
