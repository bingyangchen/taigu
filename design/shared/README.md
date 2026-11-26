# Shared Draft Styles

`components.css` holds the frontend's real styles, compiled from `frontend/src`: the design tokens of `frontend/src/styles/` as CSS custom properties (`var(--color-text-secondary)`, `var(--font-size-data)`, `var(--space-200)`), the base styles, and the styles of the shared components that drafts use. Do not edit it by hand; regenerate it with the command in the `product-designer` skill.

A draft links it before its own styles:

```html
<link rel="stylesheet" href="shared/components.css" />
```

To draw a shared component, copy the DOM that the component's `.tsx` renders and use its classes:

- Classes from a component's `.module.scss` file are prefixed with the component's name, such as `Button_main Button_primary_fill Button_l`, `LabeledInput_main`, and `SegmentedControl_trigger`.
- A state class that the component toggles from JavaScript, such as `LabeledInput_focused`, is toggled by the draft's own script.
