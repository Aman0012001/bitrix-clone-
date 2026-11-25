# Phase 2.8 read-only bootstrap inspection

**Date:** 2026-11-25  
**Status:** Paused before SQL execution

## Target

| Item | Expected value |
|---|---|
| Neon project | `businesshub-pg18-security-test` |
| Project ID | `green-field-13333855` |
| Branch | `businesshub-test` |
| Branch ID | `br-little-sea-biexy46u` |
| Database | `businesshub_test` |
| Expected role | `businesshub_test_owner` |
| PostgreSQL major version | 18 |

## Read-only metadata preflight

The fresh Neon metadata preflight confirmed the project ID and name, PostgreSQL 18, the branch ID and name, the database name and owner, and an endpoint associated with the expected project and branch.

The endpoint could not be compared with a selected SQL Editor connection because no targetable browser window was available. The SQL Editor's selected role was also not verified.

## SQL inspection status

The SQL inspection did not start. No SQL statements were executed.

- Statements 1, 2, 3, 5, and 6 remain approved only within their existing gates.
- Statement 1 must return exactly one row with `target_matches = true` before any later statement runs.
- Statement 4, the full SET-enabled path enumeration, remains excluded.
- Role attributes, reachable memberships, membership-edge options, and application-role presence remain unknown; they must not be inferred from absent query results.

## Stop reason and next step

Computer Use returned no browser windows. Chrome had previously been launched once, but no targetable window became available. No further browser launch was attempted.

The user must open Chrome and the Neon Console SQL Editor manually. Before any SQL is run, the visible Editor must confirm the approved project, branch, database, and `businesshub_test_owner` role. The role must not be inferred from database ownership. If the Editor cannot confirm the selected role, stop.

Before a future connection attempt, refresh the read-only metadata and compare the selected endpoint locally with the endpoint mapped to the approved branch. Do not copy or disclose connection strings, credentials, or endpoint details.

Once all UI and metadata gates pass, run the exact previously reviewed SELECT statements in this order: 1, 2, 3, 5, 6. Stop immediately if statement 1 does not meet its required result or if any query errors, times out, is truncated, or has uncertain catalog visibility.

## Authorization boundary

The approval covers only the specified metadata preflight and SELECT statements 1, 2, 3, 5, and 6, subject to all gates. It does not authorize statement 4, writes, DDL, role or grant changes, schema changes, provisioning, migrations, or application changes.

No database connection, SQL execution, write, migration, or application-file change occurred during this inspection.
