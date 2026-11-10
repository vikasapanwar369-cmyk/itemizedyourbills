# AGENTS.md

## Contact details
- All published contact details come from `src/lib/support-config.ts` and
  nowhere else. Why: a single source keeps the privacy notice, help screen and
  support console from disagreeing, and a blank field there is hidden on screen
  rather than shown as a fake address.

## DPDP grievance clock
- Store `acknowledged_at` and derive due dates in TypeScript, never in a
  generated column. Why: Postgres rejects generated columns whose expression is
  not immutable, so `acknowledged_at + interval` cannot be a stored column.

## Launch metrics
- Staff and test accounts are excluded from every launch-test count. Why: the
  experiment is only meaningful if it cannot be satisfied by the owner's own
  logins.

## Tests
- Run tests with `bunx vitest run`. Keep timing, scoring and other pure logic in
  `src/lib/*.ts` with a colocated `*.test.ts`. Why: the rules that decide
  compliance deadlines and the launch bar must be checkable without a browser.

## Router error screens
- Register error screens through `React.lazy` and type their `error` prop as
  `unknown`. Why: `ErrorRouteComponent` requires a `LazyExoticComponent`, and
  `ErrorComponentProps.error` is `unknown`, so a plain component typed
  `error: Error` fails the typecheck.
