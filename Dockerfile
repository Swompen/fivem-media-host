# Stage 1: Build React dashboard
FROM node:20-alpine AS dashboard-build
WORKDIR /dashboard
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ .
# Build outputs to ../app/dashboard but we override for Docker context
RUN npx vite build --outDir dist

# Stage 2: Build NestJS app
FROM node:20-alpine
WORKDIR /app
COPY app/package*.json ./
RUN npm install
COPY app/ .
COPY --from=dashboard-build /dashboard/dist ./dashboard
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
