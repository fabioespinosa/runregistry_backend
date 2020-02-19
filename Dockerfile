FROM node:13.8-stretch

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ENV NODE_ENV production
ENV ENV kubernetes

COPY package.json /usr/src/app
RUN npm install

COPY . /usr/src/app

EXPOSE 9500

CMD ["npm", "start"]