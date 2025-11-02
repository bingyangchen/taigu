FROM node:22.14.0-slim AS dev_final
RUN apt-get update && apt-get install -y git && apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install -g npm@11.5.2
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
