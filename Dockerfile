FROM node

# Create directory
WORKDIR /opt/omniverse/node/

# Move source files to docker image
COPY . .

# Install dependencies
# RUN npm install

# Run
ENTRYPOINT npm run start