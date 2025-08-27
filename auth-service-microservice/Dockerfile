FROM node:18-alpine

RUN apk add --no-cache dumb-init curl

# usuario sin privilegios
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN mkdir -p logs && chown -R nodejs:nodejs /usr/src/app

USER nodejs
EXPOSE 3001
CMD ["dumb-init","node","src/index.js"]
