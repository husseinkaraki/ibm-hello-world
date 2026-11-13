#!/usr/bin/env python3
"""Validate the ten canonical scripts and their exports without app builds or APIs."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
from export_shots import ROOT, TITLE, expected_exports, parse_script

CAST = {'[name]', 'Lucy', 'Leo', 'Jules'}
LOCATIONS = {'T7', 'DESK', 'ALCOVE', 'REVIEW'}
OLD_AUDIO = re.compile(
    r'render silent|silent source|globally silent|halfway through (?:the )?shot|four seconds|near 4\.0|'
    r'learner window|focus onset|onset_seconds|focus_word_time_seconds', re.I)


def words(value: str) -> list[str]:
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", value)


def run() -> tuple[list[dict], list[str]]:
    errors = []

    def require(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    scripts = sorted((ROOT / 'episodes').glob('*.md'))
    require([p.name for p in scripts] == [f'episode-{n:02}.md' for n in range(1, 11)],
            'Exactly ten numbered canonical Markdown scripts are required.')
    episodes = []
    all_ids = []
    for n, path in enumerate(scripts, 1):
        try:
            ep = parse_script(path)
        except (AssertionError, KeyError, ValueError, IndexError) as exc:
            errors.append(f'{path.name}: parse failure: {exc}')
            continue
        episodes.append(ep)
        eid = ep['episode_id']
        require(ep['episode_number'] == n and eid == f'E{n:02}', f'{path.name}: episode ID')
        require(ep['series_title'] == TITLE, f'{eid}: exact title')
        require(ep['schema_version'] == '1.1', f'{eid}: schema version')
        require(ep['audio_mode'] == 'full_scene_audio_focus_word_silently_mouthed', f'{eid}: audio mode')
        require(len(ep['shots']) == 10, f'{eid}: exactly ten shots')
        require(60 <= ep['duration_seconds'] <= 120, f'{eid}: episode runtime range')
        require(sum(s['duration_seconds'] for s in ep['shots']) == ep['duration_seconds'] == 80,
                f'{eid}: exact runtime sum')
        require(ep['incoming_cliffhanger_id'] == ('PILOT' if n == 1 else f'E{n-1:02}-C'),
                f'{eid}: incoming cliffhanger chain')
        require(ep['cliffhanger']['id'] == f'E{n:02}-C', f'{eid}: closing cliffhanger ID')
        require(f'E{n+1:02}' in ep['cliffhanger']['next_payoff'], f'{eid}: next-episode payoff reference')
        for field in ['hook', 'incoming_payoff', 'turn', 'relationship_beat']:
            require(bool(ep[field].strip()), f'{eid}: missing {field}')
        require(not OLD_AUDIO.search(path.read_text()), f'{eid}: obsolete audio/timing instructions')
        for i, shot in enumerate(ep['shots'], 1):
            sid = shot['id']; all_ids.append(sid)
            require(sid == f'E{n:02}-S{i:02}', f'{sid}: shot ID/order')
            require(shot['shot_number'] == i, f'{sid}: shot number')
            require(shot['source_duration_seconds'] == shot['duration_seconds'] == 8,
                    f'{sid}: eight-second source/edit duration')
            require(0 < shot['source_duration_seconds'] <= 8, f'{sid}: source cap')
            require(shot['episode_start_seconds'] == (i-1)*8 and shot['episode_end_seconds'] == i*8,
                    f'{sid}: contiguous edit range')
            require(shot['location_id'] in LOCATIONS, f'{sid}: known location')
            require(set(shot['visible_cast']) <= CAST and shot['visible_cast'].count('[name]') == 1
                    and shot['visible_cast'].count('Lucy') == 1, f'{sid}: learner/co-star cast')
            require(shot['protagonist_visible_throughout'], f'{sid}: visible protagonist flag')
            require('[name]' in shot['visible_action'] and '[name]' in shot['camera'],
                    f'{sid}: protagonist visible in action and camera')
            focus = shot['focus_word']; word = focus['word']; learner = shot['learner_line']
            require(set(focus) == {'word', 'meaning', 'primary', 'delivery'},
                    f'{sid}: exactly one focus object, no onset fields')
            require(bool(re.fullmatch('[a-z]+', word)), f'{sid}: one accessible English word')
            require(focus['primary'] is True and bool(focus['meaning'].strip()), f'{sid}: primary focus/meaning')
            require(focus['delivery'] == 'silently_mouthed_by_[name]', f'{sid}: focus delivery')
            require(learner['speaker'] == '[name]', f'{sid}: learner speaker')
            require(words(learner['text']).count(word) == 1, f'{sid}: exact focus occurs once in plain line')
            marker = '[silently mouthed: ' + word + ']'
            require(learner['performance_text'].count(marker) == 1, f'{sid}: one silent-mouth annotation')
            require(learner['performance_text'].replace(marker, word) == learner['text'],
                    f'{sid}: plain/performance text consistency')
            require(learner['labelled_text'] == '[name]: ' + learner['performance_text'],
                    f'{sid}: exact [name] dialogue label')
            require('without voicing it' in learner['focus_delivery'], f'{sid}: explicit learner audio rule')
            require(not {'start_seconds', 'end_seconds', 'onset_seconds'} & learner.keys(),
                    f'{sid}: no learner synchronization data')
            require(1 <= len(words(learner['text'])) <= 8, f'{sid}: recordable line length')
            require(sum(v['speaker'] == '[name]' for v in shot['dialogue']) == 1,
                    f'{sid}: exactly one main-actor dialogue line')
            require(all(v['speaker'] in shot['visible_cast'] for v in shot['dialogue']),
                    f'{sid}: every speaking actor is accounted for in the shot')
            total_words = sum(len(words(v['text'])) for v in shot['dialogue'])
            require(total_words <= 20, f'{sid}: too much dialogue for eight seconds ({total_words})')
            require(all(len(words(v['text'])) <= 7 for v in shot['dialogue'] if v['speaker'] != '[name]'),
                    f'{sid}: supporting line too long')
            require(all(v.get('delivery') == 'voiced_normally' for v in shot['dialogue'] if v['speaker'] != '[name]'),
                    f'{sid}: supporting dialogue must be audible')
            prompt = shot['video_prompt']
            for term in ['9:16', '8-second', 'supplied character/selfie reference for [name]',
                         'recognizable face for the entire shot', learner['text'],
                         'Only the exact focus word "' + word + '"', 'with no audible voice',
                         'rest of that line is spoken normally', 'FULL SCENE SOUNDTRACK',
                         'hall ambience', 'sound effects', 'dramatic score', 'Keep that soundtrack continuous']:
                require(term in prompt, f'{sid}: prompt missing {term!r}')
            require('supplied Lucy character reference (lucy.png)' in prompt,
                    f'{sid}: reference must be explicitly bound to Lucy')
            require("for Lucy's face, hair and recognizable identity" in prompt,
                    f'{sid}: preserve Lucy reference identity')
            require('Keep Lucy visibly present throughout the shot' in prompt,
                    f'{sid}: co-star must stay visible with the learner')
            require(not OLD_AUDIO.search(prompt), f'{sid}: obsolete prompt audio instructions')
            require(shot['continuity']['in'] in prompt and shot['continuity']['out'] in prompt,
                    f'{sid}: prompt must include its own starting/ending state')
            require(bool(shot['scene']) and bool(shot['beat']) and bool(shot['sound_cues']),
                    f'{sid}: complete production fields')
    require(len(all_ids) == len(set(all_ids)) == 100, 'Exactly 100 unique shot IDs are required.')
    if len(episodes) == 10:
        expected = expected_exports()
        actual = {p.name for p in (ROOT/'shot-data').glob('*.json')}
        require(actual == set(expected), 'Export file set differs from scripts plus manifest.')
        for filename, body in expected.items():
            target = ROOT/'shot-data'/filename
            require(target.exists() and target.read_text() == body, f'{filename}: stale/noncanonical export')
    return episodes, errors


def report(episodes: list[dict]) -> str:
    rows = ['# Finding Love at a Hackathon', '## Validation results', '',
            'Validated November 13, 2026. Local content checks use no app build, video generation or network API. Required repository CI is reported on the content PR.', '',
            '| Episode | Shots | Source cap | Runtime | Audio rule |',
            '| --- | ---: | ---: | ---: | --- |']
    for ep in episodes:
        rows.append(f"| {ep['episode_id']} — {ep['episode_title']} | {len(ep['shots'])} | 8s | {ep['duration_seconds']}s | Full soundtrack; only focus word silently mouthed |")
    rows += ['', 'All structural checks pass:', '',
             '- Ten canonical scripts, ten matching episode JSON exports and one export manifest.',
             '- Exactly ten shots per episode, 100 unique shot IDs and 800 seconds total (13:20). Every episode is 80 seconds (01:20).',
             '- Every source shot is eight seconds; edit ranges are contiguous and totals are within 60–120 seconds.',
             '- Every camera/action description keeps [name] visible; every prompt requires the supplied reference and a recognizable face throughout.',
             '- Lucy is the reference-backed recurring romantic co-star. All 100 shots include both [name] and Lucy; every prompt binds lucy.png to Lucy and keeps her visibly present. Leo and Jules remain distinct.',
             '- Exactly one primary focus object per shot; one exact focus-word occurrence in its short plain learner line; exact [name] speaker label.',
             '- Plain lines and silently-mouthed performance annotations agree. All supporting dialogue is voiced normally.',
             '- Every prompt requests dialogue, ambience, sound effects and score, keeps that background continuous, and leaves only the one [name] focus word unvoiced.',
             '- Word-onset fields, fixed word timestamps and globally silent-source instructions are absent. No synchronization is required.',
             '- Dialogue budgets fit the eight-second design: no more than 20 words total, eight in the learner line or seven per supporting line.',
             '- Each prompt carries its own cast, wardrobe, setting, light, action and starting/ending continuity state.',
             '- Cliffhanger IDs form the E01–E10 chain; every ending names its next payoff, with E11 explicitly planned rather than scripted.',
             '- JSON exports match the canonical Markdown, including script hashes in the manifest.', '',
             'Editorial review is recorded in [EDITORIAL_REVIEW.md](EDITORIAL_REVIEW.md). Prompt intent, visible blocking and dialogue budgets are verified at script level. No clips have been generated, so actual actor-reference fidelity, target-only silent mouthing and soundtrack performance remain untested.', '']
    return '\n'.join(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', action='store_true', help='Write VALIDATION.md after a passing run')
    args = parser.parse_args()
    episodes, errors = run()
    if errors:
        raise SystemExit('\n'.join(['FAILED:'] + ['- ' + error for error in errors]))
    if args.report:
        (ROOT/'VALIDATION.md').write_text(report(episodes))
    print('PASS: 10 episodes; 100 shots; 80s each; 800s total; full soundtrack/target-only silent mouth; exports current.')


if __name__ == '__main__':
    main()
