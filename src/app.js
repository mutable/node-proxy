const Meta = require('@mutable/meta');
const Routes = require('./routes');
const Proxy = require('./proxy');

let config = {};
const routes = new Routes();
const proxy = new Proxy();

Meta.config()
  .then((c) => {
    config = c;
    proxy.updateConfig(config);
    routes.updateConfig(config);
    Meta.on('configChange', conf => proxy.updateConfig(conf));
    Meta.on('configChange', conf => routes.updateConfig(conf));
    return c;
  })
  .catch((e) => {
    throw e;
  });
