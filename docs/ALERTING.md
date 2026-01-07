# Alerting Configuration Guide

This document describes the alerting system for the Food Truck Management System.

---

## Overview

The system uses Prometheus for metrics collection and Alertmanager for alert routing. Alerts are configured in `alerts/rules.yml` and can be routed to various notification channels.

---

## Alert Rules

### API Alerts

#### Slow API Requests
- **Alert:** `SlowAPIRequests`
- **Condition:** P95 response time > 1 second for 5 minutes
- **Severity:** Warning
- **Action:** Review slow endpoints, optimize queries

#### High Error Rate
- **Alert:** `HighErrorRate`
- **Condition:** Error rate > 5% for 2 minutes
- **Severity:** Critical
- **Action:** Investigate errors, check logs

#### Very High Error Rate
- **Alert:** `VeryHighErrorRate`
- **Condition:** Error rate > 10% for 1 minute
- **Severity:** Critical
- **Action:** Immediate investigation required

---

### Database Alerts

#### Slow Database Queries
- **Alert:** `SlowDatabaseQueries`
- **Condition:** >10% of queries are slow (>100ms) for 5 minutes
- **Severity:** Warning
- **Action:** Review slow queries, add indexes

#### Database Connection Issues
- **Alert:** `DatabaseConnectionIssues`
- **Condition:** Unable to connect to database for 1 minute
- **Severity:** Critical
- **Action:** Check database status, connection pool

---

### Cache Alerts

#### Low Cache Hit Rate
- **Alert:** `LowCacheHitRate`
- **Condition:** Cache hit rate < 50% for 10 minutes
- **Severity:** Warning
- **Action:** Review cache strategy, TTLs

#### Very Low Cache Hit Rate
- **Alert:** `VeryLowCacheHitRate`
- **Condition:** Cache hit rate < 30% for 5 minutes
- **Severity:** Critical
- **Action:** Immediate cache review required

---

### System Alerts

#### Health Check Failure
- **Alert:** `HealthCheckFailure`
- **Condition:** Health check failing for 2 minutes
- **Severity:** Critical
- **Action:** Check service status, dependencies

#### High Memory Usage
- **Alert:** `HighMemoryUsage`
- **Condition:** Memory usage > 80% for 5 minutes
- **Severity:** Warning
- **Action:** Review memory usage, potential leaks

#### Service Down
- **Alert:** `ServiceDown`
- **Condition:** Service unavailable for 5 minutes
- **Severity:** Critical
- **Action:** Immediate service restart/investigation

---

## Setup Instructions

### 1. Prometheus Configuration

Add to `prometheus.yml`:

```yaml
rule_files:
  - "alerts/rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### 2. Alertmanager Configuration

Create `alertmanager.yml`:

```yaml
route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://webhook:8080/alerts'
  
  - name: 'critical-alerts'
    webhook_configs:
      - url: 'http://webhook:8080/critical'
    # Add Slack, PagerDuty, email, etc.
```

### 3. Notification Channels

#### Slack Integration

```yaml
receivers:
  - name: 'slack-alerts'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: 'Food Truck Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

#### Email Integration

```yaml
receivers:
  - name: 'email-alerts'
    email_configs:
      - to: 'alerts@example.com'
        from: 'prometheus@example.com'
        smarthost: 'smtp.example.com:587'
        auth_username: 'prometheus'
        auth_password: 'password'
```

#### PagerDuty Integration

```yaml
receivers:
  - name: 'pagerduty-alerts'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
```

---

## Testing Alerts

### Test Alert Rule

```bash
# Check if rules are valid
promtool check rules alerts/rules.yml

# Test alert firing
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning"
    },
    "annotations": {
      "summary": "Test alert",
      "description": "This is a test alert"
    }
  }]'
```

---

## Alert Response Procedures

### Critical Alerts
1. **Immediate:** Acknowledge alert within 5 minutes
2. **Investigation:** Check logs, metrics, system status
3. **Resolution:** Fix issue or escalate
4. **Documentation:** Update incident log

### Warning Alerts
1. **Review:** Check within 30 minutes
2. **Investigation:** Analyze root cause
3. **Action:** Implement fix or optimization
4. **Monitoring:** Verify alert clears

---

## Alert Tuning

### Adjust Thresholds

Edit `alerts/rules.yml` to adjust:
- Time windows (`for: 5m`)
- Threshold values (`> 0.05`)
- Severity levels

### Add New Alerts

1. Add rule to `alerts/rules.yml`
2. Reload Prometheus configuration
3. Test alert firing
4. Configure notification routing

---

## Best Practices

1. **Avoid Alert Fatigue:** Set appropriate thresholds
2. **Group Related Alerts:** Use alert grouping
3. **Clear Annotations:** Provide actionable descriptions
4. **Regular Review:** Review and tune alerts monthly
5. **Documentation:** Keep runbooks updated

---

**Last Updated:** January 2026
