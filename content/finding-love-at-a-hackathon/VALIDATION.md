# Finding Love at a Hackathon
## Validation results

Validated November 13, 2026. Local content checks use no app build, video generation or network API. Required repository CI is reported on the content PR.

| Episode | Shots | Source cap | Runtime | Audio rule |
| --- | ---: | ---: | ---: | --- |
| E01 — The Last Seat | 10 | 8s | 80s | Full soundtrack; only focus word silently mouthed |
| E02 — Her Signature | 10 | 8s | 80s | Full soundtrack; only focus word silently mouthed |
| E03 — Page Two | 10 | 8s | 80s | Full soundtrack; only focus word silently mouthed |
| E04 — One Place | 10 | 8s | 80s | Full soundtrack; only focus word silently mouthed |
| E05 — A Better Offer | 10 | 8s | 80s | Full soundtrack; only focus word silently mouthed |
| E06 — Two Helpers | 10 | 8s | 80s | Full soundtrack; only focus word silently mouthed |
| E07 — The Honest Error | 10 | 8s | 80s | Full soundtrack; only focus word silently mouthed |
| E08 — Two Yeses | 10 | 8s | 80s | Full soundtrack; only focus word silently mouthed |
| E09 — Your Turn | 10 | 8s | 80s | Full soundtrack; only focus word silently mouthed |
| E10 — Hold Our Place | 10 | 8s | 80s | Full soundtrack; only focus word silently mouthed |

All structural checks pass:

- Ten canonical scripts, ten matching episode JSON exports and one export manifest.
- Exactly ten shots per episode, 100 unique shot IDs and 800 seconds total (13:20). Every episode is 80 seconds (01:20).
- Every source shot is eight seconds; edit ranges are contiguous and totals are within 60–120 seconds.
- Every camera/action description keeps [name] visible; every prompt requires the supplied reference and a recognizable face throughout.
- Lucy is the reference-backed recurring romantic co-star. All 100 prompts bind lucy.png to Lucy, including an explicit off-screen instruction in E02-S03. Leo and Jules remain distinct.
- Exactly one primary focus object per shot; one exact focus-word occurrence in its short plain learner line; exact [name] speaker label.
- Plain lines and silently-mouthed performance annotations agree. All supporting dialogue is voiced normally.
- Every prompt requests dialogue, ambience, sound effects and score, keeps that background continuous, and leaves only the one [name] focus word unvoiced.
- Word-onset fields, fixed word timestamps and globally silent-source instructions are absent. No synchronization is required.
- Dialogue budgets fit the eight-second design: no more than 20 words total, eight in the learner line or seven per supporting line.
- Each prompt carries its own cast, wardrobe, setting, light, action and starting/ending continuity state.
- Cliffhanger IDs form the E01–E10 chain; every ending names its next payoff, with E11 explicitly planned rather than scripted.
- JSON exports match the canonical Markdown, including script hashes in the manifest.

Editorial review is recorded in [EDITORIAL_REVIEW.md](EDITORIAL_REVIEW.md). Prompt intent, visible blocking and dialogue budgets are verified at script level. No clips have been generated, so actual actor-reference fidelity, target-only silent mouthing and soundtrack performance remain untested.
