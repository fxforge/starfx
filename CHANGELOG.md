# Changelog

## \[0.16.0]

- Update to `effection` v4.
- `thunk.manage()` API for managing `effecton` resources
- filled out JSDocs for better IDE help

### Breaking Changes

- The update to `effection` v4 may bring breaking changes depending on how deeply your effects were built on v3 semantics. See the migration blog post for `effection`.
- removed deprecated `bootup` alias from thunk/query APIs. Use `register()` instead.
- `Instruction` is no longer re-exported from `starfx`; import it directly from `effection`.

## \[0.15.0] - 2025-09-05

- react-redux as optional peerDep (@jbolda, #63)
- examples use repo starfx version (@jbolda, #65)
- scope thunks to allow managing resources (@jbolda, #64)

## \[0.14.7] - 2025-09-05

- react-redux as optional peerDep (@jbolda, #63)
- examples use repo starfx version (@jbolda, #65)
- scope thunks to allow managing resources (@jbolda, #64)

## \[0.14.6] - 2025-07-08

- Full diff: https://github.com/fxforge/starfx/compare/v0.14.5...v0.14.6

## \[0.14.5] - 2025-07-08

- Refactor matcher for correct predicate and action handling (@VldMrgnn, #62)

## \[0.14.4] - 2025-06-06

- Full diff: https://github.com/fxforge/starfx/compare/v0.14.3...v0.14.4

## \[0.14.3] - 2025-06-06

- Full diff: https://github.com/fxforge/starfx/compare/v0.14.2...v0.14.3

## \[0.14.2] - 2025-06-06

- Full diff: https://github.com/fxforge/starfx/compare/v0.14.1...v0.14.2

## \[0.14.1] - 2025-06-06

- Full diff: https://github.com/fxforge/starfx/compare/v0.14.0...v0.14.1

## \[0.14.0] - 2025-06-06

- Deno v2 And Imports (@jbolda, #54)
- confirm tests assert when run within an generator function (@jbolda, #55)
- preview package creation on PR (@jbolda, #58)
- deno to node (@neurosnap, #60)
- fix(react): exports entry (@neurosnap, #61)

## \[0.13.4] - 2024-11-17

- feat: add custom transform functions for state persistence (@VldMrgnn, #50)
- feat: support multiple stores registering the same thunk (@VldMrgnn, #51)

## \[0.13.3] - 2024-10-02

- Full diff: https://github.com/fxforge/starfx/compare/v0.13.2...v0.13.3

## \[0.13.2] - 2024-08-16

- Full diff: https://github.com/fxforge/starfx/compare/v0.13.1...v0.13.2

## \[0.13.1] - 2024-08-14

- Full diff: https://github.com/fxforge/starfx/compare/v0.13.0...v0.13.1

## \[0.13.0] - 2024-07-30

- refactor: enhanced thunk registry system (@neurosnap, #44)

## \[0.12.0] - 2024-05-07

- Full diff: https://github.com/fxforge/starfx/compare/v0.11.0...v0.12.0

## \[0.11.0] - 2024-04-15

- Full diff: https://github.com/fxforge/starfx/compare/v0.10.0...v0.11.0

## \[0.10.0] - 2024-03-05

- BREAKING CHANGE: `ctx.json` no longer has `.data` property, must use `.value` or `.error` instead

## \[0.9.0] - 2024-03-04

- refactor: simplify api (@neurosnap, #43)
- DEPRECATED: configureStore is now createStore
- BREAKING CHANGE: removed starfx/store

## \[0.8.0] - 2024-02-23

- feat: clear timers (@neurosnap, #41)
- chore: make clearTimers more ergonomic (@neurosnap, #42)
- BREAKING CHANGE: `race` was changed to `raceMap` and we are re-exporting `effection.race`

## \[0.7.2] - 2024-02-23

- Deprecate: `slice.loader` => `slice.loaders`

## \[0.7.1] - 2024-02-22

- Docs (@neurosnap, #39)
- fix: reset loader when task is cancelled (@neurosnap, #40)

## \[0.7.0] - 2024-02-10

- feat: wait for loader (@neurosnap, #37)

## \[0.6.0] - 2024-02-07

- Full diff: https://github.com/fxforge/starfx/compare/v0.5.3...v0.6.0

## \[0.5.3] - 2024-02-06

- refactor: remove `log` (@neurosnap, #35)
- ecosystem CI tests (@jbolda, #36)
- @jbolda made their first contribution (#36)

## \[0.5.2] - 2024-01-21

- Full diff: https://github.com/fxforge/starfx/compare/v0.5.1...v0.5.2

## \[0.5.1] - 2024-01-19

- chore: folder/file org cleanup (@neurosnap, #33)

## \[0.5.0] - 2024-01-18

- refactor: rm redux (@neurosnap, #32)

## \[0.4.1] - 2024-01-11

- Full diff: https://github.com/fxforge/starfx/compare/v0.4.0...v0.4.1

## \[0.4.0] - 2024-01-10

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.11...v0.4.0

## \[0.3.11] - 2024-01-08

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.10...v0.3.11

## \[0.3.10] - 2024-01-08

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.9...v0.3.10

## \[0.3.9] - 2024-01-03

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.8...v0.3.9

## \[0.3.8] - 2024-01-03

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.7...v0.3.8

## \[0.3.7] - 2023-12-18

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.6...v0.3.7

## \[0.3.6] - 2023-12-18

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.5...v0.3.6

## \[0.3.5] - 2023-12-17

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.4...v0.3.5

## \[0.3.4] - 2023-12-16

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.3...v0.3.4

## \[0.3.3] - 2023-12-14

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.2...v0.3.3

## \[0.3.2] - 2023-12-14

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.1...v0.3.2

## \[0.3.1] - 2023-12-14

- Full diff: https://github.com/fxforge/starfx/compare/v0.3.0...v0.3.1

## \[0.3.0] - 2023-12-12

- Full diff: https://github.com/fxforge/starfx/compare/v0.2.2...v0.3.0

## \[0.2.2] - 2023-12-04

- Full diff: https://github.com/fxforge/starfx/compare/v0.2.1...v0.2.2

## \[0.2.1] - 2023-12-01

- feat(query): thunk and api thunks can simply accept payload (@neurosnap, #29)
- refactor(store): `slice.table` `empty` is now optional (@neurosnap, #28)

## \[0.2.0] - 2023-12-01

- refactor(store): require data and loaders slices (@neurosnap, #24)
- feat(store): `createBatchMdw` for batching store listener events (@neurosnap, #22)
- feat(store): redux-persist replacement (@neurosnap, #21)
- fix(thunk): add `.use` to `CreateActionWithPayload` (@neurosnap, #27)

## \[0.1.0] - 2023-11-30

- refactor(query): middleware naming and supervisor work (@neurosnap, #25)
- feat: thunks dynamic mdw api (@neurosnap, #26)

## \[0.0.34] - 2023-11-19

- refactor(fx): use `call` from `effection` (@neurosnap, #20)

## \[0.0.33] - 2023-11-10

- refactor(redux): custom queue impl (@neurosnap, #19)

## \[0.0.32] - 2023-10-13

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.31...v0.0.32

## \[0.0.31] - 2023-10-13

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.30...v0.0.31

## \[0.0.30] - 2023-09-18

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.28...v0.0.30

## \[0.0.29] - 2023-09-17

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.27...v0.0.29

## \[0.0.28] - 2023-09-17

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.27...v0.0.28

## \[0.0.27] - 2023-09-16

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.26...v0.0.27

## \[0.0.26] - 2023-09-16

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.25...v0.0.26

## \[0.0.25] - 2023-09-16

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.24...v0.0.25

## \[0.0.24] - 2023-09-16

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.23...v0.0.24

## \[0.0.23] - 2023-09-16

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.22...v0.0.23

## \[0.0.22] - 2023-09-16

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.21...v0.0.22

## \[0.0.21] - 2023-09-16

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.20...v0.0.21

## \[0.0.20] - 2023-09-15

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.19...v0.0.20

## \[0.0.19] - 2023-09-12

- Obj.update (@VldMrgnn, #16)

## \[0.0.18] - 2023-09-10

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.17...v0.0.18

## \[0.0.17] - 2023-09-10

- schema concept (@neurosnap, #13)

## \[0.0.16] - 2023-08-28

- Use redux (@neurosnap, #12)

## \[0.0.15] - 2023-08-28

- Toolkit 2.0 (@neurosnap, #11)

## \[0.0.14] - 2023-08-27

- refactor: `call()` to not be safe (@neurosnap, #9)

## \[0.0.13] - 2023-07-30

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.12...v0.0.13

## \[0.0.12] - 2023-07-30

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.11...v0.0.12

## \[0.0.11] - 2023-07-30

- fix: event inside takeEvery can trigger same event (@neurosnap, #5)

## \[0.0.10] - 2023-07-30

- fix: ensure compose mdw returns aggregate `Result` (@neurosnap, #6)

## \[0.0.9] - 2023-07-15

- Full diff: https://github.com/fxforge/starfx/compare/v0.0.8...v0.0.9

## \[0.0.8] - 2023-07-14

- Immutable store proof-of-concept (@neurosnap, #2)

## \[0.0.7] - 2023-07-11

- Full diff: https://github.com/fxforge/starfx/releases/tag/v0.0.7

## \[0.0.6] - 2023-07-11

- Full diff: https://github.com/fxforge/starfx/releases/tag/v0.0.6

## \[0.0.5] - 2023-07-11

- Full diff: https://github.com/fxforge/starfx/releases/tag/v0.0.5

## \[0.0.4] - 2023-05-21

- Full diff: https://github.com/fxforge/starfx/releases/tag/v0.0.4

## \[0.0.3] - 2023-05-20

- Full diff: https://github.com/fxforge/starfx/releases/tag/v0.0.3

## \[0.0.2] - 2023-05-20

- Full diff: https://github.com/fxforge/starfx/releases/tag/v0.0.2

## \[0.0.1] - 2023-05-20

- Full diff: https://github.com/fxforge/starfx/releases/tag/v0.0.1
