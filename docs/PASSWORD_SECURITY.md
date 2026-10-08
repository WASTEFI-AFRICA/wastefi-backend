# Password Security

## Overview

WasteFi implements strong password requirements to protect user accounts from unauthorized access. All user passwords must meet specific security criteria.

## Password Requirements

All passwords must meet the following criteria:

- **Minimum Length**: At least 8 characters
- **Uppercase Letter**: At least one uppercase letter (A-Z)
- **Lowercase Letter**: At least one lowercase letter (a-z)
- **Number**: At least one digit (0-9)
- **Special Character**: At least one special character (!@#$%^&*()_+-=[]{};':"\\|,.<>/?)

### Example Valid Passwords

- `SecurePass123!`
- `MyP@ssw0rd`
- `Tr0ng#Password`

### Example Invalid Passwords

- `password` - No uppercase, numbers, or special characters
- `PASSWORD123` - No lowercase or special characters
- `Pass123` - Too short, no special characters
- `Password!` - No numbers

## Password Strength Indicator

The API provides a password strength indicator with the following levels:

- **Weak**: Password does not meet all requirements (score < 4)
- **Medium**: Password meets basic requirements (score 4-5)
- **Strong**: Password exceeds basic requirements with additional length (score 6+)

### Strength Scoring

Points are awarded for:
- Meeting minimum length (8+ characters): +1 point
- Contains uppercase letter: +1 point
- Contains lowercase letter: +1 point
- Contains number: +1 point
- Contains special character: +1 point
- Length 12+ characters: +1 bonus point
- Length 16+ characters: +1 additional bonus point

## API Response Format

When a password fails validation, the API returns:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "password",
      "message": "Password does not meet requirements: Password must contain at least one uppercase letter; Password must contain at least one special character",
      "value": "weakpass123"
    }
  ]
}
```

## Implementation Details

### Registration Endpoint

When registering with a password, include it in the request body:

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "phoneNumber": "+254712345678",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

### Password Storage

- Passwords are hashed using bcrypt with a salt factor of 10
- Original passwords are never stored in the database
- Password hashes are stored securely in the `password` field of the User model

## Security Best Practices

1. **Never share your password** with anyone
2. **Use unique passwords** for different services
3. **Consider using a password manager** to generate and store strong passwords
4. **Enable two-factor authentication** when available
5. **Change your password regularly** if you suspect it has been compromised

## Developer Notes

### Password Validation Utility

The `PasswordValidatorUtil` class provides methods for:

- `validatePassword(password)` - Returns detailed validation results
- `enforcePasswordRequirements(password)` - Throws error if password is invalid
- `getPasswordStrength(password)` - Returns password strength information
- `customValidator(password)` - For use with express-validator

### Usage Example

```typescript
import { PasswordValidatorUtil } from '../utils/password-validator.util';

// Validate password and get strength info
const strength = PasswordValidatorUtil.validatePassword('MyP@ssw0rd');
console.log(strength);
// {
//   isValid: true,
//   strength: 'medium',
//   score: 5,
//   feedback: []
// }

// Enforce requirements (throws error if invalid)
try {
  PasswordValidatorUtil.enforcePasswordRequirements('weakpass');
} catch (error) {
  console.error(error.message);
}
```

## Testing

Password validation can be tested using the test suite:

```bash
npm test -- password-validator.util.test.ts
```

## Future Enhancements

Planned improvements:

1. Password history tracking (prevent reuse of recent passwords)
2. Password expiration policies
3. Breach detection integration (check against known compromised passwords)
4. Multi-factor authentication (MFA)
5. Biometric authentication options
