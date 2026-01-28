FROM public.ecr.aws/docker/library/node:20-bookworm

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

RUN npm prune --omit=dev

CMD ["npm", "start"]






