#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Telegram Investment Bot Setup Guide${NC}\n"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js ${NC}$(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm ${NC}$(npm -v)\n"

# Check if PostgreSQL is running
echo -e "${YELLOW}📋 Checking dependencies...${NC}"
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✅ PostgreSQL is installed${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL not found. Using Docker is recommended.${NC}"
fi

echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
npm install --legacy-peer-deps

echo -e "\n${YELLOW}🔄 Generating Prisma Client...${NC}"
npm run prisma:generate

echo -e "\n${YELLOW}🛠️ Building project...${NC}"
npm run build

echo -e "\n${YELLOW}📝 Setting up .env file...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Created .env file. Please edit it with your configuration:${NC}"
    echo "   - BOT_TOKEN: Your Telegram bot token from @BotFather"
    echo "   - DATABASE_URL: Your PostgreSQL connection string"
    echo "   - ADMIN_IDS: Telegram IDs of admin users"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

echo -e "\n${YELLOW}💾 Database Setup${NC}"
echo "If you're using Docker, follow these instructions:"
echo "  1. Make sure Docker is installed"
echo "  2. Run: docker-compose up -d postgres"
echo "  3. Wait for PostgreSQL to start"
echo "  4. Run: npm run prisma:push"
echo ""
echo "If you have PostgreSQL running locally:"
echo "  Run: npm run prisma:push"

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo -e "${YELLOW}📚 Next steps:${NC}"
echo "  1. Edit .env with your configuration"
echo "  2. Start PostgreSQL (docker-compose or local)"
echo "  3. Run: npm run prisma:push"
echo "  4. Run: npm run dev (for development)"
echo ""
echo -e "${YELLOW}🚀 To start the bot:${NC}"
echo "  npm run dev     (development)"
echo "  npm start       (production)"
