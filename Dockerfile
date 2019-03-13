FROM node:10.15

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
RUN npm install -g gatsby
COPY . .
ENTRYPOINT ["sh", "./start.sh"]