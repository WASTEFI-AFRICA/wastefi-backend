# User Management & KYC Guide

## Overview

WasteFi Backend includes comprehensive user management with KYC (Know Your Customer) verification to ensure platform integrity and compliance.

## User Lifecycle

```
Registration → KYC Submission → Verification → Active → Transacting
     ↓              ↓                ↓            ↓
  PENDING      PENDING (KYC)     APPROVED      ACTIVE
```

## API Endpoints

### User Profile Management

#### Get Current User

```bash
GET /api/v1/users/me
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "phoneNumber": "+254712345678",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "COLLECTOR",
    "status": "ACTIVE",
    "kycStatus": "APPROVED",
    "address": "123 Main Street",
    "city": "Nairobi",
    "country": "Kenya",
    "stellarPublicKey": "GXXX...",
    "createdAt": "2024-01-15T10:30:00Z",
    "lastLoginAt": "2024-01-16T08:00:00Z"
  }
}
```

#### Update Profile

```bash
PUT /api/v1/users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "address": "456 New Street",
  "city": "Mombasa"
}
```

### KYC Verification

#### Submit KYC Documents

```bash
POST /api/v1/users/kyc/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "nationalId": "12345678",
  "idDocumentUrl": "https://storage.example.com/id-doc.jpg",
  "photoUrl": "https://storage.example.com/selfie.jpg",
  "address": "123 Main Street, Nairobi",
  "city": "Nairobi"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "kycStatus": "PENDING",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "KYC documents submitted successfully. Awaiting verification."
}
```

#### Get KYC Status

```bash
GET /api/v1/users/kyc/status
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "kycStatus": "PENDING",
    "nationalId": "12345678",
    "idDocumentUrl": "https://...",
    "photoUrl": "https://...",
    "address": "123 Main Street",
    "city": "Nairobi",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Admin Operations

#### Verify KYC (Admin/Verifier Only)

```bash
POST /api/v1/users/{userId}/kyc/verify
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "approved": true,
  "notes": "Documents verified successfully"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+254712345678",
    "kycStatus": "APPROVED",
    "status": "ACTIVE"
  },
  "message": "KYC approved successfully"
}
```

#### List Users with Filters

```bash
GET /api/v1/users?status=ACTIVE&role=COLLECTOR&kycStatus=APPROVED&page=1&limit=20
Authorization: Bearer <admin-token>
```

Query Parameters:

- `status` - PENDING, ACTIVE, SUSPENDED, BANNED
- `role` - COLLECTOR, ADMIN, COLLECTION_POINT, VERIFIER
- `kycStatus` - NOT_STARTED, PENDING, APPROVED, REJECTED
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "user-123",
      "phoneNumber": "+254712345678",
      "firstName": "John",
      "lastName": "Doe",
      "role": "COLLECTOR",
      "status": "ACTIVE",
      "kycStatus": "APPROVED",
      "city": "Nairobi",
      "createdAt": "2024-01-15T10:30:00Z",
      "lastLoginAt": "2024-01-16T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### Get User by ID

```bash
GET /api/v1/users/{userId}
Authorization: Bearer <admin-token>
```

#### Update User Status

```bash
PUT /api/v1/users/{userId}/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "SUSPENDED",
  "reason": "Violation of terms of service"
}
```

#### Delete User

```bash
DELETE /api/v1/users/{userId}
Authorization: Bearer <admin-token>
```

## User Roles

### COLLECTOR (Default)

- Collect and deliver waste
- Receive payments
- View personal transactions
- Submit KYC documents

### ADMIN

- All collector permissions
- Manage users (view, update, delete)
- Verify KYC documents
- View system statistics
- Manage collection points

### COLLECTION_POINT

- Manage specific collection point
- Verify waste collections
- Process payments to collectors

### VERIFIER

- Review and approve KYC documents
- Verify waste collections
- Cannot manage users or system settings

## User Status Flow

### NOT_STARTED → PENDING

- User registers
- Account created but not verified

### PENDING → ACTIVE

- KYC documents submitted and approved
- User can now transact

### ACTIVE → SUSPENDED

- Admin suspends user (temporary)
- Can be reactivated

### ACTIVE → BANNED

- Admin bans user (permanent)
- Cannot be reactivated

## KYC Status Flow

### NOT_STARTED

- Default status after registration
- User hasn't submitted documents

### PENDING

- Documents submitted
- Awaiting admin/verifier review

### APPROVED

- Documents verified
- User status changes to ACTIVE

### REJECTED

- Documents rejected
- User can resubmit

## Required Documents

### Individual Collectors

1. **National ID / Passport**
   - Clear photo of ID card
   - All text must be readable
   - Not expired

2. **Selfie Photo**
   - Clear face photo
   - Good lighting
   - Match ID photo

3. **Proof of Address**
   - Utility bill, lease agreement
   - Recent (within 3 months)
   - Shows full address

### Organizations

1. **Business Registration**
   - Certificate of incorporation
   - Business permit

2. **Director's ID**
   - National ID of director
   - KRA PIN certificate

3. **Business Address**
   - Business location proof
   - Contact information

## Document Upload

### Recommended Approach

1. **Client-side upload to cloud storage**

   ```javascript
   // Upload to S3, Cloudinary, etc.
   const uploadFile = async (file) => {
     const formData = new FormData();
     formData.append('file', file);

     const response = await fetch('https://api.cloudinary.com/...', {
       method: 'POST',
       body: formData,
     });

     return response.json().url;
   };
   ```

2. **Submit URL to backend**
   ```javascript
   const submitKYC = async (idUrl, photoUrl) => {
     await fetch('/api/v1/users/kyc/submit', {
       method: 'POST',
       headers: {
         Authorization: `Bearer ${token}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         nationalId: '12345678',
         idDocumentUrl: idUrl,
         photoUrl: photoUrl,
         address: '123 Main St',
         city: 'Nairobi',
       }),
     });
   };
   ```

## Verification Process

### For Admins/Verifiers

1. **Review Documents**
   - Check document clarity
   - Verify information matches
   - Check for tampering

2. **Verify Identity**
   - Selfie matches ID photo
   - Name matches registration
   - ID number format valid

3. **Approve or Reject**

   ```bash
   POST /api/v1/users/{userId}/kyc/verify
   {
     "approved": true,
     "notes": "All documents verified"
   }
   ```

4. **User Notification**
   - SMS notification sent (TODO: Implement)
   - Email notification (if email provided)
   - In-app notification

## Security Considerations

### Data Protection

- ✅ Personal data encrypted at rest
- ✅ Sensitive fields not exposed in API
- ✅ Document URLs should be signed/temporary
- ✅ Access logs for admin actions

### Privacy

- ⚠️ Only authorized personnel can view KYC documents
- ⚠️ Documents stored securely (cloud storage with access control)
- ⚠️ Comply with data protection regulations (GDPR, local laws)

### Fraud Prevention

- Check for duplicate national IDs
- Verify document authenticity
- Monitor for suspicious patterns
- Flag multiple rejections

## Integration Examples

### Mobile App Flow

```javascript
// 1. User registers
const register = await POST('/api/v1/auth/register', {
  phoneNumber: '+254712345678',
  firstName: 'John',
  lastName: 'Doe',
});

// 2. User uploads documents to cloud
const idUrl = await uploadToCloud(idPhoto);
const selfieUrl = await uploadToCloud(selfiePhoto);

// 3. Submit KYC
await POST('/api/v1/users/kyc/submit', {
  nationalId: '12345678',
  idDocumentUrl: idUrl,
  photoUrl: selfieUrl,
  address: '123 Main Street',
  city: 'Nairobi',
});

// 4. Poll for status (or use webhooks)
const checkStatus = setInterval(async () => {
  const status = await GET('/api/v1/users/kyc/status');
  if (status.kycStatus === 'APPROVED') {
    // Navigate to dashboard
    clearInterval(checkStatus);
  }
}, 5000);
```

### Admin Dashboard Flow

```javascript
// 1. Get pending KYC submissions
const pending = await GET('/api/v1/users?kycStatus=PENDING');

// 2. Review user documents
const user = await GET(`/api/v1/users/${userId}`);

// 3. Approve or reject
await POST(`/api/v1/users/${userId}/kyc/verify`, {
  approved: true,
  notes: 'Documents verified',
});
```

## Best Practices

### For Users

✅ Provide clear, high-quality photos
✅ Ensure all text is readable
✅ Use valid, non-expired documents
✅ Provide accurate information

### For Admins

✅ Review documents within 24-48 hours
✅ Provide clear rejection reasons
✅ Keep verification notes detailed
✅ Flag suspicious submissions

### For Developers

✅ Use secure document storage
✅ Implement signed URLs for documents
✅ Log all verification actions
✅ Send notifications on status changes
✅ Implement rate limiting on submissions

## Troubleshooting

### KYC Rejected

- Review rejection notes
- Resubmit with corrected documents
- Contact support if unclear

### Documents Not Uploading

- Check file size (max 5MB)
- Check file format (JPEG, PNG)
- Check internet connection
- Try different browser

### Status Not Updating

- Refresh the page
- Check verification queue (admin)
- Contact support

## Compliance

### Kenya Regulations

- Comply with KYC/AML regulations
- Store documents as required by law
- Report suspicious activity

### Data Protection

- GDPR compliance (if serving EU)
- Kenya Data Protection Act
- User consent for data processing

## Future Enhancements

- [ ] Automated document verification (OCR, face matching)
- [ ] Multi-factor authentication
- [ ] Biometric verification
- [ ] Video KYC
- [ ] Real-time verification status updates (WebSocket)
- [ ] Document expiration tracking
- [ ] Periodic re-verification
