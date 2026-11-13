#!/usr/bin/env python3
"""Export canonical Markdown scripts. Standard library only; no network or generation."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TITLE = 'Finding Love at a Hackathon'
FIELDS = re.compile(r'^\*\*([^\n]+?):\*\* (.*)$', re.M)
SHOTS = re.compile(r'^### (E\d{2}-S\d{2}) \| (\d{2}:\d{2})-(\d{2}:\d{2}) \| (\d+) seconds$', re.M)


def seconds(value: str) -> int:
    minutes, secs = map(int, value.split(':'))
    return minutes * 60 + secs


def dialogue(value: str) -> dict | None:
    if value == 'None':
        return None
    speaker, line = value.split(' | ', 1)
    return {'speaker': speaker, 'text': line, 'delivery': 'voiced_normally'}


def parse_script(path: Path) -> dict:
    source = path.read_text()
    assert source.startswith('# ' + TITLE + '\n'), f'{path.name}: wrong series title'
    matches = list(SHOTS.finditer(source))
    head = dict(FIELDS.findall(source[:matches[0].start()]))
    number = int(head['Episode number'])
    result = {
        'schema_version': '1.1',
        'series_title': TITLE,
        'episode_number': number,
        'episode_id': head['Episode ID'],
        'episode_title': head['Episode title'],
        'source_script': str(path.relative_to(ROOT)),
        'duration_seconds': int(head['Runtime seconds']),
        'aspect_ratio': '9:16',
        'audio_mode': 'full_scene_audio_focus_word_silently_mouthed',
        'story_time': head['Story time'],
        'hook': head['Immediate hook'],
        'incoming_cliffhanger_id': head['Incoming cliffhanger ID'],
        'incoming_payoff': head['Incoming payoff'],
        'turn': head['Emotional reversal'],
        'relationship_beat': head['Relationship beat'],
        'cliffhanger': {
            'id': head['Closing cliffhanger ID'],
            'event': head['Closing cliffhanger'],
            'next_payoff': head['Next payoff'],
        },
        'shots': [],
    }
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(source)
        block = source[match.end():end]
        fields = dict(FIELDS.findall(block))
        prompt = re.search(r'\*\*Copyable video prompt:\*\*\s*```text\n(.*?)\n```', block, re.S)
        assert prompt, f'{match[1]}: missing prompt'
        start_s, end_s = seconds(match[2]), seconds(match[3])
        assert fields['Learner line'].startswith('[name]: '), f'{match[1]}: missing [name] label'
        learner = {
            'speaker': fields['Learner speaker'],
            'text': fields['Plain learner text'],
            'performance_text': fields['Learner line'].removeprefix('[name]: '),
            'labelled_text': fields['Learner line'],
            'focus_delivery': fields['Focus delivery'],
        }
        voices = [dialogue(fields['Before dialogue']), learner,
                  dialogue(fields['After dialogue'])]
        result['shots'].append({
            'id': match[1], 'shot_number': i + 1,
            'duration_seconds': int(match[4]), 'source_duration_seconds': int(match[4]),
            'episode_start_seconds': start_s, 'episode_end_seconds': end_s,
            'scene': fields['Scene'], 'location_id': fields['Location ID'],
            'camera': fields['Camera'], 'beat': fields['Dramatic function'],
            'visible_cast': fields['Visible cast'].split(' | '),
            'visible_action': fields['Visible action'],
            'protagonist_visible_throughout': fields['[name] visible throughout'] == 'Yes',
            'focus_word': {
                'word': fields['Focus word'], 'meaning': fields['Plain-English meaning'],
                'primary': True, 'delivery': 'silently_mouthed_by_[name]',
            },
            'learner_line': learner,
            'dialogue': [v for v in voices if v],
            'sound_cues': fields['Sound cues'],
            'continuity': {'in': fields['Continuity in'], 'out': fields['Continuity out']},
            'edit_only_overlay': fields['Edit-only overlay'],
            'video_prompt': prompt[1],
        })
    return result


def serialized(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + '\n'


def expected_exports() -> dict[str, str]:
    exports = {}
    records = []
    for path in sorted((ROOT / 'episodes').glob('*.md')):
        episode = parse_script(path)
        name = f"episode-{episode['episode_number']:02}.json"
        exports[name] = serialized(episode)
        records.append({
            'episode_id': episode['episode_id'], 'episode_title': episode['episode_title'],
            'script': episode['source_script'], 'shot_data': 'shot-data/' + name,
            'script_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'shots': len(episode['shots']), 'duration_seconds': episode['duration_seconds'],
        })
    exports['manifest.json'] = serialized({
        'schema_version': '1.1', 'series_title': TITLE, 'source_of_truth': 'episodes/*.md',
        'audio_mode': 'full_scene_audio_focus_word_silently_mouthed',
        'planned_episodes': 45, 'optional_expansion_episodes': 60,
        'completed_episodes': len(records), 'completed_shots': sum(r['shots'] for r in records),
        'completed_runtime_seconds': sum(r['duration_seconds'] for r in records),
        'episodes': records,
    })
    return exports


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Compare without writing')
    args = parser.parse_args()
    expected = expected_exports()
    errors = []
    for filename, body in expected.items():
        path = ROOT / 'shot-data' / filename
        if args.check:
            if not path.exists() or path.read_text() != body:
                errors.append(str(path.relative_to(ROOT)))
        else:
            path.write_text(body)
    if args.check:
        actual = {p.name for p in (ROOT / 'shot-data').glob('*.json')}
        errors.extend('unexpected: ' + p for p in sorted(actual - expected.keys()))
    if errors:
        raise SystemExit('Export mismatch: ' + ', '.join(errors))
    print(f"{'Verified' if args.check else 'Exported'} {len(expected) - 1} episode files and manifest.")


if __name__ == '__main__':
    main()
