# Архив мёртвых скриптов — 30.07.2026

Всё, что удалено из репозитория и из Webflow в ходе уборки 30.07.2026. Файлы лежат
здесь целиком, чтобы любую правку можно было откатить, не восстанавливая ничего по
памяти.

**Как это проверялось.** Обход всех 82 страниц из `sitemap.xml` (плюс страница 404,
которой в sitemap нет) на staging `https://contextual-d250bf.webflow.io`: поиск
реально подключённых `<script src>` и разметки-триггеров. Ни один из перечисленных
ниже файлов не грузится ни на одной странице.

Осторожно: `sitemap.xml` на staging отдаёт **прод-URL** (`contextual.io`). При
повторной проверке хост нужно заменять на staging вручную, иначе обход уйдёт на прод.

---

## `webflow-registered/` — регистрации, помеченные к удалению

> **Статус на 30.07.2026: НЕ УДАЛЕНЫ.** `data_scripts_tool > delete_registered_script`
> возвращает `HTTP 400` на всех четырёх id — и в батче, и по одному. Владелец удаление
> согласовал, но API его не выполняет. Файлы уже здесь, так что снести их можно в любой
> момент вручную через Webflow UI, ничего не потеряв. `get_registered_scripts` по-прежнему
> показывает все 15 записей.

Скачаны с `cdn.prod.website-files.com`. Site id `69dfe91a819e76a918bef68c`.

| Файл | script id | Версия | Зарегистрирован |
|---|---|---|---|
| `case_study_carousel-1.0.4.js` … `-1.0.7.js` | `case_study_carousel` | 1.0.4–1.0.7 | 22.04.2026 |
| `casestudyslider-1.0.0.js` … `-1.0.3.js` | `casestudyslider` | 1.0.0–1.0.3 | 22.04.2026 |
| `customerlogosmarqueelimittest-0.0.1.js` | `customerlogosmarqueelimittest` | 0.0.1 | 22.04.2026 |
| `perevealaccordion-0.0.1.js` | `perevealaccordion` | 0.0.1 | 19.07.2026 |

**Почему помечены:** ни одна из четырёх регистраций не была применена ни к сайту, ни к
какой-либо странице (`get_site_scripts` вернул единственную запись —
`customer_brands_carousel` 1.0.4 в футере; `get_page_scripts` пусто). В HTML всех 82
страниц их URL не встречается.

**Что НЕ трогали:** регистрация `customer_brands_carousel` — живая, версия 1.0.4
применена site-wide и грузится на всех страницах. Её версии 1.0.0–1.0.3 — история той
же регистрации, они безвредны. Выборочно удалить старые версии нельзя:
`delete_registered_script` сносит регистрацию целиком, вместе со всеми версиями, и
такая попытка убила бы карусель брендов на всём сайте.

**Как вернуть:** `data_scripts_tool > register_hosted_script` (или залить файл заново
через Webflow UI), затем `add_site_script` / `add_page_script`. Прежний script id
восстановить нельзя — Webflow выдаст новый; ссылки на старый id нигде не остались,
поэтому это не мешает.

---

## `repo-files/` — файлы, удалённые из репозитория

### `case-study-carousel.js`
Лежал в `webflow-scripts/global/`. **Побайтовый дубликат** живого
`webflow-scripts/home/success-stories-spotlights.js` (нормализованный diff пуст).
Не был подключён ни на одной странице.

Важно: это НЕ «потерянный скрипт карусели кейсов». Карусель на главной работает —
её обслуживает `home/success-stories-spotlights.js`, проверено кликом на staging
(счётчик `01 → 02`, `is-active` и `aria-hidden` переезжают на следующий слайд).
Три слайда, лежащие друг на друге в `grid` — это штатный режим `data-cs-mode="fade"`,
а не поломка.

**Как вернуть:** `git show <коммит>^:webflow-scripts/global/case-study-carousel.js`.

### `industry-patterns.js`, `industry-patterns.test.js`
Удалены коммитом `a06b93c` (30.07.2026). Логику аккордеона на
`/industry/industry-page` забрал общий модуль reveal-accordion в
`webflow-scripts/global/global.js`; теги со страниц сняты.

### `reveal-accordion.js`
Лежал в `webflow-scripts/where-it-shows-up/`. Удалён коммитом `faf4af0` (30.07.2026)
— к тому моменту это была заглушка на 282 байта. Логика живёт в `global/global.js`,
тег снят с `/who-we-are`.

---

## Что проверяли и НЕ удалили

Живое, грузится, трогать нельзя:

- `404-physics/*` — работает на странице 404. Её нет в sitemap, поэтому при обходе
  легко принять за мёртвое.
- `global/*` (кроме `case-study-carousel.js`), `home/*`, `who-we-are/*`, `article/*`,
  `success-stories/*`, `success-story/success-story-template.js`.
- `home/value-flywheel/value-flywheel.test.js` — node-тест, в браузер и не должен идти.

Отдельно: `/client-success` грузит `home/success-stories-spotlights.js`, но разметки
`data-cs-*` на странице нет — скрипт работает вхолостую. Не ошибка, но и не нужен;
решение за владельцем.
