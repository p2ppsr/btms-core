FROM node:22-alpine
WORKDIR /app
COPY ./local-data/overlay-dev-container/package.json .
RUN npm i
COPY ./local-data/overlay-dev-container/index.ts .
COPY ./local-data/overlay-dev-container/tsconfig.json .
COPY ./local-data/overlay-dev-container/wait-for-services.sh /wait-for-services.sh
RUN chmod +x /wait-for-services.sh
COPY ./backend/artifacts ./artifacts
COPY ./backend/src ./src

EXPOSE 8080
CMD ["/wait-for-services.sh", "mysql", "3306", "mongo", "27017", "npm", "run", "start"]