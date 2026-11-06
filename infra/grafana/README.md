# Grafana dashboards

Dashboards as code, imported into an existing Grafana (tested shape: Grafana 13).

| File | Datasource | Shows |
|---|---|---|
| `motionmeet-overview.json` | PostgreSQL pointed at the MotionMeet database | members, posts, stories, messages, workouts, engagement, media uploads, outbox / queue health, scheduler health, database size, cache hit ratio, connections per process role, largest tables |

## Import

1. Grafana → **Dashboards → New → Import** → upload the JSON.
2. When asked for **MotionMeet**, pick the PostgreSQL datasource that points at
   the MotionMeet database (`motionmeetdb` locally).
3. Import. The dashboard uid is `motionmeet-overview`; importing again
   overwrites it.

Use a read-only database role for the datasource in production:

```sql
CREATE ROLE grafana_reader LOGIN PASSWORD '<password>';
GRANT CONNECT ON DATABASE motionmeet TO grafana_reader;
GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_reader;
GRANT pg_read_all_stats TO grafana_reader; -- connection and query panels
```

Every query was run against the migrated schema before this file was
committed. Panels show counts and usernames only — never post text, message
bodies, emails or locations.

Process metrics (route latency, event-loop lag, consumer timings) are exposed
in Prometheus format on each process's private `METRICS_PORT`; a Prometheus
datasource for them is not part of this setup yet.
