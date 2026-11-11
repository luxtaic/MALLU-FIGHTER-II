FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY index.html styles.css server.mjs build.mjs ./
COPY src ./src
COPY dist ./dist
COPY net ./net
COPY tts ./tts
COPY scripts ./scripts
COPY assets ./assets

RUN mkdir -p assets/voices/cache && chmod -R a+rwX assets/voices

ENV PORT=7860
EXPOSE 7860

CMD ["node", "server.mjs"]
