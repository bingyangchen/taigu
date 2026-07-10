# Only for development
FROM node:22.14.0-slim AS final
WORKDIR /app
# Puppeteer is only used by the production prerender step (npm run build).
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm install -g npm@11.5.2
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
