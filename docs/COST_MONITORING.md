# Cost Monitoring Documentation
**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** Production Ready

---

## Overview

This document describes the cost monitoring system for the Food Truck Management System. The system tracks infrastructure, service, and operational costs to enable cost optimization and budget management.

---

## Features

### Cost Tracking
- Record costs by category and service
- Track daily, monthly, and yearly costs
- Support for multiple currencies
- Metadata for additional cost details

### Cost Analysis
- Statistics by category and service
- Cost trends analysis
- Monthly cost estimation
- Historical cost data

### Cost Categories
- Infrastructure (servers, hosting)
- Database (database instances, backups)
- Storage (object storage, file storage)
- Network (bandwidth, CDN)
- Compute (processing, functions)
- Monitoring (logging, metrics)
- Security (security services)
- Third Party (external services)

---

## API Endpoints

### Record Cost
**POST** `/api/costs` (Admin only)

Record a new cost entry.

**Request Body:**
```json
{
  "category": "infrastructure",
  "service": "AWS EC2",
  "amount": 150.00,
  "currency": "USD",
  "date": "2026-01-06",
  "metadata": {
    "instanceType": "t3.medium",
    "region": "us-east-1"
  }
}
```

### Get Costs
**GET** `/api/costs` (Admin only)

Query costs with filters.

**Query Parameters:**
- `category` - Filter by category
- `service` - Filter by service
- `startDate` - Start date
- `endDate` - End date
- `limit` - Result limit (default: 100)
- `offset` - Result offset

### Get Statistics
**GET** `/api/costs/statistics` (Admin only)

Get cost statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCost": 5000.00,
    "costsByCategory": {
      "infrastructure": 3000.00,
      "database": 1000.00,
      "storage": 500.00,
      "network": 500.00
    },
    "costsByService": {
      "AWS EC2": 2000.00,
      "AWS RDS": 1000.00,
      "Stripe": 500.00
    },
    "dailyCosts": [...],
    "monthlyCosts": [...]
  }
}
```

### Get Trends
**GET** `/api/costs/trends` (Admin only)

Get cost trends analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "average": 150.00,
    "trend": "increasing",
    "dailyCosts": [...]
  }
}
```

### Estimate Monthly Cost
**GET** `/api/costs/estimate-monthly` (Admin only)

Estimate monthly cost based on recent data.

**Response:**
```json
{
  "success": true,
  "data": {
    "estimatedMonthlyCost": 4500.00,
    "currency": "USD"
  }
}
```

---

## Integration with Cloud Providers

### AWS Cost Integration

**File:** `scripts/sync-aws-costs.js` (to be created)

```javascript
/**
 * Sync AWS costs from Cost Explorer API
 */

const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const { recordCost, CostCategory } = require('../utils/costMonitoring');

async function syncAWSCosts() {
  const client = new CostExplorerClient({ region: 'us-east-1' });
  
  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: '2026-01-01',
      End: '2026-01-31',
    },
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost'],
    GroupBy: [
      { Type: 'DIMENSION', Key: 'SERVICE' },
    ],
  });

  const response = await client.send(command);
  
  for (const result of response.ResultsByTime || []) {
    for (const group of result.Groups || []) {
      const service = group.Keys[0];
      const amount = parseFloat(group.Metrics.UnblendedCost.Amount);
      
      await recordCost({
        category: CostCategory.INFRASTRUCTURE,
        service: `AWS ${service}`,
        amount: amount,
        date: result.TimePeriod.Start,
        metadata: {
          source: 'aws_cost_explorer',
        },
      });
    }
  }
}

syncAWSCosts().catch(console.error);
```

### Stripe Cost Integration

**File:** `scripts/sync-stripe-costs.js` (to be created)

```javascript
/**
 * Sync Stripe transaction costs
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { recordCost, CostCategory } = require('../utils/costMonitoring');

async function syncStripeCosts() {
  const charges = await stripe.charges.list({
    limit: 100,
    created: {
      gte: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60, // Last 30 days
    },
  });

  for (const charge of charges.data) {
    // Stripe fees are typically 2.9% + $0.30 per transaction
    const fee = charge.amount * 0.029 + 30; // Convert to cents
    
    await recordCost({
      category: CostCategory.THIRD_PARTY,
      service: 'Stripe',
      amount: fee / 100, // Convert to dollars
      date: new Date(charge.created * 1000),
      metadata: {
        chargeId: charge.id,
        amount: charge.amount / 100,
      },
    });
  }
}

syncStripeCosts().catch(console.error);
```

---

## Dashboard

### Cost Monitoring Dashboard

**File:** `packages/admin-app/src/pages/CostDashboard.tsx` (to be created)

```typescript
/**
 * Cost Monitoring Dashboard
 */

import { useEffect, useState } from 'react';
import { Card, Statistic, Table, Line } from 'antd';
import { DollarOutlined, TrendingUpOutlined } from '@ant-design/icons';

export function CostDashboard() {
  const [statistics, setStatistics] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCostData();
    const interval = setInterval(fetchCostData, 3600000); // Update every hour
    return () => clearInterval(interval);
  }, []);

  const fetchCostData = async () => {
    try {
      const [statsRes, trendsRes] = await Promise.all([
        fetch('/api/costs/statistics', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }),
        fetch('/api/costs/trends', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }),
      ]);

      const stats = await statsRes.json();
      const trendsData = await trendsRes.json();

      setStatistics(stats.data);
      setTrends(trendsData.data);
    } catch (error) {
      console.error('Error fetching cost data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !statistics) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1>Cost Monitoring Dashboard</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <Card>
          <Statistic
            title="Total Cost"
            value={statistics.totalCost}
            prefix={<DollarOutlined />}
            precision={2}
          />
        </Card>
        
        <Card>
          <Statistic
            title="Trend"
            value={trends.trend}
            prefix={<TrendingUpOutlined />}
          />
        </Card>
        
        <Card>
          <Statistic
            title="Average Daily"
            value={trends.average}
            prefix={<DollarOutlined />}
            precision={2}
          />
        </Card>
      </div>

      <Card title="Costs by Category">
        <Table
          dataSource={Object.entries(statistics.costsByCategory).map(([category, amount]) => ({
            key: category,
            category,
            amount,
          }))}
          columns={[
            { title: 'Category', dataIndex: 'category', key: 'category' },
            { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (val) => `$${val.toFixed(2)}` },
          ]}
        />
      </Card>
    </div>
  );
}
```

---

## Automation

### Scheduled Cost Sync

**File:** `.github/workflows/sync-costs.yml` (to be created)

```yaml
name: Sync Costs

on:
  schedule:
    - cron: '0 0 * * *' # Daily at midnight UTC
  workflow_dispatch:

jobs:
  sync-costs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Sync AWS costs
        run: node scripts/sync-aws-costs.js
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      
      - name: Sync Stripe costs
        run: node scripts/sync-stripe-costs.js
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Best Practices

1. **Regular Updates:** Sync costs daily
2. **Categorization:** Use consistent categories
3. **Metadata:** Include relevant details
4. **Review:** Review costs weekly
5. **Optimization:** Identify cost reduction opportunities

---

## Alerts

### Cost Threshold Alerts

- **Daily Cost:** > $200
- **Monthly Cost:** > $5,000
- **Trend:** Increasing > 20%
- **Service Cost:** > $1,000/month

---

## References

- [AWS Cost Explorer](https://aws.amazon.com/aws-cost-management/aws-cost-explorer/)
- [Google Cloud Billing](https://cloud.google.com/billing/docs)
- [Azure Cost Management](https://azure.microsoft.com/services/cost-management/)

---

**Document Owner:** Finance/DevOps Team  
**Review Frequency:** Weekly  
**Next Review:** January 2026
