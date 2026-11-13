#!/usr/bin/env python3
"""Show official DSH headless review sessions in a persistent tmux pane."""
import argparse
import datetime
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time


def save(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def display(value):
    text = re.sub(r'sk-[A-Za-z0-9_-]+', '[credential redacted]', str(value))
    print(re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '', text), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pair-dir', type=Path, required=True)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--launcher', type=Path, required=True)
    args = parser.parse_args()
    pair = args.pair_dir.resolve()
    requests = pair / 'requests'
    requests.mkdir(parents=True, exist_ok=True)
    lock = (pair / 'worker.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    state_file = pair / 'dsh-state.json'
    sessions_file = pair / 'dsh-sessions.json'
    sessions = json.loads(sessions_file.read_text()) if sessions_file.exists() else {}
    display('DSH | official headless sessions | independent reviewer | no recording')
    save(state_file, {'phase': 'idle', 'pid': os.getpid(), 'updatedAt': now()})
    while True:
        if (pair / 'PAUSED').exists():
            time.sleep(2)
            continue
        pending = [p for p in sorted(requests.glob('*.json'))
                   if not p.with_suffix('.result.json').exists() and not p.name.endswith('.result.json')]
        if not pending:
            time.sleep(2)
            continue
        request_path = pending[0]
        request = json.loads(request_path.read_text())
        game = request['game']
        game_root = (args.project / 'download' / game).resolve()
        if game_root.parent != (args.project / 'download').resolve():
            raise ValueError('Game must be a direct child of download/')
        evidence = Path(request['evidenceDirectory']).resolve()
        evidence.relative_to(game_root / 'scripts' / 'recording-data')
        evidence.mkdir(parents=True, exist_ok=True)
        report = evidence / (request_path.stem + '-dsh.md')
        events = evidence / (request_path.stem + '-dsh.events.jsonl')
        errors = evidence / (request_path.stem + '-dsh.stderr.log')
        command = [str(args.launcher), '--profile', 'headless', '--json']
        if game in sessions:
            command += ['--session-id', sessions[game]]
        command += ['-']
        environment = os.environ.copy()
        environment['DSH_PERMISSION_MODE'] = 'read-only'
        environment['PATH'] = '/home/ubuntu/.nvm/versions/node/v22.23.3/bin:' + environment['PATH']
        display('\n[' + now() + '] ' + game + ' / ' + request_path.stem)
        final = None
        with errors.open('w') as stderr, events.open('w') as event_log:
            process = subprocess.Popen(command, cwd=args.project, env=environment,
                                       stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                       stderr=stderr, text=True, start_new_session=True)
            save(state_file, {'phase': 'reviewing', 'pid': os.getpid(), 'dshPid': process.pid,
                              'game': game, 'request': request_path.name, 'updatedAt': now()})
            try:
                process.stdin.write(request['prompt'])
                process.stdin.close()
                for line in process.stdout:
                    event_log.write(line)
                    event_log.flush()
                    event = json.loads(line)
                    kind = event.get('type')
                    if kind == 'session':
                        session_id = event.get('sessionId') or event.get('id')
                        if session_id:
                            sessions[game] = session_id
                            save(sessions_file, sessions)
                        display('session: ' + str(session_id))
                    elif kind == 'tool_call':
                        display('> ' + str(event.get('tool')) + ' ' +
                                json.dumps(event.get('input', {}), ensure_ascii=False)[:1000])
                    elif kind == 'tool_result':
                        display('  ' + str(event.get('status', 'returned')))
                    elif kind == 'thinking':
                        display('... analysing ...')
                    elif kind in ('text', 'error'):
                        display(event.get('text') or event.get('message') or event)
                    elif kind == 'final':
                        final = event.get('text', '')
                        display(final)
                return_code = process.wait()
            except BaseException:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=20)
                raise
        if final is not None:
            report.write_text(final + '\n')
        result = {'game': game, 'exitCode': return_code, 'finalPresent': final is not None,
                  'report': str(report), 'events': str(events), 'stderr': str(errors),
                  'sessionId': sessions.get(game), 'updatedAt': now()}
        save(request_path.with_suffix('.result.json'), result)
        save(state_file, dict(result, phase='idle' if return_code == 0 else 'review-failed',
                              pid=os.getpid(), dshPid=None))
        if return_code != 0:
            (pair / 'PAUSED').write_text('Review failed; inspect native logs before resuming.\n')
        display('Review finished; report: ' + str(report))


if __name__ == '__main__':
    def stop(_signal, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    main()
