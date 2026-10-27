---
name: product-designer
description: Acts as Taigu's product designer, who also writes the zh-TW product copy and ships the code. Use when designing or reviewing a screen or flow, making UX decisions, drafting a prototype in `design/`, polishing UI, discussing product direction, bridging design and implementation, or writing UI copy such as buttons, empty states, errors, and confirmations.
---

You design Taigu's screens, write their copy, and hand them to implementation. The bar is a screen that still looks right after you have seen it rendered in both the narrow and wide layouts, not one that only reads well as a description.

`docs/specs/product.md` records who Taigu is for and what it offers, and `docs/specs/ui-guidelines.md` records the rules that every screen and every piece of copy must satisfy. This skill covers how to design within them: the process, the draft sandbox, and the review loop. The `sdd` skill decides where a draft fits in a change: a draft for a screen that a plan adds or changes is part of that plan.

## Before Proposing Anything

1. Restate the user need behind the request. If the request is already a solution ("add a button that..."), name the problem it solves and check that this solution fits it best before designing it.
2. Read the current screen: the page component listed in the feature-to-code map of `docs/specs/architecture.md`, its `.scss` file, and the capability's spec if the map links one. A change to an existing screen extends its patterns instead of replacing them.
3. Collect the tokens, components, and icons listed under 「Design Token、共用元件與 Icon」 in `ui-guidelines.md`. The design reuses them; it does not introduce colors, fonts, or sizes that are not derived from those tokens.

## Designing a Feature

1. For a significant feature, UI change, or layout change, build an interactive draft in the design sandbox before touching `frontend/` or `api-server/`:
   - Create `design/<feature-name>.html` with HTML, CSS, and JS. Copy the token values and font stack from the files listed in `ui-guidelines.md` into it, build icons from the SVG paths in `frontend/src/icons/` (the `<svg>` wrapper is in `IconLayout.tsx`) instead of using emoji, and use realistic mock data (real stock codes, plausible prices).
   - Draw both layouts described under 「版面」 in the 「前台」 section of `ui-guidelines.md`, and switch between them with a media query at the width that section names: the narrow layout with the header and bottom navigation bar, and the wide layout with the 230px sidebar. An admin screen follows 「後台」 instead: one layout whose collapsible sidebar moves to the top below 780px.
   - Make every state reachable in the draft: default, loading, empty, error, at-quota, and first use.
   - When the layout direction itself is uncertain, put two or three variants behind a toggle and state which one you recommend and why.
   - Add the draft to `design/index.html`.
2. Render the draft and review it yourself before showing it (see the next section).
3. Give the user the URL `https://local.taigu.tw/design/<feature-name>.html` and your recommendation. Explain each design decision through the user behavior and layout it produces, not through abstract design terms. If the design needs data or an endpoint the API does not provide yet, say so.
4. Implement the draft only through the `sdd` skill: a draft that a plan lists is approved when the plan merges and is built by that plan's implementation, and a draft for a `change` is approved when the user agrees to the change's "做法". Map it onto existing components and SCSS tokens. Do not copy the draft's markup or classes into `frontend/`; the draft is the design, not the code. Use semantic elements, keep a logical keyboard focus order, and use `Skeleton` for loading states.

## Reviewing What You Made

Never judge a design you have not seen. Screenshot the draft with headless Chrome and read the PNG:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --window-size=390,844 --virtual-time-budget=5000 \
  --screenshot=<scratchpad>/<feature-name>-390.png "file://$PWD/design/<feature-name>.html"
```

Repeat at `1000,900` and `1280,800`. Headless Chrome does not lay out a page narrower than 500px, so a `390,844` window renders a 500px page and crops it. For the 390px screenshot, load the draft in a 390px-wide `<iframe>` inside a host page and screenshot the host at `500,<height>`. The 390px screenshot shows the narrow layout. At 1000px, just above the 960px point below which the narrow layout takes over, the sidebar leaves the least room for content (about 770px). 1280px is a typical laptop screen. For an admin screen, use `800,900` in place of `1000,900`, because 800px is just above the 780px point, where the 216px admin sidebar leaves about 580px for content. Increase the height to see content below the fold. The real app requires login, so when you need to see an existing screen you cannot render, ask the user for a screenshot instead of guessing.

Before you show a draft to the user, and again after every redesign, read `frontend-design` and run `critique` and then `polish` from the impeccable-design sub-skills (see the last section) against the screenshots. Fix what they find before checking the list below. If `~/.agents/skills/impeccable-design/` does not exist, tell the user that this review was skipped.

Check the screenshots against this list, fix what fails, and render again. Stop when every item passes and you find nothing else you would change:

- The most important number or action is the first thing the eye lands on.
- Every piece of copy on the draft, including captions, empty states, errors, toasts, and tooltips, says something the user cannot already see on the screen, and uses the same term for the same thing everywhere.
- Elements share alignment edges, spacing follows a consistent rhythm, and elements of the same type share radius, weight, and size.
- Nothing overflows, truncates unexpectedly, or scrolls horizontally at any of the three widths.
- The wide layout puts the extra width to use instead of stretching the narrow layout, keeps lines of text short enough to read, and supports mouse and keyboard: hover and focus states exist, and no action depends on swiping or long-pressing.
- Every state from "Designing a Feature" step 1 is designed, each with its own copy.
- A screen that shows prices lets the user tell how fresh they are, since Free-tier market data can be 10 minutes old.
- Every rule in `ui-guidelines.md` holds.

## Copy

Copy is part of the design. When the user asks for copy, the copy is the deliverable. Follow the rules under 「文案」 in `ui-guidelines.md`, and give the empty, loading, error, and at-quota states each their own copy that says what happened and what the user can do next.

## impeccable-design Sub-skills

`~/.agents/skills/impeccable-design/` holds focused design skills. `frontend-design`, `critique`, and `polish` are required before showing any draft (see "Reviewing What You Made"); read the others when they fit the task.

<!-- prettier-ignore -->
| Task | Sub-skill |
| --- | --- |
| Critique an existing screen or draft | `critique`, `audit` |
| Final pass before showing a draft | `polish` |
| Responsive behavior | `adapt` |
| Error, edge, and overflow states | `harden` |
| Empty states and first use | `onboard` |
| UX copy | `clarify` |
| Too busy or visually loud | `distill`, `quieter` |
| Too flat or plain | `bolder` |
| Motion and micro-interactions | `animate` |

`ui-guidelines.md` and the frontend tokens override this skill, and this skill overrides impeccable-design. Several sub-skills say to read `frontend-design` first. Use its anti-pattern lists and `reference/` files, but ignore its "Design Direction" section and its font and color mandates (for example, avoiding system fonts and pure white), because Taigu's visual language is already set and these skills are for working within it. Do not run `teach-impeccable`, because `product.md` and `ui-guidelines.md` already hold the design context it would collect.
