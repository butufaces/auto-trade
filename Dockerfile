FROM node:20-slim

WORKDIR /app

# Install minimal dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source files
COPY src ./src
COPY tsconfig.json ./
COPY prisma ./prisma

# Generate Prisma client first (before build)
RUN npm run prisma:generate

# Build TypeScript
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Expose bot port (if using webhook)
EXPOSE 3000

# Start bot
CMD ["npm", "start"]
