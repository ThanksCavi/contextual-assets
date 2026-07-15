# Industry Patterns Accordion Design

## Goal

Add accessible open and close behavior to the cards in `.industry-patterns` on the Industry Page. The interaction should match the existing `.process-slider` accordion without introducing unrelated visual styles.

## Scope

- Add `webflow-scripts/industry/industry-patterns.js` for behavior.
- Add `webflow-scripts/industry/industry-patterns.css` only for the reveal transition and state-dependent layout required by the interaction.
- Do not change Webflow-generated markup in this repository. The data attributes will be applied in Webflow Builder by the site editor.
- Do not add typography, color, spacing, borders, or other presentation owned by Builder.

## Builder Contract

Apply these attributes:

| Element | Attribute |
| --- | --- |
| `.industry-patterns` section | `data-industry-patterns` |
| Each `article.card` | `data-industry-pattern` |
| The closed-state “What it is” block | `data-industry-pattern-summary` |
| The additional “What changes” block | `data-industry-pattern-details` |
| The “View more” button | `data-industry-pattern-toggle` |

The always-visible blue title block needs no interaction attribute. Remove the copied `data-steps-card`, `data-steps-summary`, `data-steps-reveal`, and `data-steps-toggle` attributes from this section after adding the new attributes.

Each pattern card must contain exactly one summary, details block, and toggle. Cards missing any required element are ignored and produce one concise console warning for their section.

## Interaction

- All cards start closed.
- Activating a card toggle opens that card and closes every other card in the same section.
- Activating the open card's toggle closes it, if the toggle is still available to assistive technology or custom markup.
- The toggle is hidden while its card is open, matching `.process-slider`.
- Clicking the open details surface closes the card unless the click originated from an interactive descendant such as a link, button, input, select, textarea, summary, or independently focusable element.
- Enter or Space on the focusable details surface closes it and returns focus to the toggle.
- A keyboard-originated toggle activation moves focus to the details surface without scrolling.
- Multiple `[data-industry-patterns]` sections, if present, operate independently.

## Accessibility

During initialization, JavaScript:

- ensures every details block has a unique `id`;
- makes each toggle a button and links it to the details block with `aria-controls`;
- maintains `aria-expanded` on the toggle;
- maintains `aria-hidden` and `tabindex` on the details block;
- supplies a close label and button role to the details surface only when Builder has not already supplied them.

Interactive descendants retain their native behavior and do not trigger closing.

## Animation

The card receives `is-open` as its only state class. CSS collapses the summary and expands the details block in the open state, using a CSS grid-row transition so the details height can follow its content. Closing performs the reverse transition.

Under `prefers-reduced-motion: reduce`, transitions are disabled while state changes remain functional.

## Failure Handling

- If no `[data-industry-patterns]` root exists, initialization exits silently.
- A malformed section does not prevent valid cards or other sections from initializing.
- Repeated initialization does not attach duplicate event listeners.
- No GSAP or home-page motion runtime is required.

## Verification

Automated tests cover initial closed state, open/close behavior, one-open-card enforcement, interactive-descendant clicks, keyboard closing and focus restoration, independent roots, malformed cards, and idempotent initialization. A syntax check and focused test command must pass before completion.
