FROM node:14 as CLIENT

COPY ./client /src
WORKDIR /src
RUN npm i
RUN npm run build

FROM node:14 as PROD
WORKDIR /src
COPY package.json .
RUN npm install --prod
COPY --from=CLIENT /src/build ./client/public
COPY index.js .

CMD ["npm", "start"]
