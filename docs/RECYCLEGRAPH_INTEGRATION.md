# RecycleGraph Integration Guide

Complete guide for integrating and using RecycleGraph API for material passports, carbon tracking, and recycling verification in WasteFi.

## Table of Contents

- [Overview](#overview)
- [What is RecycleGraph?](#what-is-recyclegraph)
- [Setup Instructions](#setup-instructions)
- [Material Passports](#material-passports)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [Carbon Credits](#carbon-credits)
- [Best Practices](#best-practices)

---

## Overview

RecycleGraph is a blockchain-based platform for tracking materials through the recycling lifecycle. It provides:

- **Digital Material Passports** - Unique identifiers for recyclable materials
- **Chain of Custody Tracking** - Complete history of material movement
- **Carbon Credit Calculation** - Automated carbon footprint and credit calculations
- **Verification System** - Authenticity verification through digital signatures
- **Quality Grading** - Material quality assessment (A, B, C, D)

### Integration Benefits

- Transparency in waste collection and recycling
- Automated carbon credit calculations
- Verifiable proof of recycling
- Enhanced trust for collectors and businesses
- Compliance with environmental regulations

---

## What is RecycleGraph?

RecycleGraph creates a digital twin for every piece of recyclable material, tracking it from collection to final recycling. Each material gets a unique **Material Passport** containing:

1. **Material Information**
   - Type (PET, HDPE, Glass, etc.)
   - Category (Plastic, Metal, Paper, etc.)
   - Weight and dimensions
   - Composition and quality

2. **Lifecycle Data**
   - Manufacturing date
   - Expiry date
   - Recycling instructions
   - Current location

3. **Sustainability Metrics**
   - Carbon footprint
   - Carbon credits earned
   - Environmental impact

4. **Chain of Custody**
   - Complete movement history
   - All custodians and locations
   - Timestamps for every transfer

---

## Setup Instructions

### 1. Get RecycleGraph API Credentials

1. Visit [RecycleGraph Developer Portal](https://developer.recyclegraph.io/)
2. Create an account
3. Generate API Key from dashboard
4. Note your API URL (production or sandbox)

### 2. Configure Environment Variables

Add to your `.env` file:

```env
RECYCLEGRAPH_API_URL=https://api.recyclegraph.io
RECYCLEGRAPH_API_KEY=your-api-key-here
```

**Sandbox vs Production:**

- **Sandbox**: `https://sandbox-api.recyclegraph.io`
- **Production**: `https://api.recyclegraph.io`

### 3. Verify Connection

The service auto-initializes when the server starts. Check logs for:

```
RecycleGraph service initialized { apiUrl: 'https://api.recyclegraph.io' }
```

If credentials are missing:

```
RecycleGraph service not configured - API credentials missing
```

---

## Material Passports

### What is a Material Passport?

A Material Passport is a digital record that follows a material through its lifecycle. It contains all information about the material, its journey, and its environmental impact.

### Creating a Material Passport

Material passports are created when waste is collected and verified.

**Workflow:**

1. Collector brings waste to collection point
2. Collection point verifies and weighs material
3. System creates waste collection record
4. Admin/Collection Point creates material passport
5. Passport syncs with RecycleGraph
6. Digital signature generated for authenticity

**What Gets Stored:**

- **Local Database**: Full passport data for offline access
- **RecycleGraph**: Blockchain-verified record with signature
- **Linked**: Both records connected via `recycleGraphId`

### Passport Lifecycle

```
CREATED → VERIFIED → IN_TRANSIT → PROCESSED → RECYCLED
```

At each stage, custody updates are recorded in both systems.

---

## API Endpoints

### 1. Create Material Passport

**Endpoint:** `POST /api/v1/passports`

**Authentication:** Required (Admin, Collection Point)

**Request Body:**

```json
{
  "wasteCollectionId": "collection-uuid",
  "productName": "PET Water Bottle",
  "manufacturer": "Coca-Cola",
  "dimensions": {
    "length": 20,
    "width": 10,
    "height": 30,
    "unit": "cm"
  },
  "color": "Clear",
  "composition": {
    "PET": 95,
    "HDPE": 5
  },
  "manufacturingDate": "2025-01-15",
  "expiryDate": "2027-01-15",
  "recyclingInstructions": "Rinse before recycling"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "passport-uuid",
    "materialType": "PET",
    "materialCategory": "Plastic",
    "weight": 0.5,
    "recycleGraphId": "rg_abc123xyz",
    "digitalSignature": "a1b2c3d4e5f6...",
    "carbonFootprint": 1.0,
    "carbonCreditsEarned": 0.1,
    "chainOfCustody": [
      {
        "timestamp": "2026-09-13T10:00:00Z",
        "location": "Nairobi Green Center",
        "custodian": "John Doe",
        "action": "COLLECTED"
      }
    ],
    "createdAt": "2026-09-13T10:00:00Z"
  },
  "message": "Material passport created successfully"
}
```

---

### 2. Get Material Passport

**Endpoint:** `GET /api/v1/passports/:id`

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "passport-uuid",
    "materialType": "PET",
    "materialCategory": "Plastic",
    "weight": 0.5,
    "recycleGraphId": "rg_abc123xyz",
    "carbonFootprint": 1.0,
    "carbonCreditsEarned": 0.1,
    "chainOfCustody": [...],
    "verifiedAt": "2026-09-13T10:30:00Z",
    "verificationMethod": "AUTOMATED"
  },
  "recycleGraphData": {
    "id": "rg_abc123xyz",
    "verificationStatus": "VERIFIED",
    "qualityGrade": "A",
    "recyclingPotential": 95
  }
}
```

---

### 3. Update Custody

**Endpoint:** `POST /api/v1/passports/:id/custody`

**Authentication:** Required (Admin, Collection Point)

**Request Body:**

```json
{
  "location": "Nairobi Recycling Plant",
  "custodian": "Jane Smith",
  "action": "TRANSFERRED"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "passport-uuid",
    "currentLocation": "Nairobi Recycling Plant",
    "chainOfCustody": [
      {
        "timestamp": "2026-09-13T10:00:00Z",
        "location": "Nairobi Green Center",
        "custodian": "John Doe",
        "action": "COLLECTED"
      },
      {
        "timestamp": "2026-09-13T14:00:00Z",
        "location": "Nairobi Recycling Plant",
        "custodian": "Jane Smith",
        "action": "TRANSFERRED"
      }
    ]
  },
  "message": "Custody updated successfully"
}
```

---

### 4. Verify Passport

**Endpoint:** `POST /api/v1/passports/:id/verify`

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "verificationMethod": "BLOCKCHAIN"
}
```

**Response:**

```json
{
  "success": true,
  "verified": true,
  "data": {
    "id": "passport-uuid",
    "verifiedAt": "2026-09-13T15:00:00Z",
    "verificationMethod": "BLOCKCHAIN"
  },
  "message": "Material passport verified successfully"
}
```

---

### 5. Calculate Carbon Credits

**Endpoint:** `POST /api/v1/passports/:id/carbon-credits`

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "passportId": "passport-uuid",
    "carbonFootprint": 1.0,
    "carbonCreditsEarned": 0.1
  },
  "message": "Carbon credits calculated successfully"
}
```

---

### 6. Get User's Passports

**Endpoint:** `GET /api/v1/passports/me`

**Authentication:** Required

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "passport-uuid-1",
      "materialType": "PET",
      "weight": 0.5,
      "carbonCreditsEarned": 0.1,
      "collection": {
        "id": "collection-uuid",
        "createdAt": "2026-09-13T10:00:00Z",
        "collectionPoint": {
          "name": "Nairobi Green Center",
          "city": "Nairobi"
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

## Usage Examples

### Creating a Passport After Collection Verification

```typescript
// After verifying a waste collection
const collectionId = 'verified-collection-uuid';

// Create material passport
const response = await fetch('/api/v1/passports', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    wasteCollectionId: collectionId,
    productName: 'PET Water Bottle',
    color: 'Clear',
    composition: {
      PET: 95,
      HDPE: 5,
    },
  }),
});

const passport = await response.json();
console.log('Passport created:', passport.data.id);
console.log('Carbon credits earned:', passport.data.carbonCreditsEarned);
```

### Tracking Material Movement

```typescript
// When material is transferred to recycling plant
await fetch(`/api/v1/passports/${passportId}/custody`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    location: 'Nairobi Recycling Plant',
    custodian: 'Recycling Plant Manager',
    action: 'RECEIVED_FOR_PROCESSING',
  }),
});
```

### Viewing User's Recycling Impact

```typescript
// Get all user's passports with carbon credits
const response = await fetch('/api/v1/passports/me', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const data = await response.json();

// Calculate total impact
const totalCredits = data.data.reduce((sum, passport) => {
  return sum + (passport.carbonCreditsEarned || 0);
}, 0);

console.log(`You've earned ${totalCredits} carbon credits!`);
```

---

## Carbon Credits

### How Carbon Credits Are Calculated

Carbon credits are calculated based on:

1. **Material Type** - Different materials save different amounts of CO2
2. **Weight** - More weight = more credits
3. **Quality Grade** - Higher quality = more credits

**Calculation Formula:**

```
Carbon Savings = Weight × Material Factor × Quality Multiplier
Carbon Credits = Carbon Savings × 0.1
```

**Material Factors (kg CO2 saved per kg recycled):**

- Plastic: 2.0
- Paper: 1.5
- Metal: 3.5
- Glass: 1.0
- Organic: 0.5

**Quality Multipliers:**

- Grade A: 1.2
- Grade B: 1.0
- Grade C: 0.8
- Grade D: 0.6

### Example Calculation

```
Material: PET Plastic
Weight: 10 kg
Quality: Grade A

Carbon Savings = 10 kg × 2.0 × 1.2 = 24 kg CO2
Carbon Credits = 24 × 0.1 = 2.4 credits
```

### Redeeming Carbon Credits

Carbon credits can be:

- **Traded** on carbon markets
- **Sold** to businesses needing to offset emissions
- **Donated** to environmental projects
- **Accumulated** for rewards and incentives

---

## Best Practices

### 1. Create Passports for All Collections

Always create material passports for verified collections to:

- Build trust with collectors
- Track environmental impact
- Enable carbon credit trading
- Meet regulatory requirements

### 2. Update Custody Regularly

Update custody whenever material changes hands:

- Collection → Transport
- Transport → Storage
- Storage → Processing
- Processing → Recycling

### 3. Verify Passports

Verify passports through RecycleGraph for:

- Higher quality grades
- Better pricing
- Fraud prevention
- Compliance proof

### 4. Calculate Carbon Credits Early

Calculate carbon credits as soon as possible to:

- Motivate collectors
- Track environmental impact
- Enable immediate rewards
- Build sustainability reports

### 5. Handle Offline Scenarios

RecycleGraph integration is optional. The system works even when RecycleGraph is unavailable:

- Passports still created locally
- Manual carbon calculations used
- Sync when connection restored

---

## Troubleshooting

### Passport Creation Fails

**Issue:** "RecycleGraph service not configured"

**Solution:**

1. Check environment variables are set
2. Verify API key is valid
3. Test connection to RecycleGraph API
4. Check service logs

### Verification Fails

**Issue:** Passport verification returns error

**Solution:**

1. Ensure passport has valid digital signature
2. Check RecycleGraph service status
3. Verify material data is complete
4. Try manual verification method

### Carbon Credits Not Calculated

**Issue:** Carbon credits showing as 0

**Solution:**

1. Trigger manual calculation: `POST /api/v1/passports/:id/carbon-credits`
2. Check material type is recognized
3. Verify weight is greater than 0
4. Review RecycleGraph service logs

---

## Security Considerations

### 1. API Key Protection

- Never commit API keys to version control
- Use environment variables
- Rotate keys periodically
- Use different keys for sandbox/production

### 2. Digital Signatures

- Signatures are automatically generated
- Cannot be tampered with
- Verified through RecycleGraph blockchain
- Proof of authenticity

### 3. Data Privacy

- Passport data is public by design
- Personal collector info not included in passports
- Chain of custody shows locations, not personal details
- Comply with data protection regulations

### 4. Access Control

- Creating passports: Admin, Collection Point only
- Viewing passports: Any authenticated user
- Updating custody: Admin, Collection Point only
- Verification: Admin only

---

## Production Checklist

Before going live:

- [ ] Obtain production RecycleGraph API key
- [ ] Update `RECYCLEGRAPH_API_URL` to production
- [ ] Test end-to-end passport creation
- [ ] Verify carbon credit calculations
- [ ] Test custody updates
- [ ] Implement monitoring for RecycleGraph service
- [ ] Set up alerts for API failures
- [ ] Train staff on passport workflow
- [ ] Document internal procedures

---

## Support Resources

### RecycleGraph

- [Developer Portal](https://developer.recyclegraph.io/)
- [API Documentation](https://docs.recyclegraph.io/)
- Support: support@recyclegraph.io

### WasteFi

- Check system logs for integration issues
- Review service initialization on server start
- Test with sandbox environment first

---

**Last Updated:** 2026-09-13  
**Version:** 1.0.0
