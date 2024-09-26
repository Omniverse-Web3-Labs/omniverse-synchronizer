# based on official Node.js image
FROM node:18-alpine AS builder

RUN apk add --no-cache python3 make g++

# set working directory
WORKDIR /app

# copy package.json  package-lock.json
COPY package*.json ./

# install dependencies
RUN npm install

# copy source code
COPY ./src ./src
COPY tsconfig.json .

# build TypeScript to JavaScript
RUN npx tsc

WORKDIR /production

COPY package*.json ./

RUN npm install -only=production

# build image for production environment
FROM node:18-alpine

# set working directory
WORKDIR /app

# copy js code
COPY --from=builder /app/dist ./dist

# copy package*.json
COPY package*.json ./

# copy res
COPY res ./

# copy dependencies
COPY --from=builder /production/node_modules ./node_modules

# launch command
CMD ["node", "dist/index.js"]
