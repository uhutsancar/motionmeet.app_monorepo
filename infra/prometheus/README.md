# Prometheus examples

`prometheus.example.yml` scrapes the private ops port of the API, worker and
scheduler; `alerts.example.yml` holds starting-point alert rules, each
pointing at its runbook. Nothing in this repository runs Prometheus or
applies these (Ek B-6 of the 2026-11 audit); the existing Grafana dashboard
is in `infra/grafana/`.
