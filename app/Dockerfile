# Simple single-stage build - optimised for clarity over size for this workshop.
FROM node:20-alpine

WORKDIR /app

# Copy only manifest files first so Docker can cache the npm install layer
# when application code changes but dependencies do not.
COPY package.json package-lock.json ./

# npm ci installs exactly what is in package-lock.json - reproducible builds.
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
