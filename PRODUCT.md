# Product

<!-- impeccable:product-schema 1 -->

This file exists for the `impeccable` skill, which reads product context from `PRODUCT.md`. Every section except `## Platform` links to the document under `docs/specs/` that records its facts, so the specs stay the single source of truth. Before any design work, open the linked sections and read them; this file alone does not carry the product facts.

- To change a product fact, edit the linked document through the `sdd` skill, not this file.
- To add a section, link to the document that records its facts; if no document records them yet, leave the section out.
- `## Platform` holds a bare value because `impeccable` reads it as a value and cannot follow a link. It describes the web app; a native app, if Taigu ships one, gets its own `PRODUCT.md` in the app's folder instead of a change here.
- `impeccable` only adds links that are missing here, during `init` or any other workflow. Its interview answers and the preferences it asks to record never go into this file, so sections such as `## Brand Commitments` hold only links. If one belongs in the product, tell the user; it reaches `docs/specs/` only through the `sdd` skill.

## Platform

web

## Users

See "目標使用者" in [docs/specs/product.md](docs/specs/product.md#目標使用者).

## Product Purpose

See "[定位](docs/specs/product.md#定位)" and "[範圍](docs/specs/product.md#範圍)" in `docs/specs/product.md`.

## Positioning

See "定位" in [docs/specs/product.md](docs/specs/product.md#定位).

## Capabilities and Constraints

- Scope, pricing plans, and non-goals: "[範圍](docs/specs/product.md#範圍)" and "[不做的事](docs/specs/product.md#不做的事)" in `docs/specs/product.md`.
- Terminology: "術語表" in [docs/specs/product.md](docs/specs/product.md#術語表).
- Behavior of each capability: the capability specs in [docs/specs/](docs/specs/), listed in the feature-to-code map of [docs/specs/architecture.md](docs/specs/architecture.md).
- Technical constraints: [docs/specs/architecture.md](docs/specs/architecture.md).

## Brand Commitments

- Name and tagline: "定位" in [docs/specs/product.md](docs/specs/product.md#定位).
- Voice and copy: "[語言與語氣](docs/specs/ui-guidelines.md#語言與語氣)" and "[文案](docs/specs/ui-guidelines.md#文案)" in `docs/specs/ui-guidelines.md`.

## Accessibility & Inclusion

See "可讀性與操作" in [docs/specs/ui-guidelines.md](docs/specs/ui-guidelines.md#可讀性與操作).
