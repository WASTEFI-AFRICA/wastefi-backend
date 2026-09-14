import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WasteFi API Documentation',
      version: '1.0.0',
      description: `
        WasteFi Backend API - Financial inclusion through waste collection powered by blockchain.
        
        ## Features
        - User registration and KYC verification
        - Waste collection recording and verification
        - Stellar blockchain payments
        - Mobile money integration (M-Pesa, MTN, Airtel)
        - Material passport generation with RecycleGraph
        - Real-time WebSocket notifications
        - Admin dashboard and analytics
        
        ## Authentication
        Most endpoints require JWT authentication. Include the token in the Authorization header:
        \`Authorization: Bearer <your-jwt-token>\`
        
        API keys can also be used for machine-to-machine communication:
        \`X-API-Key: <your-api-key>\`
      `,
      contact: {
        name: 'WasteFi Support',
        email: 'support@wastefi.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.app.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.wastefi.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/v1/auth/login',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key obtained from /api/v1/auth/api-keys',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'Error message',
                },
                code: {
                  type: 'string',
                  example: 'ERROR_CODE',
                },
                details: {
                  type: 'object',
                  nullable: true,
                },
              },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            requestId: {
              type: 'string',
              format: 'uuid',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            phoneNumber: {
              type: 'string',
            },
            firstName: {
              type: 'string',
            },
            lastName: {
              type: 'string',
            },
            role: {
              type: 'string',
              enum: ['USER', 'COLLECTOR', 'ADMIN'],
            },
            kycStatus: {
              type: 'string',
              enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'],
            },
            isActive: {
              type: 'boolean',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        WasteCollection: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            materialType: {
              type: 'string',
            },
            weight: {
              type: 'number',
              format: 'float',
            },
            estimatedValue: {
              type: 'number',
              format: 'float',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'VERIFIED', 'REJECTED', 'PAID'],
            },
            imageUrls: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            amount: {
              type: 'number',
              format: 'float',
            },
            currency: {
              type: 'string',
              enum: ['KES', 'XLM'],
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'],
            },
            transactionHash: {
              type: 'string',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        CollectionPoint: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            location: {
              type: 'string',
            },
            latitude: {
              type: 'number',
              format: 'float',
            },
            longitude: {
              type: 'number',
              format: 'float',
            },
            acceptedMaterials: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            operatingHours: {
              type: 'object',
            },
            isVerified: {
              type: 'boolean',
            },
          },
        },
        MaterialPassport: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            materialType: {
              type: 'string',
            },
            weight: {
              type: 'number',
              format: 'float',
            },
            recycleGraphId: {
              type: 'string',
              nullable: true,
            },
            carbonCredits: {
              type: 'number',
              format: 'float',
            },
            chainOfCustody: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required or token invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  message: 'Authentication required',
                  code: 'UNAUTHORIZED',
                },
                timestamp: '2026-09-14T10:00:00Z',
                requestId: '123e4567-e89b-12d3-a456-426614174000',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  message: 'Insufficient permissions',
                  code: 'FORBIDDEN',
                },
                timestamp: '2026-09-14T10:00:00Z',
                requestId: '123e4567-e89b-12d3-a456-426614174000',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  message: 'Resource not found',
                  code: 'NOT_FOUND',
                },
                timestamp: '2026-09-14T10:00:00Z',
                requestId: '123e4567-e89b-12d3-a456-426614174000',
              },
            },
          },
        },
        ValidationError: {
          description: 'Invalid input data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  message: 'Validation failed',
                  code: 'VALIDATION_ERROR',
                  details: {
                    email: 'Invalid email format',
                  },
                },
                timestamp: '2026-09-14T10:00:00Z',
                requestId: '123e4567-e89b-12d3-a456-426614174000',
              },
            },
          },
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  message: 'Too many requests',
                  code: 'RATE_LIMIT_EXCEEDED',
                },
                timestamp: '2026-09-14T10:00:00Z',
                requestId: '123e4567-e89b-12d3-a456-426614174000',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Users',
        description: 'User management and KYC operations',
      },
      {
        name: 'Wallet',
        description: 'Stellar wallet operations and transactions',
      },
      {
        name: 'Waste Collections',
        description: 'Waste collection recording and verification',
      },
      {
        name: 'Collection Points',
        description: 'Collection point management and geolocation',
      },
      {
        name: 'Payments',
        description: 'Payment processing and mobile money integration',
      },
      {
        name: 'Material Passports',
        description: 'Digital material passports and RecycleGraph integration',
      },
      {
        name: 'Admin',
        description: 'Admin dashboard and analytics',
      },
      {
        name: 'Health',
        description: 'Service health and monitoring',
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
