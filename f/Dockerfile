FROM node:20-slim

WORKDIR /app

COPY package.json ./

# 👇 force fresh dependency resolution
RUN npm install

COPY . .

EXPOSE 8080

CMD ["npm", "run", "dev", "--", "--host"]
