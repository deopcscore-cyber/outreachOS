FROM node:22-slim

# Install build tools needed for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies
COPY package.json ./
RUN npm install --omit=dev

# Install and build client
COPY client/package.json ./client/
RUN cd client && npm install

COPY . .
RUN cd client && npm run build

EXPOSE 3000

CMD ["node", "server/index.js"]
