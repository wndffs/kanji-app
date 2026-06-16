# packages/db/AGENTS.md

This package owns Prisma schema, migrations, seed data, and database helpers.

## Requirements

- Keep source/import tables separate from curated learning tables.
- Use UUIDs for app-owned entities and stable source IDs for imported rows.
- Add indexes for Japanese character, expression, reading, source keys, locale, due dates, user/card state, and search fields.
- Do not drop or rename columns without migration notes.
- Seed only small legally safe sample data unless a task explicitly imports local open-data files.
