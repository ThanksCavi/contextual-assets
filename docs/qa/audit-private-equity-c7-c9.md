# Scoped QA: Private Equity — `.c7-sec`–`.c9-sec`

> Координаты страницы и секций: [`docs/qa/PAGES.md`](PAGES.md).

Дата: **27 июля 2026 г.**
Staging: <https://contextual-d250bf.webflow.io/private-equity>
Site `69dfe91a819e76a918bef68c` · Page `6a5cb89010d19c0f743877c7`
Figma: `.c7-sec` — `4344:7266`; `.c8-sec` — `4344:7216`; `.c9-sec` —
`4344:7359`; канонический full-page узел Private Equity — `4344:6965`.

Присланный запасной full-page узел `4303:6408` относится к Own Your AI, поэтому для
этого scope не использовался.

## Scope и protected invariants

Изменялись только page-scoped классы `c7-*`, `c8-*`, `c9-*` и проп `Label` конкретного
экземпляра Badge в `.c9-head`. Не изменялись `Container Contextual`, определения
Badge/Button, header/footer/CTA Wave и ambient/circle-field слои.

## Результат

Секции приведены к Figma и опубликованы **только на Webflow staging subdomain**.

На 1440:

- `.c7-sec` — 1134.5px против 1136px в Figma; `.c7-h2` — 657.3×135.9px
  против 658×136px. Карточки — 413.3×579px. Открытое состояние второй карточки:
  head 224px, detail 359.9px, icon 50×50px; открытие и закрытие проходят.
- `.c8-sec` — 1228.9px; `.c8-h2` — 741.8×135.9px; список начинается на 539.6px
  против 540px в Figma и имеет точную высоту 419px. Три карточки теперь используют
  единый `.c8-step`, а линии — два самостоятельных `.pe-c8-separator` по 1px,
  связанные с design-system border token. Заголовки шагов — 40/48, meta label —
  14/16, body — 18/26.
- `.c9-wrap` — 1360×1057.4px против 1360×1059px в Figma. Геометрия карточек
  сохранена; Badge исправлен с `Diligence` на `How to start`.

## Закрытые findings

| Приоритет | Секция | Наблюдение | Статус |
|---|---|---|---|
| P1 | `.c7-sec` | H2 был 601px вместо 658px, из-за чего отличался перенос | PASS |
| P1 | `.c8-sec` | H2 был 601px вместо 742px; секция была вертикально сжата | PASS |
| P1 | `.c8-sec` | Шаги имели высоту 350.5px вместо 419px; typography/gaps не совпадали с Figma | PASS |
| P1 | `.c8-sec` | Разделители были border-left карточек, а `≤991` превращался в горизонтальную scroll-ленту | PASS; отдельные separators + 1-column |
| P1 | `.c9-sec` | Badge содержал `Diligence` вместо `How to start` | PASS |

## Изменения Webflow

- `.c7-h2`: `max-width: 17.5ch`.
- `.c8-sec`: `S/160` сверху и снизу.
- `.c8-h2`: `max-width: 19.75ch`.
- `.c8-steps`: `S/60` сверху, `min-height: 419px`.
- `.c8-step`, `.c8-step2`: `justify-content: space-evenly`, нулевой row gap.
- `.c8-stitle`: line-height `1.2`, weight `400`.
- `.c8-mlabel`: line-height `1.143`.
- `.c8-sbody`: line-height `1.444`, weight `300`, letter-spacing `-0.01em`.
- `.c8-steps`: desktop grid заменён с `1fr 1fr 1fr` на
  `minmax(0,1fr) 1px minmax(0,1fr) 1px minmax(0,1fr)`.
- `.c8-step2` снят с карточек 02/03; все три карточки используют `.c8-step`, поэтому
  border больше не является частью карточки.
- Добавлены два `DivBlock` с новым page-scoped классом `PE C8 Separator`.
- На `medium` (`≤991`) `.c8-steps` переключается с legacy flex-row/`overflow-x:auto`
  на одноколоночный grid; carousel-only sizing удалён. Карточки получают token-bound
  vertical padding и row gap, separator меняется с вертикального `1×100%` на
  горизонтальный `100%×1px`.
- `.c9-head` Badge instance: локальный `Label = How to start`.

## QA-матрица

| Width | `.c7-sec` | `.c8-sec` | `.c9-sec` | Page overflow | Итог |
|---:|---:|---:|---:|---:|---|
| 1440 | 1134.5px | 1228.9px | 1137.4px | 0 | PASS, Figma target |
| 1920 | 1301px | 1459.2px | 1365.7px | 0 | PASS, token growth |
| 991 | 1769.9px | 1732.3px | 1474.5px | 0 | PASS; 1-column, separators 941.4×1px |
| 390 | 1891.3px | 1628px | 1668.2px | 0 | PASS; 1-column, separators 370.5×1px |

На 991px и 390px `.c8-steps` больше не является горизонтальной лентой:
`overflow-x:visible`, внутренний overflow = 0. На 390px ни один descendant карточек
не выходит за viewport.

Evidence:

- `.c7-sec`: [1440](shots/private-equity--c7--1440-final.png),
  [open state](shots/private-equity--c7--1440-open-final.png),
  [1920](shots/private-equity--c7--1920-final.png),
  [991](shots/private-equity--c7--991-final.png),
  [390](shots/private-equity--c7--390-final.png).
- `.c8-sec`: [1440](shots/private-equity--c8--1440-final.png),
  [1920](shots/private-equity--c8--1920-final.png),
  [991](shots/private-equity--c8--991-final.png),
  [390](shots/private-equity--c8--390-final.png);
  separator follow-up:
  [1440](shots/private-equity--c8--1440-separators-final.png),
  [1920](shots/private-equity--c8--1920-separators-final.png),
  [991](shots/private-equity--c8--991-separators-final.png),
  [390](shots/private-equity--c8--390-separators-final.png).
- `.c9-sec`: [1440](shots/private-equity--c9--1440-final.png),
  [1920](shots/private-equity--c9--1920-final.png),
  [991](shots/private-equity--c9--991-final.png),
  [390](shots/private-equity--c9--390-final.png).

## Tool notes

- Webflow Data MCP reads, writes, read-backs and staging publish работали штатно.
- Webflow AI helper возвращал `Failed to fetch from FAI chat service`; для QA он не
  требовался.
- `data_style_tool.get_styles(include_properties:true)` возвращал только base properties
  и скрывал существующие medium overrides; фактический breakpoint state проверялся по
  mutation echo и опубликованному computed style.
- Первый запуск Playwright wrapper внутри sandbox не смог получить
  `@playwright/cli` из-за DNS; разрешённый сетевой запуск прошёл, все viewport-проверки
  выполнены.
- Единственная console error — внешний `403` от `epsilon.6sense.com`; ошибок
  layout/accordion этих секций нет.

## Обновление 2026-07-30 — `.c8-sec` как переиспользуемая drag-лента

> **CSS этого раздела отменён — см. «Исправление 2026-07-30» ниже.** Треки
> `minmax(340px, fr)` сжимали три дизайнерские карточки, как только появлялась
> четвёртая. Мотивация и разбор брифа в этом разделе остаются в силе.

Бриф 5.16, Section #8 просит «draggable slider on all screens but slider only show when
there are more than 3 cards» и «touch slider» по образцу панели «Real voices. Real
experience» на `/client-success`. Эталон проверен на проде: это нативный
`overflow-x:auto` с фиксированной минимальной шириной карточек, без JS-карусели, стрелок,
точек и scroll-snap. «Draggable» = то же самое плюс перетаскивание мышью на десктопе
(клиент тем же словом просит правку image slider на `/who-we-are`).

Прежняя разметка (три карточки + два `1px` grid-трека под `.pe-c8-separator`) не пережила бы
четвёртую карточку. Сепараторы удалены, линия перенесена в `border-left` карточки.

Изменения Webflow:

- `.c8-steps` base: `grid-template-columns` →
  `minmax(340px,32.35fr) minmax(340px,35.3fr) minmax(340px,32.35fr)` (пропорция Figma
  сохранена, `1px`-треки убраны); добавлены `grid-auto-flow: column`,
  `grid-auto-columns: minmax(340px,1fr)`, `overflow: auto hidden`.
- `.c8-steps` medium → `340px 340px 340px` + `grid-auto-columns: 340px`;
  tiny → `280px 280px 280px` + `grid-auto-columns: 280px`.
- `.c8-step` base: `border-left: 1px solid var(--_colors---border)`;
  псевдосостояние `first-child` — `border-left-width: 0`.
- Удалены два `DivBlock` и класс `PE C8 Separator`.
- На `.c8-steps` добавлен атрибут `data-drag-lane`.

Активация слайдера — следствие минимума трека, а не подсчёта карточек в JS: три карточки на
1440 умещаются и работают по fr-пропорции, четвёртая сажает все треки на `340px`
(1360 > 1320) и лента начинает прокручиваться. JS
(`webflow-scripts/global/drag-lane.js`) отвечает только за перетаскивание мышью.

QA-матрица (staging, 3 карточки):

| Width | Треки | Лента | Page overflow |
|---:|---|---|---:|
| 1920 | 427/466/427 | static | 0 |
| 1440 | 427/466/427 | static | 0 |
| 1200 | 368.8/402.4/368.8 | static | 0 |
| 1024 | 340×3 | scrolls (1020 > 973) | 0 |
| 991 | 340×3 | scrolls | 0 |
| 768 | 340×3 | scrolls | 0 |
| 390 | 280×3 | scrolls | 0 |

Высота `.c8-sec` на 1440 — 1229px против 1228.9px до правки; линии сместились на 1px вправо
(было x=486, стало x=487) — сепаратор из отдельного трека стал границей карточки.

Изменение поведения: в диапазоне 992–1074px три карточки теперь дают ленту вместо сжатия
(минимум трека 340px совпадает с medium-версткой). Ниже 992 поведение прежнее.

С четвёртой карточкой (проверено клонированием в браузере, без мутации Webflow): треки
`340px ×4`, `scrollWidth 1360 > clientWidth 1320`, курсор `grab`, drag мышью двигает
`scrollLeft` 0 → 40, `grabbing` во время перетаскивания, первая карточка без линии.

Evidence: [1440](shots/private-equity--c8--1440-drag-lane.png),
[390](shots/private-equity--c8--390-drag-lane.png).

**Не выполнено:** тег скрипта в page custom code. `data_scripts_tool.set_page_freeform_code`
отдаёт HTTP 406 на любой payload с `<script>` (тот же WAF, что и на inline SVG), поэтому
строку подключения нужно вставить руками в Page Settings → Custom Code → Before `</body>`:
`<script src="https://thankscavi.github.io/contextual-assets/webflow-scripts/global/drag-lane.js?v=1" defer></script>`
До этого лента листается свайпом и трекпадом, но не тянется мышью.

## Исправление 2026-07-30 — проценты вместо `fr` + режим ленты на скрипте

Три дефекта первой версии, найденные клиентом:

1. `minmax(340px, <N>fr)` означает «сжимай всё до 340px, как только не хватает
   места». С четырьмя и более карточками все треки садились на минимум, текстовая
   колонка падала с 387px до 260px, переносы ехали — Figma-оверлей клиента
   показывал полное расхождение. Это же ломало и три дизайнерские карточки.
2. `overflow: auto hidden` в самом классе означает, что на канвасе Designer
   карточки за границей контейнера не видны и не редактируются: клиент видел
   3,5 карточки из шести.
3. Скроллбар `data-horizontal-scroll` (16px) съедал место внутри контейнера с
   `overflow-y: hidden` и резал последнюю строку body.

### Итоговая модель

**Треки — проценты от контейнера, а не `fr` с минимумом.** Процент считается от
видимой ширины, поэтому число карточек физически не влияет на ширину первых трёх:

- `.c8-steps` base: `grid-template-columns: 32.35% 35.3% 32.35%`,
  `grid-auto-columns: 32.35%`; `grid-auto-flow` и `overflow` из класса удалены.
- medium: `340px 340px 340px` + `grid-auto-columns: 340px`, `padding-bottom` снят.
- tiny: `280px 280px 280px` + `grid-auto-columns: 280px`.

**Режим ленты включает скрипт, а не класс Webflow.** `drag-lane.js` вешает
`is-lane`, а `global.css` держит за этим классом `grid-auto-flow: column`,
`overflow: auto hidden` и скрытый скроллбар. Канвас Designer не исполняет custom
code, поэтому там секция остаётся обычной сеткой из трёх колонок и четвёртая
карточка переносится на второй ряд — видна и редактируется без каких-либо
переключений. Деградация без скрипта такая же: перенос на второй ряд.

**Скроллбар скрыт** (`scrollbar-width: none` + `::-webkit-scrollbar`), атрибут
`data-horizontal-scroll` с ленты снят. Единственный признак прокрутки на
десктопе — курсор `grab`; выглядывания четвёртой карточки нет по требованию
(«четвёртая за пределами контейнера»).

Три дубля карточек, добавленные при тестировании, удалены — в секции снова три.

### QA (staging, 3 карточки)

| Width | Треки | x карточек | Лента | Скроллбар | Page overflow |
|---:|---|---|---|---:|---:|
| 1920 | 427/466/427 | 300/727/1193 | static | нет | 0 |
| 1440 | 427/466/427 | 60/487/953 | static | нет | 0 |
| 1200 | 368.8/402.4/368.8 | 30/398.8/801.2 | static | нет | 0 |
| 1024 | 314.7/343.4/314.7 | 25.6/340.3/683.7 | static | нет | 0 |
| 991 | 340×3 | 24.8/364.8/704.8 | scrolls | нет | 0 |
| 768 | 340×3 | 19.2/359.2/699.2 | scrolls | нет | 0 |
| 390 | 280×3 | 9.8/289.8/569.8 | scrolls | нет | 0 |

На 1440 разделители снова стоят на x=487 и 953 — ровно узлы Figma `4344:7260` и
`4344:7261`; высота секции 1229px против 1228.9px до всех правок. Регрессия
1024px (лента вместо fluid-сжатия) из первой версии ушла.

С четвёртой карточкой (клон в браузере, без мутации Webflow): треки
`427/466/427/427`, x = 60/487/953/**1380** — первые три не сдвинулись, четвёртая
начинается точно на правой границе контейнера; `scrollWidth` 1747, курсор `grab`,
drag мышью двигает `scrollLeft` 0 → 300 при максимуме 427, скроллбара нет, page
overflow 0. Без класса `is-lane` (эмуляция канваса) те же четыре карточки дают
два ряда, `overflow: visible`, page overflow 0.

Evidence: [1440](shots/private-equity--c8--1440-lane-fix.png),
[390](shots/private-equity--c8--390-lane-fix.png).

### Открытые вопросы

- Отступы первой и последней карточки под Figma не чинили по решению владельца:
  в Figma `4344:7221/7234/7247` все три `item` шириной 387px (первый прижат к
  левому краю контейнера, третий к правому, 40px только со стороны линии), в
  вёрстке же 40px с обеих сторон у всех трёх, поэтому текстовая колонка карточек
  01 и 03 — 347px и body переносится в 5 строк вместо четырёх. Расхождение
  предшествует правкам ленты и остаётся.
- Канвас Designer проверить может только владелец: ожидается, что четвёртая
  карточка переносится на второй ряд и редактируется без переключений.

### Поправка по скроллбару (тот же день)

Скрывать полосу на всех ширинах было неверно: на `≤991` лента прокручивается всегда и
полоса — часть принятого визуала. Итог:

- `global.css`: `scrollbar-width: none` и `::-webkit-scrollbar { display: none }` для
  `[data-drag-lane].is-lane` завёрнуты в `@media screen and (min-width: 992px)`.
- На ленту возвращён атрибут `data-horizontal-scroll` (сайтовый стиль полосы),
  на `medium` возвращён `padding-bottom: 10px`.

Проверено на staging: 1440 и 1024 — `scrollbar-width: none`, `padding-bottom: 0`;
991, 768 и 390 — `scrollbar-width: thin`, thumb `rgb(27,25,35)` на треке
`rgb(248,247,243)`, `padding-bottom: 10px`. Высоты секции прежние: 1229 / 1020.4 / 956.9.

На момент проверки в секции снова шесть карточек (тестовые дубли добавлены в Designer
после удаления). Это и стало лучшим доказательством модели: на 1440 первые три стоят
`427/466/427` на x = 60/487/953, то есть ровно по дизайну, а карточки 4–6 целиком за
контейнером (x = 1380/1807/2234) и на вид секции не влияют вообще —
[скрин](shots/private-equity--c8--1440-scrollbar.png).

### Высота ленты на `≤991` (тот же день)

`min-height: 419px` — высота фрейма `list` (`4344:7220`) из десктопного Figma-узла, но
стояла она на всех брейкпоинтах, хотя референса для узких экранов нет. Отсюда пустота
под текстом: контент 324.6px при высоте 409px на 991, 310.3 против 409 на 768,
345 против 409 на 390.

На `medium` выставлен `min-height: auto`. Высота ленты теперь равна самой высокой
карточке, а выравнивание карточек между собой обеспечивает сам grid (`align-items`
не задан → `stretch`), поэтому разделители по-прежнему одинаковой длины.

| Width | min-height | Высота ленты | Карточки | Высота секции (было → стало) |
|---:|---|---:|---|---|
| 1920 | 419px | 491.7 | равны | 1532 (не менялась) |
| 1440 | 419px | 419 | равны | 1229 (не менялась) |
| 1200 | 419px | 419 | равны | 1112 (не менялась) |
| 1024 | 419px | 419 | равны | 1036.6 (не менялась) |
| 991 | auto | 334.6 | равны, 324.6 | 1020.4 → 936 |
| 768 | auto | 320.3 | равны, 310.3 | 955.7 → 856.9 |
| 390 | auto | 355 | равны, 345 | 956.9 → 892.9 |

Стресс-тест на 390: тело второй карточки удвоено — все шесть карточек выросли вместе
до 459.8px, лента 469.8px. Page overflow везде 0.

Десктопная высота осознанно остаётся минимумом, а не фиксированной: длиннее контент —
лента растёт (на 1920 это уже 491.7px), короче — держит 419px из Figma и длину линий.

Evidence: [991](shots/private-equity--c8--991-auto-height.png),
[390](shots/private-equity--c8--390-auto-height.png).

---

## 2026-07-30 — `.c7-sec` на общем механизме раскрытия

Inline-копия аккордеона удалена из page custom code (footer теперь пуст) — логика
переехала в `webflow-scripts/global/global.js`, который страница и так грузит.
Контракт `data-reveal-accordion*` сохранён; добавлены только
`data-reveal-accordion-lock-height` на `.c7-grid` и `data-reveal-accordion-more`
на три `.c7-more`. CSS секции теперь версионируется в репозитории
(`webflow-scripts/where-it-shows-up/c7-two-box-accordion.css`) — до этого он жил
только в HEAD страницы и в git-объекте из сброшенного stash.

**Что чинили.** Секция росла на 6.9px при открытии второй карточки («Fragmented
data», самый длинный detail) — высота складывалась из натуральных высот состояний
и потому зависела от длины текста.

**Как решено.** Высота карточки = максимум по всем карточкам ряда и обоим состояниям
(измеряется, не задаётся). Роли боксов сохранены как в макете: закрыто слак держит
BOX 1, открыто — BOX 2a, поэтому все три открытые карточки показывают одинаковые
пропорции 224/360 независимо от длины копии. `min-height` шапки теперь тоже
анимируется: сброс в одном кадре отдавал детали 40px до начала анимации.

**Замеры после (transition отключены):**

| Width | `--rv-card-h` | Высота секции: закрыто / каждая из трёх открыта | Открытая карточка (head/detail) |
|---:|---|---|---|
| 1920 | 621 / 621 / 621 | 1318.9 везде | 242 / 377 |
| 1440 | 586 / 586 / 586 | 1141.5 везде | 224 / 360 (Figma 221/359) |
| 991 | 484 / 494 / 484 | 1897.9 везде | 199 / 283…293 |
| 390 | 482 / 516 / 482 | 1964.3 везде | — |

В одну колонку (≤991) каждая карточка держит свой максимум — так решил владелец.

Покадрово (видимый Chrome, 1440): карточка 586 и секция 1141.5 на каждом кадре,
смещение следующей секции 0; стартовый шаг детали — 7px (это запас блокировки,
586 против натуральных 579 в закрытом состоянии), дальше непрерывно до 360.

**Осознанное следствие:** закрытые карточки на 1440 стали 586 вместо 579 — высота
берётся по самому высокому состоянию, иначе скачок неустраним при изменении копии.

---

## 2026-08-03 — `.c8-sec`: desktop pager для пяти шагов

**Scope.** Текущая одобренная клиентом drag-лента сохранена. Добавлен только
page-scoped `PE C8 Pager` перед `.c8-steps`: два link block с контрактом
`data-drag-lane-controls`, `data-drag-lane-prev` и `data-drag-lane-next`.
Кнопки используют отдельный SVG asset `pe-c8-arrow.svg`; WWA-классы и геометрия
`.c8-step` / `.c8-steps` не менялись.

**Геометрия.** На 1440 с пятью карточками pager имеет 1360×67px, `margin-top`
92px, `margin-bottom` 21px и gap 12px; каждая кнопка — 129×67px с radius 20px.
Фон и граница привязаны соответственно к native `Light` и `Border`; активная
стрелка — navy asset, disabled icon — opacity 0.35. Исходный верхний отступ
ленты временно снимается только с классом `has-controls`, поэтому добавочный
desktop-блок увеличивает секцию ровно на 120px (1228.9 → 1348.9px @1440).

**Лента и разделитель.** Стрелки используют тот же нативный `scrollLeft`, что
drag/swipe. На 1440 `clientWidth=1320`, `scrollWidth=2174`: Next идёт
`0 → 426 → 854(max)`, то есть на одну соседнюю карточную позицию, а на краях
обновляет `is-disabled` и `aria-disabled`. У границы viewport border-left
четвёртой карточки находится на `right − 1.02px`; только в этом состоянии ему
добавляется `is-lane-edge` и border становится transparent. После частичной
прокрутки линия снова остаётся между карточками.

**Интерактивная приёмка (staging, hard reload):**

- mouse drag `0 → 400`, затем Next → `854(max)`; Next `0 → 426`, затем drag → `126`;
  отдельного carousel state нет;
- Space и Enter переходят на одну позицию; при `prefers-reduced-motion: reduce`
  переход сразу приходит на `426`;
- если сфокусированная кнопка скрывается при resize, скрипт сначала снимает с неё
  focus — console не получает скрытый focus target.

| Width | Pager | Лента / карточки | Page overflow |
|---:|---|---|---:|
| 1920 | visible | 1320 / 2174px; border-box 428 / 467 / 428px | 0 |
| 1366 | visible | 1298 / 2137px; 421 / 459 / 421px | 0 |
| 1024 | visible | 973 / 1602px; 316 / 344 / 316px | 0 |
| 991 | hidden | native thin scrollbar; 340px tracks; исходный token margin 41.29px | 0 |
| 390 | hidden | native thin scrollbar; 280px tracks; исходный token margin 40px | 0 |

На `≤991` pager получает `hidden`, `aria-hidden=true`, `has-controls` снимается,
и остаётся браузерный horizontal scroll/swipe без page overflow. При трёх карточках
этот же runtime-контракт не покажет pager и оставит исходный верхний отступ ленты.

Evidence: [1440](shots/private-equity--c8-sec--pager-staging-1440.png),
[1920](shots/private-equity--c8-sec--pager-staging-1920.png),
[991](shots/private-equity--c8-sec--pager-staging-991.png),
[390](shots/private-equity--c8-sec--pager-staging-390.png).
