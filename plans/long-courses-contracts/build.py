import re, pathlib
full = pathlib.Path('/Users/riley/Projects/games/.claude/worktrees/deliver-long-courses/plans/long-courses.md').read_text()
plan = full[full.index('### Phase 2'):full.index('### Phase 3')] + '\n### '
head = pathlib.Path('common-head.md').read_text()
tail = pathlib.Path('common-tail.md').read_text()
G='games/rush-racers/'
lanes = {
 'a': dict(title='Sunlit Shallows: The Maelstrom', course='sunlit-shallows', theme='ocean', mech='whirlpools (`scenarios/whirlpool-ride.ts` on its swim test course)',
   owns=['src/logic/courses/sunlit-shallows.ts','src/logic/top-route.test.ts','src/logic/race/flowfield.test.ts','scenarios/kit.ts','src/engine/themes/ocean.ts','src/engine/themes/ocean.test.ts','src/engine/themes/ocean/'],
   extra_tests='src/logic/top-route.test.ts src/logic/race/flowfield.test.ts',
   extra_cmds='pnpm arcade see rush-racers --scenario race-to-finish\npnpm arcade see rush-racers --scenario dnf-results'),
 'b': dict(title='Bramble Run: Millstream, Hollow Oak, Rotten Bridges', course='bramble-run', theme='forest', mech='crumbling branches (`scenarios/crumble-bridge.ts` on `run-test`)',
   owns=['src/logic/courses/bramble-run.ts','src/engine/themes/forest.ts','src/engine/themes/forest.test.ts','src/engine/themes/forest/'],
   extra_tests='src/logic/media/run/nav.test.ts', extra_cmds=''),
 'c': dict(title='Thunderhead Pass: Sunbreak, Crow Cliffs, Cannon Clouds', course='thunderhead-pass', theme='sky', mech='cloud cannons (`scenarios/cannon-launch.ts` on `sky-test`)',
   owns=['src/logic/courses/thunderhead-pass.ts','src/engine/themes/sky.ts','src/engine/themes/sky.test.ts','src/engine/themes/sky/'],
   extra_tests='', extra_cmds='pnpm arcade see rush-racers --scenario how-to-play-cloudreach'),
 'd': dict(title='Slingshot Alley: Gas Giant, Debris Storm, Wormways', course='slingshot-alley', theme='space', mech='wormholes (`scenarios/wormhole-warp.ts` on `drift-test`)',
   owns=['src/logic/courses/slingshot-alley.ts','src/logic/courses/slingshot-alley.test.ts','src/engine/themes/space.ts','src/engine/themes/space.test.ts','src/engine/themes/space/'],
   extra_tests='src/logic/courses/slingshot-alley.test.ts', extra_cmds=''),
}
for k,l in lanes.items():
    m = re.search(r'#### Lane %s brief[^\n]*\n\n(.*?)(?=\n#### |\n### )' % k, plan, re.S)
    brief = m.group(1).strip()
    lane=f'lc-2{k}'; contract=f'/private/tmp/claude-501/-Users-riley-Projects-games/13be6121-5d7c-4962-8783-e8f7cd4d6a0c/scratchpad/contracts/{lane}.md'
    out = f"# Contract: {l['title']}\n\n## Goal\n\nImplement lane 2/{k} of the plan at `/Users/riley/Projects/games/.claude/worktrees/deliver-long-courses/plans/long-courses.md` (read its Spec, Phase 2 rules and your lane's brief; the brief is copied below and wins over anything else in the plan). The game is Rush Racers, `games/rush-racers/`. Your world's new mechanic from phase 1 is {l['mech']}.\n\n{brief}\n\n"
    out += head
    out += "\n## Scope\n\n- May change:\n" + ''.join(f"  - `{G}{p}`\n" for p in l['owns'])
    out += "- Must not change: everything else, in particular `games/rush-racers/src/logic/` outside your course file (and the tests listed above), other courses and themes, `games/rush-racers/src/engine/scenes/`, `audio/`, `fx/`, `view/`, `tests/`, docs, `package.json` and the lockfile.\n- Locked: none.\n"
    t = tail.replace('LANE',lane).replace('COURSE',l['course']).replace('CONTRACT',contract).replace(' EXTRA_TESTS',(' '+l['extra_tests']) if l['extra_tests'] else '')
    t = t.replace('EXTRA_CMDS\n', (l['extra_cmds']+'\n') if l['extra_cmds'] else '')
    out += t
    pathlib.Path(contract).write_text(out)
    print(lane, len(out))
