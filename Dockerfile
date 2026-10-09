# Multi-stage build for WasteFi Backend

# Stage 1: Build
FROM node:20-alpine AS builder

# Prisma needs OpenSSL to detect which query engine to generate; the Alpine base
# image does not include it.
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev dependencies for building)
RUN npm ci && \
    npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

# dumb-init for proper signal handling, and OpenSSL for the Prisma query engine
RUN apk add --no-cache dumb-init openssl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Directories the app writes to at runtime (profile pictures, database backups).
# /app is owned by root, so the non-root user cannot create these itself; without
# this the container exits at startup with EACCES on /app/uploads. Mount a volume
# at these paths if the data must outlive the container.
RUN mkdir -p /app/uploads /app/backups && chown -R nodejs:nodejs /app/uploads /app/backups

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Apply any pending database migrations, then start the server. Doing this in the
# image means every host (Docker Compose, Render, Railway, a plain `docker run`)
# starts the same way and a fresh database is ready on first boot. Prisma takes an
# advisory lock while migrating, so several instances starting together are safe.
# If the migration fails the container exits and the host's restart policy applies.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
