# 1. Use a base Node.js image
FROM node:20-alpine

# 2. Create app directory inside container
WORKDIR /app

# 3. Install dependencies
COPY package*.json ./
RUN npm install

# 4. Copy your app source code
COPY tsconfig.json ./
COPY src ./src

# 5. Build the TypeScript app
RUN npm run build

# 6. Manually copy views to dist
RUN cp -r src/views dist/

# 7. Expose port and run the app
EXPOSE 8000
CMD ["node", "dist/index.js"]

