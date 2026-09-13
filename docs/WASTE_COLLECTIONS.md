# Waste Collection API Guide

## Overview

The waste collection API handles the core functionality of recording waste deliveries, calculating payments, managing verification, and tracking collection history.

## Features

✅ **Collection Recording** - Record waste deliveries with photos
✅ **Automatic Pricing** - Calculate payments based on material type and weight
✅ **Image Upload** - Support for multiple images per collection
✅ **Verification System** - Admin/verifier approval workflow
✅ **Payment Tracking** - Track payment status (pending, completed, failed)
✅ **Statistics** - Collection analytics and reporting
✅ **Material Categories** - Support for plastics, metals, glass, paper, electronics

## Material Pricing

### Current Rates (KES per kg)

**Plastics:**
- PET (bottles): KES 25/kg
- HDPE (containers): KES 30/kg
- PVC: KES 15/kg
- LDPE (bags): KES 20/kg
- PP (caps): KES 22/kg
- PS (foam): KES 10/kg

**Metals:**
- Aluminum (cans): KES 80/kg
- Steel: KES 15/kg
- Copper: KES 600/kg
- Brass: KES 400/kg

**Glass:**
- Clear glass: KES 5/kg
- Colored glass: KES 3/kg

**Paper:**
- Cardboard: KES 8/kg
- White paper: KES 12/kg
- Mixed paper: KES 6/kg
- Newspaper: KES 4/kg

**Other:**
- E-waste: KES 50/kg
- Textiles: KES 10/kg
- Rubber: KES 20/kg

### Volume Bonuses

- **50-99 kg**: +5% bonus
- **100+ kg**: +10% bonus

## API Endpoints

### Record Waste Collection

```bash
POST /api/v1/collections
Authorization: Bearer <token>
Content-Type: application/json

{
  "collectionPointId": "cp-123",
  "materialType": "PET",
  "materialCategory": "Plastic",
  "weight": 25.5,
  "quantity": 150,
  "imageUrls": [
    "https://storage.example.com/collections/img1.jpg",
    "https://storage.example.com/collections/img2.jpg"
  ],
  "notes": "Clean PET bottles, no caps"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "col-123",
    "collectorId": "user-456",
    "collectionPointId": "cp-123",
    "materialType": "PET",
    "materialCategory": "Plastic",
    "weight": 25.5,
    "quantity": 150,
    "paymentAmount": 637.50,
    "paymentCurrency": "KES",
    "paymentStatus": "PENDING",
    "imageUrls": ["https://..."],
    "collector": {
      "id": "user-456",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+254712345678"
    },
    "collectionPoint": {
      "id": "cp-123",
      "name": "Nairobi Central",
      "address": "Tom Mboya Street",
      "city": "Nairobi"
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Waste collection recorded successfully"
}
```

### Get Collection by ID

```bash
GET /api/v1/collections/col-123
Authorization: Bearer <token>
```

### Get My Collections

```bash
GET /api/v1/collections/me?page=1&limit=20
Authorization: Bearer <token>
```

Response includes summary:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "summary": {
    "totalCollections": 45,
    "totalWeight": 1250.5,
    "totalEarnings": 28650.00
  }
}
```

### List All Collections (Admin)

```bash
GET /api/v1/collections?collectorId=user-123&materialType=PET&status=PENDING&page=1&limit=50
Authorization: Bearer <admin-token>
```

Query Parameters:
- `collectorId` - Filter by collector
- `collectionPointId` - Filter by location
- `materialType` - Filter by material (PET, HDPE, etc.)
- `status` - Filter by payment status
- `startDate` - ISO 8601 date (e.g., 2024-01-01T00:00:00Z)
- `endDate` - ISO 8601 date
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)

### Verify Collection (Admin/Verifier)

```bash
POST /api/v1/collections/col-123/verify
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "approved": true,
  "notes": "Verified. Quality grade A.",
  "adjustedWeight": 25.0,
  "adjustedAmount": 625.00
}
```

**Workflow:**
1. Admin reviews photos and details
2. Approves or rejects collection
3. Can adjust weight if measured incorrectly
4. Can adjust payment amount if needed
5. System processes payment if approved

### Upload Additional Images

```bash
POST /api/v1/collections/col-123/images
Authorization: Bearer <token>
Content-Type: application/json

{
  "imageUrls": [
    "https://storage.example.com/collections/img3.jpg",
    "https://storage.example.com/collections/img4.jpg"
  ]
}
```

### Get Collection Statistics

```bash
GET /api/v1/collections/statistics?userId=user-123&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "success": true,
  "data": {
    "totalCollections": 156,
    "totalWeight": 3580.5,
    "totalPayments": 82450.00,
    "byMaterial": [
      {
        "materialType": "PET",
        "count": 45,
        "totalWeight": 1250.5,
        "totalPayment": 31262.50
      },
      {
        "materialType": "ALUMINUM",
        "count": 30,
        "totalWeight": 450.0,
        "totalPayment": 36000.00
      }
    ],
    "byStatus": {
      "PENDING": 12,
      "COMPLETED": 140,
      "CANCELLED": 4
    }
  }
}
```

### Delete Collection (Admin)

```bash
DELETE /api/v1/collections/col-123
Authorization: Bearer <admin-token>
```

**Note:** Cannot delete collections with status "COMPLETED".

## Image Upload Workflow

### Recommended Approach

1. **Upload to Cloud Storage First**
   
   ```javascript
   // Example: Upload to Cloudinary
   const uploadImage = async (file) => {
     const formData = new FormData();
     formData.append('file', file);
     formData.append('upload_preset', 'wastefi-collections');

     const response = await fetch(
       'https://api.cloudinary.com/v1_1/your-cloud/image/upload',
       { method: 'POST', body: formData }
     );

     const data = await response.json();
     return data.secure_url;
   };
   ```

2. **Submit Collection with Image URLs**

   ```javascript
   const imageUrls = await Promise.all(
     files.map(file => uploadImage(file))
   );

   const collection = await fetch('/api/v1/collections', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       collectionPointId: 'cp-123',
       materialType: 'PET',
       materialCategory: 'Plastic',
       weight: 25.5,
       imageUrls
     })
   });
   ```

### Image Requirements

✅ **Format**: JPEG, PNG
✅ **Max Size**: 5MB per image
✅ **Recommended**: 1-4 images per collection
✅ **Content**: Clear view of materials
✅ **Quality**: Good lighting, in focus

### Image Best Practices

**Required Photos:**
1. Overall view of materials
2. Close-up of material type (to verify)
3. Weight scale reading (if available)

**Optional Photos:**
4. Sorting/processing
5. Collection point reference

## Payment Calculation

### Formula

```
Base Amount = Weight (kg) × Price per kg
Volume Bonus = Base Amount × Bonus %
Total = Base Amount + Volume Bonus
```

### Example Calculations

**Example 1: Small Collection**
```
Material: PET bottles
Weight: 10 kg
Price: KES 25/kg
Bonus: None (< 50 kg)
Total: 10 × 25 = KES 250.00
```

**Example 2: Medium Collection**
```
Material: Aluminum cans
Weight: 60 kg
Price: KES 80/kg
Bonus: 5% (50-99 kg)
Base: 60 × 80 = KES 4,800.00
Bonus: 4,800 × 0.05 = KES 240.00
Total: KES 5,040.00
```

**Example 3: Large Collection**
```
Material: HDPE containers
Weight: 150 kg
Price: KES 30/kg
Bonus: 10% (100+ kg)
Base: 150 × 30 = KES 4,500.00
Bonus: 4,500 × 0.10 = KES 450.00
Total: KES 4,950.00
```

## Mobile App Integration

### Complete Collection Flow

```javascript
// 1. Take photos
const photos = await takePhotos(3);

// 2. Upload photos to cloud
const uploadPromises = photos.map(photo => 
  uploadToCloudStorage(photo)
);
const imageUrls = await Promise.all(uploadPromises);

// 3. Record collection
const collection = await fetch('/api/v1/collections', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    collectionPointId: selectedPoint.id,
    materialType: 'PET',
    materialCategory: 'Plastic',
    weight: 25.5,
    quantity: 150,
    imageUrls,
    notes: 'Clean bottles, no caps'
  })
});

// 4. Show confirmation
const result = await collection.json();
showSuccessMessage(`
  Collection recorded!
  You'll earn: KES ${result.data.paymentAmount}
  Status: Pending verification
`);
```

### Estimate Earnings Before Collection

```javascript
// Show estimated earnings as user enters weight
const estimateEarnings = (materialType, weight) => {
  const material = MATERIAL_PRICES[materialType];
  if (!material) return 0;

  let baseAmount = weight * material.pricePerKg;
  let bonus = 0;

  if (weight >= 100) {
    bonus = baseAmount * 0.10;
  } else if (weight >= 50) {
    bonus = baseAmount * 0.05;
  }

  return {
    base: baseAmount.toFixed(2),
    bonus: bonus.toFixed(2),
    total: (baseAmount + bonus).toFixed(2),
    pricePerKg: material.pricePerKg
  };
};

// Usage
const estimate = estimateEarnings('PET', 75);
console.log(`
  Base: KES ${estimate.base}
  Bonus (5%): KES ${estimate.bonus}
  Total: KES ${estimate.total}
`);
```

## Collection Status Flow

```
PENDING → (Verification) → PROCESSING → COMPLETED
   ↓                           ↓
CANCELLED                   FAILED
```

- **PENDING**: Awaiting verification
- **PROCESSING**: Payment being processed
- **COMPLETED**: Payment successful
- **FAILED**: Payment failed (retry possible)
- **CANCELLED**: Rejected by verifier

## Verification Guidelines

### For Verifiers

**Check:**
✅ Images are clear and show materials
✅ Material type matches what's shown
✅ Weight seems reasonable for quantity
✅ No contamination or wrong materials
✅ Collection point is correct

**Actions:**
- Approve: Payment will be processed
- Reject: Provide clear reason in notes
- Adjust: Fix weight if measurement error

### For Collectors

**To Speed Up Verification:**
✅ Take clear, well-lit photos
✅ Show all materials in frame
✅ Clean and sort materials properly
✅ Provide accurate weight
✅ Add helpful notes

## Statistics & Analytics

### Collector Dashboard Data

```javascript
// Get personal statistics
const stats = await fetch(
  '/api/v1/collections/me?page=1&limit=100',
  { headers: { Authorization: `Bearer ${token}` } }
);

const { data, summary } = await stats.json();

// Display
console.log(`
  Total Collections: ${summary.totalCollections}
  Total Weight: ${summary.totalWeight} kg
  Total Earnings: KES ${summary.totalEarnings}
  Average per collection: KES ${
    (summary.totalEarnings / summary.totalCollections).toFixed(2)
  }
`);
```

### Admin Dashboard Data

```javascript
// Get system-wide statistics
const stats = await fetch(
  '/api/v1/collections/statistics?' +
  'startDate=2024-01-01&endDate=2024-01-31',
  { headers: { Authorization: `Bearer ${adminToken}` } }
);

const { data } = await stats.json();

// Display
console.log(`
  Month: January 2024
  Collections: ${data.totalCollections}
  Weight: ${data.totalWeight} kg
  Payments: KES ${data.totalPayments}
  
  Top Materials:
  ${data.byMaterial.map(m => 
    `  - ${m.materialType}: ${m.count} collections, ${m.totalWeight} kg`
  ).join('\n')}
`);
```

## Testing Examples

### cURL Examples

```bash
# Record collection
curl -X POST http://localhost:3000/api/v1/collections \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "collectionPointId": "cp-123",
    "materialType": "PET",
    "materialCategory": "Plastic",
    "weight": 25.5,
    "imageUrls": ["https://example.com/img1.jpg"]
  }'

# Get my collections
curl http://localhost:3000/api/v1/collections/me \
  -H "Authorization: Bearer <token>"

# Verify collection (admin)
curl -X POST http://localhost:3000/api/v1/collections/col-123/verify \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "notes": "Verified successfully"
  }'
```

## Best Practices

### For Collectors

✅ **Sort materials** before delivery
✅ **Clean materials** (remove caps, labels)
✅ **Weigh accurately** if possible
✅ **Take clear photos** from multiple angles
✅ **Visit during operating hours**
✅ **Deliver to nearest collection point**

### For Admins

✅ **Verify within 24 hours**
✅ **Provide clear feedback** in notes
✅ **Be consistent** with verification standards
✅ **Adjust pricing** based on market rates
✅ **Monitor fraud** and patterns
✅ **Respond to disputes** promptly

### For Developers

✅ **Compress images** before upload
✅ **Implement retry logic** for failed uploads
✅ **Cache pricing data** locally
✅ **Show estimated earnings** before submission
✅ **Handle offline mode** gracefully
✅ **Validate inputs** before API calls

## Troubleshooting

### Collection Rejected

**Common Reasons:**
- Wrong material type selected
- Weight measurement inaccurate
- Materials contaminated
- Poor quality photos
- Collection point error

**Solution:**
- Review verifier notes
- Resubmit with corrections
- Contact support if unclear

### Payment Pending

**Typical Timeline:**
- Verification: 1-24 hours
- Payment processing: 1-2 hours
- Total: Usually within 24 hours

**If Delayed:**
- Check collection status
- Ensure KYC is approved
- Verify wallet is set up
- Contact support after 48 hours

### Images Not Uploading

**Check:**
- File size < 5MB
- Stable internet connection
- Valid image format (JPEG/PNG)
- Cloud storage API key

## Future Enhancements

- [ ] AI-powered material recognition from photos
- [ ] Automatic weight estimation from images
- [ ] Real-time price updates
- [ ] Collection scheduling
- [ ] Bulk collection support
- [ ] QR code scanning for quick submission
- [ ] Offline collection recording
- [ ] Gamification and rewards
- [ ] Collection challenges and competitions
- [ ] Material quality grading (A, B, C, D)

## Support

For waste collection issues:
- Check API documentation
- Review pricing table
- Test with small collections first
- Contact support for pricing disputes
