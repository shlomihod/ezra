# Ezra

## Testing
- Run `npm test` before considering any change complete
- Run `npm run build` to verify TypeScript compilation
- Server tests: `npm test --workspace=server`
- Client tests: `npm test --workspace=client`
- E2E tests: `npm run test:e2e` (requires dev servers running)

## After every code change
1. Write or update tests covering the change
2. Run `npm test` and fix any failures
3. Run `npm run build` and fix any type errors
