# DogeBridge API Documentation

## Base URL

```
https://api.dogebridge.network/v1
```

## Authentication

All API endpoints require an API key to be passed in the headers:

```
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### Bridge Operations

#### Generate Deposit Address

```typescript
POST /deposit/address
Content-Type: application/json
```

Request Body:

```json
{
  "amount": "100.5",           // Amount in DOGE
  "account": "0x1234...",      // Polygon wallet address
  "email": "user@example.com"  // Optional: for notifications
}
```

Response:

```json
{
  "success": true,
  "data": {
    "depositAddress": "DRtbRTXscM1qWe1zjQSZJxEVryvYgXqkEE",
    "expiresAt": "2024-03-20T15:30:00Z",
    "minimumConfirmations": 6
  }
}
```

#### Check Transaction Status

```typescript
GET /transaction/:txId
```

Response:

```json
{
  "success": true,
  "data": {
    "status": "confirmed",  // pending | confirmed | completed | failed
    "confirmations": 3,
    "requiredConfirmations": 6,
    "amount": "100.5",
    "fee": "1.0",
    "timestamp": "2024-03-20T15:30:00Z"
  }
}
```

#### List Transactions

```typescript
GET /transactions
Query Parameters:
- address: Wallet address
- status: Transaction status
- from: Start timestamp
- to: End timestamp
- limit: Number of records (default: 10, max: 100)
- offset: Pagination offset
```

Response:

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "txId": "0x1234...",
        "type": "deposit",
        "status": "completed",
        "amount": "100.5",
        "fee": "1.0",
        "timestamp": "2024-03-20T15:30:00Z"
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 10,
      "offset": 0
    }
  }
}
```

### Staking Operations

#### Get Staking Info

```typescript
GET /staking/:address
```

Response:

```json
{
  "success": true,
  "data": {
    "stakedAmount": "1000.0",
    "pendingRewards": "5.5",
    "apy": "5.00",
    "lockPeriod": "0",
    "nextRewardAt": "2024-03-21T00:00:00Z"
  }
}
```

### Lending Operations

#### Get Loan Info

```typescript
GET /lending/:address
```

Response:

```json
{
  "success": true,
  "data": {
    "loanAmount": "1000.0",
    "collateralAmount": "1500.0",
    "interestDue": "10.5",
    "collateralRatio": "150",
    "liquidationPrice": "0.66",
    "nextInterestDue": "2024-03-21T00:00:00Z"
  }
}
```

## WebSocket API

### Connection

```typescript
ws://api.dogebridge.network/v1/ws
```

### Subscribe to Updates

```json
{
  "op": "subscribe",
  "channel": "transactions",
  "address": "0x1234..."
}
```

### Event Types

```typescript
// Transaction Update
{
  "type": "transaction",
  "data": {
    "txId": "0x1234...",
    "status": "confirmed",
    "confirmations": 4
  }
}

// Price Update
{
  "type": "price",
  "data": {
    "doge_usd": "0.15",
    "timestamp": "2024-03-20T15:30:00Z"
  }
}
```

## Error Handling

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_AMOUNT",
    "message": "Amount must be greater than minimum deposit",
    "details": {
      "minimum": "100"
    }
  }
}
```

Common Error Codes:

- `INVALID_AMOUNT`: Invalid transaction amount
- `INSUFFICIENT_BALANCE`: Insufficient balance for operation
- `INVALID_ADDRESS`: Invalid wallet address
- `RATE_LIMITED`: Too many requests
- `UNAUTHORIZED`: Invalid or missing API key
- `SERVER_ERROR`: Internal server error

## Rate Limits

- Public endpoints: 100 requests per minute
- Authenticated endpoints: 1000 requests per minute
- WebSocket connections: 10 per IP address

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1621436800
```
