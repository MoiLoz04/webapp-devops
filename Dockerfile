# 1. Usar la versión oficial de Node 22 en Alpine
FROM node:22-alpine

# 2. Instalar herramientas de desarrollo requeridas para compilar better-sqlite3
RUN apk add --no-cache python3 make g++

# 3. Crear el directorio de trabajo dentro del contenedor
WORKDIR /app

# 4. Copiar los archivos de configuración de dependencias
COPY package*.json ./

# 5. Instalar dependencias compilando los módulos nativos
RUN npm install --omit=dev

# 6. Copiar todo el código de tu proyecto al contenedor
COPY . .

# 7. Exponer el puerto 80
EXPOSE 8080
EXPOSE 6061     

# 8. Ejecutar tu archivo principal app.js
CMD ["node", "app.js"]
