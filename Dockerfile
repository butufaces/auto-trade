FROM node:20-slim

WORKDIR /app

# Install minimal Puppeteer dependencies
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

# Build TypeScript
RUN npm run build
RUN npm run prisma:generate

# Set environment to production
ENV NODE_ENV=production

# Expose bot port (if using webhook)
EXPOSE 3000

# Start bot
CMD ["npm", "start"]
