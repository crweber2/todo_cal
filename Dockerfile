# syntax=docker/dockerfile:1

# 1) Build stage: compile the CRA app
FROM node:18-alpine AS build
WORKDIR /app

# Install deps using lockfile for reproducibility
COPY package*.json ./
# Install dependencies (use npm ci if lockfile exists; fallback to npm install)
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

# Build the app
COPY . .
# Ensure CRA doesn't treat warnings as errors during Docker builds
ENV CI=false
RUN npm run build

# 2) Runtime stage: serve the static build using "serve"
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Use a minimal static server
RUN npm i -g serve@14

# Copy the build output from the build stage
COPY --from=build /app/build ./build

# Koyeb provides $PORT dynamically; default to 3000 for local runs
ENV PORT=3000
EXPOSE 3000

# Start the static server
CMD ["sh", "-c", "serve -s build -l ${PORT}"]
