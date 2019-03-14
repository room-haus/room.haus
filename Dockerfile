FROM nginx:alpine

RUN mkdir /www
COPY public /www
COPY nginx.conf /etc/nginx/nginx.conf