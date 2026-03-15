# Theme Modules

Essence Craft now loads extra themes automatically from this folder.

To add a new theme, drop a `.json` file in `themes/`. No base app code changes are required.
If you need richer selectors, pseudo-elements, or layout overrides, add a sibling `.css` file with the same base name.

## Supported fields

```json
{
  "id": "emberstorm",
  "label": "Emberstorm",
  "description": "Optional human-readable note",
  "unlockRequirement": "signed-in",
  "variables": {
    "app-background": "linear-gradient(180deg, #2b120d 0%, #120806 100%)",
    "panel": "rgba(40, 18, 14, 0.9)",
    "accent": "#ff9a4d"
  },
  "extraCss": "{{selector}} .workbench { box-shadow: inset 0 0 40px rgba(255, 154, 77, 0.08); }"
}
```

## Notes

- `id` must be lowercase letters, numbers, and dashes only.
- `unlockRequirement` can be `"public"` or `"signed-in"`.
- `variables` maps directly to the app CSS custom properties without the leading `--`.
- In `extraCss`, use `{{selector}}` as a placeholder for the generated theme selector.
- `themes/emberstorm.css` will be loaded automatically alongside `themes/emberstorm.json` when it exists.
- The sibling `.css` file is the best place for complex selectors like `.workbench::before`, hover treatments, or one-off component polish.
- If a theme file is malformed, the loader skips it instead of crashing the app.
