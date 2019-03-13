FROM nginx:alpine

RUN mkdir /www
RUN npm install && npm install -g gatsby
RUN gatsby build
COPY public /www
COPY nginx.conf /etc/nginx/nginx.conf