FROM node:22.14.0-slim AS node_base

########################################################################################

FROM node_base AS dev_final
RUN apt-get update && apt-get install -y git && apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install -g npm@11.5.2
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

########################################################################################

FROM dev_final AS builder
RUN npm run build

########################################################################################

FROM node_base AS prod_final
WORKDIR /app
COPY --from=builder /app/build ./build
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
