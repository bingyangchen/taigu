# Shared Draft Styles

`components.css` holds the frontend's real styles, compiled from `frontend/src`: the tokens of `_design_system.scss` as CSS custom properties (`var(--blue)`, `var(--light-gray)`), the base styles of `index.scss`, and the styles of the shared components that drafts use. Do not edit it by hand; regenerate it with the command in the `product-designer` skill.

A draft links it before its own styles:

```html
<link rel="stylesheet" href="shared/components.css" />
```

To draw a shared component, copy the DOM that the component's `.tsx` renders and use its classes:

- Classes from a component's `.scss` file keep their names, such as `button primary_fill l` for `Button`.
- Classes from a component's `.module.scss` file are prefixed with the component's name, such as `LabeledInput_main` and `SegmentedControl_trigger`.
- A state class that the component toggles from JavaScript, such as `LabeledInput_focused`, is toggled by the draft's own script.
