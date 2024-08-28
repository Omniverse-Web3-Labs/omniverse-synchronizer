FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY dist dist
COPY node_modules node_modules
COPY res res
CMD ["node", "dist/src/index.js"]  