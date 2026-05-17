# apps/dashboard/Dockerfile
# Multi-stage build: Node build stage → nginx serve stage.
# The VITE_API_URL is baked into the JS bundle at build time — update it via --build-arg.

FROM node:20-slim AS build
WORKDIR /app

# Install dependencies first (separate layer so npm install is cached on code changes)
COPY package.json .
RUN npm install

COPY . .

# VITE_API_URL is injected at build time — set to the API service address reachable from the browser
ARG  VITE_API_URL=http://localhost:8000
ENV  VITE_API_URL=$VITE_API_URL

RUN npm run build

# Serve the built static files with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
