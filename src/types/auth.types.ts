import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface JWTPayload {
  userId: string;
  phoneNumber: string;
  role: UserRole;
  email?: string;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
  apiKey?: {
    id: string;
    userId: string;
    name: string;
  };
}

export interface LoginCredentials {
  phoneNumber: string;
  password?: string;
  otp?: string;
}

export interface RegisterData {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: string;
  user: {
    id: string;
    phoneNumber: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    email?: string;
  };
}

export interface ApiKeyCreateData {
  name: string;
  expiresAt?: Date;
}

export interface ApiKeyResponse {
  id: string;
  key: string;
  name: string;
  createdAt: Date;
  expiresAt?: Date;
}
