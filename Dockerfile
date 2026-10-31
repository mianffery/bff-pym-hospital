# ========================================================
# DOCKERFILE PRODUCCIÓN - BFF HOSPITAL PYM
# Optimizado para EasyPanel y Docker Compose
# ========================================================
FROM node:20-alpine AS base

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema mínimas
RUN apk add --no-cache tzdata
ENV TZ=America/Bogota

# Copiar definiciones de paquetes
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --omit=dev && npm cache clean --force

# Copiar código fuente
COPY src/ ./src/
COPY server.js ./

# Asignar permisos a usuario sin privilegios
RUN chown -R node:node /app
USER node

# Exponer puerto del servicio
EXPOSE 3000

# Comando de arranque
CMD ["node", "server.js"]

