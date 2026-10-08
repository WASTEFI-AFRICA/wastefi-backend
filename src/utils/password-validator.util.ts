/**
 * Password validation utility
 * Enforces strong password requirements for user security
 */

export interface PasswordStrength {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong';
  score: number;
  feedback: string[];
}

export class PasswordValidatorUtil {
  // Password requirements
  private static readonly MIN_LENGTH = 8;
  private static readonly UPPERCASE_REGEX = /[A-Z]/;
  private static readonly LOWERCASE_REGEX = /[a-z]/;
  private static readonly NUMBER_REGEX = /[0-9]/;
  private static readonly SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

  /**
   * Validate password against strength requirements
   * @param password - The password to validate
   * @returns Validation result with strength indicator
   */
  static validatePassword(password: string): PasswordStrength {
    const feedback: string[] = [];
    let score = 0;

    // Check minimum length
    if (password.length < this.MIN_LENGTH) {
      feedback.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
    } else {
      score += 1;
    }

    // Check for uppercase letter
    if (!this.UPPERCASE_REGEX.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    // Check for lowercase letter
    if (!this.LOWERCASE_REGEX.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    // Check for number
    if (!this.NUMBER_REGEX.test(password)) {
      feedback.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    // Check for special character
    if (!this.SPECIAL_CHAR_REGEX.test(password)) {
      feedback.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?)');
    } else {
      score += 1;
    }

    // Bonus points for longer passwords
    if (password.length >= 12) {
      score += 1;
    }
    if (password.length >= 16) {
      score += 1;
    }

    // Determine strength based on score
    let strength: 'weak' | 'medium' | 'strong';
    if (score < 4) {
      strength = 'weak';
    } else if (score < 6) {
      strength = 'medium';
    } else {
      strength = 'strong';
    }

    // Password is valid only if all basic requirements are met (score >= 5)
    const isValid = score >= 5 && feedback.length === 0;

    return {
      isValid,
      strength,
      score,
      feedback,
    };
  }

  /**
   * Check if password meets minimum requirements
   * @param password - The password to check
   * @returns true if password is valid, throws error otherwise
   */
  static enforcePasswordRequirements(password: string): boolean {
    const result = this.validatePassword(password);

    if (!result.isValid) {
      throw new Error(`Password does not meet requirements: ${result.feedback.join('; ')}`);
    }

    return true;
  }

  /**
   * Get password strength description for API responses
   * @param password - The password to evaluate
   * @returns Password strength information
   */
  static getPasswordStrength(password: string): PasswordStrength {
    return this.validatePassword(password);
  }

  /**
   * Custom validator for express-validator
   * @param password - The password to validate
   * @returns true if valid, throws error otherwise
   */
  static customValidator(password: string): boolean {
    return this.enforcePasswordRequirements(password);
  }

  /**
   * Get password requirements as a string for user guidance
   * @returns String describing password requirements
   */
  static getRequirementsDescription(): string {
    return `Password must be at least ${this.MIN_LENGTH} characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*()_+-=[]{};':"\\|,.<>/?)`;
  }
}
