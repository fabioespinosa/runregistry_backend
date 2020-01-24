FROM node:12.14.0-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ENV NODE_ENV development

COPY package.json /usr/src/app
RUN npm install

COPY . /usr/src/app

