# Rune Form

A powerful, type-safe, reactive form builder for Svelte 5 — built on runes and schema validation with support for nested fields, arrays, async validation, and reusable field components.

## ✨ Features

- ⚡️ Powered by Svelte 5 runes (`$state`, `$effect`, etc.)
- ✅ Type-safe `form.getField("user.email")` path access
- 📦 Works with `zod`, supports custom validators
- 🔁 Built-in support for nested objects & arrays
- 🔍 Custom + schema validation errors (array format)
- 📤 `FormData` handling for SvelteKit actions
- 💬 HTML input constraint generation (type, min, etc.)
- 🧠 Async validation tracking
- 🎯 Works great with `use:enhance`
- 🧪 Fully tested

---

## 📦 Installation

```bash
npm install rune-form zod
# or
pnpm add rune-form zod
```
