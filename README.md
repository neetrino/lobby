# Զարգացման կանոնների կաղապար (Cursor AI)

Cursor-ում AI-զարգացման կանոններով repo-ի կաղապար։ Next.js / NestJS, ճարտարապետություն, կոդ, անվտանգություն, թեստեր, դեպլոյ։

---

## Ինչպես սկսել

1. **Repo** — GitHub → Use this template → clone, բացի՛ր պրոյեկտի թղթապանակը Cursor-ում։
2. **BRIEF** — լրացրու՛ `docs/BRIEF.md` (նկարագրություն, ֆունկցիաներ, ինտեգրացիաներ)։
3. **AI** — chat-ում. «Կարդա՛ docs/BRIEF.md, սկսի՛ր ըստ [project-onboarding Skill](.agents/skills/project-onboarding/SKILL.md)-ի. Փուլ 1 — չափը, Փուլ 2 — TECH_CARD. Սպասում եմ հաստատում կոդից առաջ»։
4. **Հաստատում** — TECH_CARD և ճարտարապետությունը հաստատի՛ր, ապա env։

---

## Մշակողի դերը

- **Կոդից առաջ:** BRIEF, TECH_CARD, ճարտարապետություն — AI-ն առաջարկում է, դու հաստատում ես։
- **Տվյալներ (AI-ն կխնդրի ըստ need-ի):** Neon (DATABASE_URL), R2 (bucket + բանալիներ), Vercel (env), Auth (OAuth), Resend/Stripe/Դոմեն — անհրաժեշտության դեպքում։
- **Env:** Ստեղծել `.env` + `.env.example` (առանց գաղտնիքների), `.gitignore`-ում — `.env`, `.env.local`. 
Հերթականություն. 
Neon → `.env`
R2 →  `.env`
Resend / Upstash (եթե պետք է) → `.env`. Գաղտնիքները միայն env-ում, `.env` — չի commit-վում։
- **Ընթացքում:** Պատասխանի՛ր AI-ի հարցերին, ստուգի՛ր PROGRESS.md, թեստավորի՛ր փուլերը։
- **Ավարտին:** TECH_CARD ✅, PROGRESS 100%, դեպլոյ + .env.example փաստաթղթավորված։

---

## Նախագծերի չափեր

| Չափ | Նկարագրություն | Կառուցվածք |
|-----|-----------------|------------|
| **A** | 1–3 ամիս, 5–15 ֆիչ | `src/app`, `components`, `lib` |
| **B** | 3–6 ամիս, 15–50 ֆիչ | `src/features/*`, `shared/*` |
| **C** | 6+ ամիս, 50+ ֆիչ | Monorepo `apps/*`, `packages/*` |

**Տեղեկատուներ.** [project sizing](.agents/skills/project-onboarding/references/project-sizing.md), `docs/reference/knowledge-base/`, `docs/reference/templates/` — նախագծի չափեր, տեխնիկական տեղեկություններ և փաստաթղթերի կաղապարներ։ Agent համակարգի կառուցվածքը՝ [`.agents/system/ARCHITECTURE.md`](.agents/system/ARCHITECTURE.md)։

## Rules և Skills

- `docs/` — ստեղծվող product-ի փաստաթղթեր։
- `.cursor/rules/` — Cursor-ի մշտական և file-scoped coding standards։
- `.agents/skills/` — Cursor-ի և Codex-ի reusable task workflow-ներ։
- [`.agents/catalog/`](.agents/catalog/) — Skill registry, profiles և external provenance։
- `.agents/system/` — Agent համակարգի architecture և governance փաստաթղթեր։
- Skill-ի մանրամասն references-ը բացվում են միայն անհրաժեշտության դեպքում։

Կառուցվածքի ստուգում՝

```bash
node scripts/validate-agent-config.mjs
```

---

## Կանոնների թարմացում

Template-ի կանոնները թարմացվում են։ Գոյություն ունեցող նախագծում. ավելացրու՛ կաղապարը remote, fetch արա՛, ապա merge/checkout արա՛ անհրաժեշտ `.cursor/rules/*.mdc` ֆայլերը (մանրամասներ — Git-ի remote/fetch/checkout ուղեցույցներ)։

---

## Quality Automation

Պրոյեկտ ստեղծելուց հետո AI-ն կարգավորում է TECH_CARD-ում հաստատված quality workflow-ը։ Մշակողը կարգավորում է Branch Protection (`main`), Secret Protection և dependency updates՝ ըստ ընտրված platform-ի։ Օրինակը՝ `docs/reference/workflows/ci-quality.yml.example`։

---

[MIT](LICENSE) — ազատ օգտագործում և հարմարեցում։
