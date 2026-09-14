import { prisma } from './database.service';
import { UserStatus, KYCStatus } from '@prisma/client';

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  address?: string;
  city?: string;
}

export interface KYCSubmissionData {
  nationalId: string;
  idDocumentUrl?: string;
  photoUrl?: string;
  address: string;
  city: string;
}

export interface UserFilters {
  status?: string;
  role?: string;
  kycStatus?: string;
}

export class UserService {
  /**
   * Get user by ID with safe fields
   */
  static async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        kycStatus: true,
        nationalId: true,
        address: true,
        city: true,
        country: true,
        stellarPublicKey: true,
        mobileMoneyNumber: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, data: UpdateProfileData) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        address: true,
        city: true,
        country: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Submit KYC documents
   */
  static async submitKYC(userId: string, data: KYCSubmissionData) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.kycStatus === KYCStatus.APPROVED) {
      throw new Error('KYC already approved');
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        nationalId: data.nationalId,
        idDocumentUrl: data.idDocumentUrl,
        photoUrl: data.photoUrl,
        address: data.address,
        city: data.city,
        kycStatus: KYCStatus.PENDING,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        kycStatus: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get KYC status
   */
  static async getKYCStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
        nationalId: true,
        idDocumentUrl: true,
        photoUrl: true,
        address: true,
        city: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Verify KYC (Admin/Verifier only)
   */
  static async verifyKYC(userId: string, approved: boolean, verifierId: string, notes?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.kycStatus !== KYCStatus.PENDING) {
      throw new Error('KYC verification is not pending');
    }

    // Update user KYC status and account status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: approved ? KYCStatus.APPROVED : KYCStatus.REJECTED,
        status: approved ? UserStatus.ACTIVE : UserStatus.PENDING,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        kycStatus: true,
        status: true,
      },
    });

    // Log the verification action
    await prisma.systemLog.create({
      data: {
        level: 'info',
        message: `KYC ${approved ? 'approved' : 'rejected'} for user ${userId}`,
        service: 'kyc',
        metadata: JSON.stringify({
          userId,
          verifierId,
          approved,
          notes,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    return updatedUser;
  }

  /**
   * List users with filters and pagination
   */
  static async listUsers(filters: UserFilters, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.role) where.role = filters.role;
    if (filters.kycStatus) where.kycStatus = filters.kycStatus;

    // Get total count
    const total = await prisma.user.count({ where });

    // Get users
    const users = await prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        kycStatus: true,
        city: true,
        country: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update user status (Admin only)
   */
  static async updateUserStatus(userId: string, status: UserStatus, reason?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        status: true,
      },
    });

    // Log status change
    await prisma.systemLog.create({
      data: {
        level: 'warn',
        message: `User status changed to ${status}`,
        service: 'user-management',
        metadata: JSON.stringify({
          userId,
          newStatus: status,
          reason,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    return updatedUser;
  }

  /**
   * Delete user (Admin only)
   */
  static async deleteUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Soft delete by setting status to BANNED
    // In production, consider hard delete with cascade or archiving
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.BANNED,
        updatedAt: new Date(),
      },
    });

    // Log deletion
    await prisma.systemLog.create({
      data: {
        level: 'warn',
        message: `User deleted: ${userId}`,
        service: 'user-management',
        metadata: JSON.stringify({
          userId,
          phoneNumber: user.phoneNumber,
          timestamp: new Date().toISOString(),
        }),
      },
    });
  }

  /**
   * Get user statistics (for admin dashboard)
   */
  static async getUserStatistics() {
    const [totalUsers, activeUsers, pendingKYC, approvedKYC, rejectedKYC, usersByRole] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
        prisma.user.count({ where: { kycStatus: KYCStatus.PENDING } }),
        prisma.user.count({ where: { kycStatus: KYCStatus.APPROVED } }),
        prisma.user.count({ where: { kycStatus: KYCStatus.REJECTED } }),
        prisma.user.groupBy({
          by: ['role'],
          _count: true,
        }),
      ]);

    return {
      totalUsers,
      activeUsers,
      kyc: {
        pending: pendingKYC,
        approved: approvedKYC,
        rejected: rejectedKYC,
      },
      byRole: usersByRole.reduce(
        (acc, item) => {
          acc[item.role] = item._count;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }
}
