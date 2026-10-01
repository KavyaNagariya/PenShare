# Contributing to PenShare

Thank you for contributing to PenShare!

## Development Setup

1. Install Node.js 22 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Run PenShare:
   ```bash
   npm start
   # or
   node cli.js --agy
   ```
   and open `http://localhost:3888`.

## Before Submitting Changes

Run:

```bash
npm run check
npm test
```

For canvas and UI-facing changes, verify desktop and mobile layouts and test stylus/mouse drawing, touch navigation, and local snapshots.

## Engineering Guidelines

- Keep server secrets out of `public/`, logs, screenshots, and test fixtures.
- Preserve the sparse tile architecture. Do not allocate large monolithic canvas bitmaps.
- Keep English as the default interface and source-facing language. Add user-visible localized copy through the localization table.
- Do not persist unconfirmed AI drafts in local snapshots.
- Use dependencies only when their licenses explicitly permit open-source and commercial use.
- Keep changes focused and document new data formats or external services.

## Contribution Licensing

PenShare is offered under `AGPL-3.0-only`. By contributing, you agree that your contributions will be licensed under the project's AGPL-3.0 license.

## Pull Requests

Describe the user-visible behavior, implementation approach, validation performed, and any known limitations. Avoid committing configuration files containing credentials, logs, browser test output, local agent state, or generated dependency directories.
