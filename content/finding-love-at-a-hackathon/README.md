# Finding Love at a Hackathon

Ten complete original episodes of a planned 45-episode vertical romance thriller, with room to expand to 60. [name] is the main actor in every shot. Each episode has exactly ten eight-second shots: 80 seconds per episode, 100 shots and 13 minutes 20 seconds total. The first three are the initial batch; all ten are complete.

**Current audio brief:** generate normal full scene audio. Only [name]'s one focus word is visibly mouthed without voice. All other dialogue, ambience, music and effects sound normal. There are no word timestamps or synchronization requirements. The prompts directly request this behavior.

Start with [episode 01's complete script](episodes/episode-01.md) or its [machine-readable shot data](shot-data/episode-01.json). Every shot includes camera, visible action, dialogue, one word and meaning, a short marked learner line, continuity and a copyable, self-contained 9:16 video prompt. The user character/selfie reference must be supplied when generating; this package does not invent [name]'s appearance or include a reference image.

**Recurring co-star:** Lucy is [name]'s fictional adult romantic co-star and product-design partner, visibly present alongside [name] in all 100 shots. Her identity comes from the supplied Lucy character reference, named **lucy.png** by the application. Prompts distinguish Lucy's reference from [name]'s selfie, preserve the hackathon wardrobe, and use the same cast name in dialogue, shot data and overlays. Binary packaging and reference-image API handling belong to the application.

| Episode | Title | Script | Shot data |
| --- | --- | --- | --- |
| 01 | The Last Seat | [Read](episodes/episode-01.md) | [JSON](shot-data/episode-01.json) |
| 02 | Her Signature | [Read](episodes/episode-02.md) | [JSON](shot-data/episode-02.json) |
| 03 | Page Two | [Read](episodes/episode-03.md) | [JSON](shot-data/episode-03.json) |
| 04 | One Place | [Read](episodes/episode-04.md) | [JSON](shot-data/episode-04.json) |
| 05 | A Better Offer | [Read](episodes/episode-05.md) | [JSON](shot-data/episode-05.json) |
| 06 | Two Helpers | [Read](episodes/episode-06.md) | [JSON](shot-data/episode-06.json) |
| 07 | The Honest Error | [Read](episodes/episode-07.md) | [JSON](shot-data/episode-07.json) |
| 08 | Two Yeses | [Read](episodes/episode-08.md) | [JSON](shot-data/episode-08.json) |
| 09 | Your Turn | [Read](episodes/episode-09.md) | [JSON](shot-data/episode-09.json) |
| 10 | Hold Our Place | [Read](episodes/episode-10.md) | [JSON](shot-data/episode-10.json) |

Supporting files:

- [Series, cast, wardrobe, location and prop continuity](SERIES_BIBLE.md).
- [First-ten arc, cliffhanger payoffs, later phases and optional expansion](ARC.md).
- [Source-linked format research and techniques actually used](RESEARCH.md).
- [Production and prompt instructions](PRODUCTION.md).
- [Shot-data field contract](SHOT_DATA.md), [JSON Schema](shot-data.schema.json) and [export manifest](shot-data/manifest.json).
- [Reusable episode template](templates/episode-template.md) and [single-shot JSON template](templates/shot-template.json).
- [Editorial review](EDITORIAL_REVIEW.md) and [structural validation results](VALIDATION.md).

The Markdown scripts in `episodes/` are the source of truth. Edit those first, then regenerate the JSON with the standard-library tools. Do not edit an exported learner line or video prompt independently.

From this worktree root:

```sh
python3 content/finding-love-at-a-hackathon/tools/export_shots.py
python3 content/finding-love-at-a-hackathon/tools/validate.py --report
python3 content/finding-love-at-a-hackathon/tools/export_shots.py --check
```

This is an isolated writing package. It contains no application integration, rendered video, credentials or infrastructure changes. Video generation and paid requests are outside this package. Delivery to the existing repository does not create a separate website.
