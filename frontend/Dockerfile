# Only for development
FROM node:22.14.0-slim AS final
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install -g npm@11.5.2
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
