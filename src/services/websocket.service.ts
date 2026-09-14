import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger.util';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface SocketUser {
  userId: string;
  role: string;
  socketId: string;
}

export interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
}

export class WebSocketService {
  private static io: Server | null = null;
  private static connectedUsers: Map<string, SocketUser> = new Map();

  /**
   * Initialize WebSocket server
   */
  static initialize(httpServer: HTTPServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || '*',
        credentials: true,
      },
      path: '/socket.io/',
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Remove 'Bearer ' prefix if present
        const cleanToken = token.replace('Bearer ', '');

        // Verify JWT token
        const decoded = jwt.verify(cleanToken, config.jwt.secret) as any;

        // Attach user info to socket
        socket.data.userId = decoded.userId;
        socket.data.role = decoded.role;

        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', { error: error as Error });
        next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle new socket connection
   */
  private static handleConnection(socket: Socket): void {
    const userId = socket.data.userId;
    const role = socket.data.role;

    // Store connected user
    this.connectedUsers.set(socket.id, {
      userId,
      role,
      socketId: socket.id,
    });

    logger.info('User connected via WebSocket', {
      userId,
      role,
      socketId: socket.id,
    });

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join role-specific room
    socket.join(`role:${role}`);

    // Send connection confirmation
    socket.emit('connected', {
      message: 'Connected to WasteFi WebSocket',
      userId,
      timestamp: new Date(),
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Handle subscription to specific events
    socket.on('subscribe', (channel: string) => {
      this.handleSubscribe(socket, channel);
    });

    socket.on('unsubscribe', (channel: string) => {
      this.handleUnsubscribe(socket, channel);
    });

    // Handle ping for connection health check
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });
  }

  /**
   * Handle socket disconnection
   */
  private static handleDisconnection(socket: Socket): void {
    const user = this.connectedUsers.get(socket.id);

    if (user) {
      logger.info('User disconnected from WebSocket', {
        userId: user.userId,
        socketId: socket.id,
      });
      this.connectedUsers.delete(socket.id);
    }
  }

  /**
   * Handle channel subscription
   */
  private static handleSubscribe(socket: Socket, channel: string): void {
    socket.join(channel);
    socket.emit('subscribed', { channel, timestamp: new Date() });

    logger.info('User subscribed to channel', {
      userId: socket.data.userId,
      channel,
    });
  }

  /**
   * Handle channel unsubscription
   */
  private static handleUnsubscribe(socket: Socket, channel: string): void {
    socket.leave(channel);
    socket.emit('unsubscribed', { channel, timestamp: new Date() });

    logger.info('User unsubscribed from channel', {
      userId: socket.data.userId,
      channel,
    });
  }

  /**
   * Send notification to specific user
   */
  static notifyUser(userId: string, notification: NotificationPayload): void {
    if (!this.io) {
      logger.warn('WebSocket not initialized - cannot send notification');
      return;
    }

    this.io.to(`user:${userId}`).emit('notification', notification);

    logger.info('Notification sent to user', {
      userId,
      type: notification.type,
    });
  }

  /**
   * Send notification to all users with specific role
   */
  static notifyRole(role: string, notification: NotificationPayload): void {
    if (!this.io) {
      logger.warn('WebSocket not initialized - cannot send notification');
      return;
    }

    this.io.to(`role:${role}`).emit('notification', notification);

    logger.info('Notification sent to role', {
      role,
      type: notification.type,
    });
  }

  /**
   * Broadcast to all connected users
   */
  static broadcast(event: string, data: any): void {
    if (!this.io) {
      logger.warn('WebSocket not initialized - cannot broadcast');
      return;
    }

    this.io.emit(event, data);

    logger.info('Broadcast sent', { event });
  }

  /**
   * Send to specific channel
   */
  static sendToChannel(channel: string, event: string, data: any): void {
    if (!this.io) {
      logger.warn('WebSocket not initialized - cannot send to channel');
      return;
    }

    this.io.to(channel).emit(event, data);

    logger.info('Message sent to channel', { channel, event });
  }

  /**
   * Notify about new collection
   */
  static notifyNewCollection(collectorId: string, collectionData: any): void {
    // Notify the collector
    this.notifyUser(collectorId, {
      type: 'collection:created',
      title: 'Collection Submitted',
      message: 'Your waste collection has been submitted successfully',
      data: collectionData,
      timestamp: new Date(),
    });

    // Notify admins
    this.notifyRole('ADMIN', {
      type: 'collection:new',
      title: 'New Collection',
      message: `New waste collection submitted by ${collectionData.collectorName}`,
      data: collectionData,
      timestamp: new Date(),
    });
  }

  /**
   * Notify about collection verification
   */
  static notifyCollectionVerified(collectorId: string, collectionData: any): void {
    this.notifyUser(collectorId, {
      type: 'collection:verified',
      title: 'Collection Verified',
      message: `Your collection has been verified! You earned ${collectionData.amount} ${collectionData.currency}`,
      data: collectionData,
      timestamp: new Date(),
    });
  }

  /**
   * Notify about payment
   */
  static notifyPayment(userId: string, paymentData: any): void {
    this.notifyUser(userId, {
      type: 'payment:completed',
      title: 'Payment Received',
      message: `You received ${paymentData.amount} ${paymentData.currency}`,
      data: paymentData,
      timestamp: new Date(),
    });
  }

  /**
   * Notify about KYC status update
   */
  static notifyKYCUpdate(userId: string, status: string, reason?: string): void {
    const messages: Record<string, string> = {
      APPROVED: 'Your KYC verification has been approved!',
      REJECTED: `Your KYC verification was rejected${reason ? `: ${reason}` : ''}`,
      PENDING: 'Your KYC verification is under review',
    };

    this.notifyUser(userId, {
      type: 'kyc:update',
      title: 'KYC Status Update',
      message: messages[status] || 'Your KYC status has been updated',
      data: { status, reason },
      timestamp: new Date(),
    });
  }

  /**
   * Notify about withdrawal status
   */
  static notifyWithdrawal(userId: string, withdrawalData: any): void {
    const statusMessages: Record<string, string> = {
      PENDING: 'Your withdrawal request is being processed',
      COMPLETED: 'Your withdrawal has been completed successfully',
      FAILED: 'Your withdrawal request failed. Please try again',
    };

    this.notifyUser(userId, {
      type: 'withdrawal:update',
      title: 'Withdrawal Update',
      message: statusMessages[withdrawalData.status] || 'Withdrawal status updated',
      data: withdrawalData,
      timestamp: new Date(),
    });
  }

  /**
   * Get connected users count
   */
  static getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get connected users by role
   */
  static getConnectedUsersByRole(role: string): SocketUser[] {
    return Array.from(this.connectedUsers.values()).filter((user) => user.role === role);
  }

  /**
   * Check if user is connected
   */
  static isUserConnected(userId: string): boolean {
    return Array.from(this.connectedUsers.values()).some((user) => user.userId === userId);
  }

  /**
   * Get server instance
   */
  static getIO(): Server | null {
    return this.io;
  }
}
