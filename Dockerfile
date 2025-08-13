# syntax=docker/dockerfile:1

FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy source code
COPY . .

# Build the React app
ENV CI=false
RUN npm run build

# Create data directory for calendar storage
RUN mkdir -p data

# Koyeb provides $PORT dynamically; default to 3001 for local runs
ENV PORT=3001
EXPOSE 3001

# Start the server (serves both API and static files)
CMD ["npm", "run", "server"]
