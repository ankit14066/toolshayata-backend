FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
  libreoffice \
  libreoffice-writer \
  fonts-dejavu-core \
  fonts-liberation \
  python3 \
  python3-pip \
  && rm -rf /var/lib/apt/lists/*

# Install Python PDF conversion dependencies
RUN pip3 install pdfplumber pdf2docx --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV LIBRE_OFFICE_PATH=soffice
ENV LIBRE_OFFICE_PROFILE=file:///tmp/libreoffice-profile

CMD ["node", "src/server.js"]
