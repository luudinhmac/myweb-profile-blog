# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN npm install

# Copy source code and Prisma schema
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 2: Run
FROM node:22-alpine

WORKDIR /app

# Copy built assets and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
