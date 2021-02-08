const http = require('http');
const Koa = require('koa');
const koaBody = require('koa-body');
const Router = require('koa-router');
const uuid = require('uuid');
const router = new Router();
const app = new Koa();
const WS = require('ws');

app.use(koaBody({
    urlencoded: true,
    multipart: true,
    json: true,
}));

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());
const wsServer = new WS.Server({ server });

const messages = [];

app.use(async (ctx, next) => {
    const origin = ctx.request.get('Origin');
    if (!origin) {
      return await next();
    }

    const headers = { 'Access-Control-Allow-Origin': '*', };

    if (ctx.request.method !== 'OPTIONS') {
      ctx.response.set({...headers});
      try {
        return await next();
      } catch (e) {
        e.headers = {...e.headers, ...headers};
        throw e;
      }
    }

    if (ctx.request.get('Access-Control-Request-Method')) {
      ctx.response.set({
        ...headers,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
      });

      if (ctx.request.get('Access-Control-Request-Headers')) {
        ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
      }

      ctx.response.status = 204;
    }
  });

  router.get('/allmessages', async (ctx, next) => {
    const { query } = ctx.request;
    const length = Number(query.length);
    const msg = messages.reverse().slice(length, length + 10);
    messages.reverse();
    ctx.response.body = msg;
  });

  router.get('/allmessages/:type', async (ctx, next) => {
    const typeMessages = messages.filter((el) => el.content.type === ctx.params.type);
    console.log(typeMessages);
    ctx.response.body = typeMessages;
  });

  router.get('/favorites', async (ctx, next) => {
    const favorites = messages.filter((el) => el.content.favorite === true);
    ctx.response.body = favorites;
  });

  router.get('/pinned', async (ctx, next) => {
    const pinned = messages.filter((el) => el.content.pinned === true);
    ctx.response.body = pinned;
  });

  router.patch('/favorites/:id', async (ctx, next) => {
    const index = messages.findIndex((el) => el.content.id === ctx.params.id);
    if (index !== -1) {
      const favorite = messages[index].content.favorite;
      messages[index].content.favorite = !favorite;
    }

    ctx.response.body = {
      status: 'ok'
    }
  });

  router.patch('/pinned/:id', async (ctx, next) => {
    const index = messages.findIndex((el) => el.content.id === ctx.params.id);
    if (index !== -1) {
      const pinned = messages[index].content.pinned;
      if (pinned) {
        messages[index].content.pinned = false;
      } else {
        messages.map((el) => el.content.pinned = false);
        messages[index].content.pinned = true;
      }
    }

    ctx.response.body = {
      status: 'ok'
    }
  });

  wsServer.on("connection", (ws, req) => {
    console.log("connected to server");

    ws.on("message", message => {
      console.log("message");
      messages.push(JSON.parse(message));
      [...wsServer.clients]
        .filter(el => {
          return el.readyState === WS.OPEN;
        })
        .forEach(el => el.send(message));
    });

    ws.on("close", message => {
      console.log("closed chat");
      [...wsServer.clients]
        .filter(el => {
          return el.readyState === WS.OPEN;
        })
        .forEach(el => el.send(JSON.stringify({ type: "logout" })));
      ws.close();
    });

    [...wsServer.clients]
      .filter(el => {
        return el.readyState === WS.OPEN;
      })
      .forEach(el => el.send(JSON.stringify({ type: "login" })));
  });

  app.use(router.routes()).use(router.allowedMethods());

  server.listen(port);
