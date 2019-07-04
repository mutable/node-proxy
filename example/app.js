const Meta = require('@mutable/meta');
const { Proxy, Routes } = require('@mutable/proxy');

const routes = new Routes();
const proxy = new Proxy();

Meta.config()
  .then((c) => {
    proxy.updateConfig(c);
    routes.updateConfig(c);
    Meta.on('configChange', conf => proxy.updateConfig(conf));
    Meta.on('configChange', conf => routes.updateConfig(conf));
    return c;
  })
  .catch((e) => {
    throw e;
  });
