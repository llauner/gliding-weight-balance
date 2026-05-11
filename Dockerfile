# Use official Node.js LTS image
FROM node:22-alpine

# Set application name
LABEL org.opencontainers.image.title="Gliding-weight-balance"

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy all source files
COPY . .

# Expose the API port
EXPOSE 3000

# Start the REST API
CMD ["node", "server.js"]
