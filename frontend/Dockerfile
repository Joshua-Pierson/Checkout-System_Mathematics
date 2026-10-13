FROM node:20-alpine

WORKDIR /app

# Copies the package definitions and installs Vite
COPY package*.json ./
RUN npm install

# Copies the rest of the frontend source code
COPY . .

EXPOSE 3000

# Binds the Vite server to 0.0.0.0 to allow external Docker network routing
CMD ["npm", "run", "dev"]