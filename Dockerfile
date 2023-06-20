FROM node:alpine

# Create directory
WORKDIR /opt/omniverse/node/

# Move source files to docker image
COPY . .

# Run
ENTRYPOINT npm install && npm run start