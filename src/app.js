'use strict'
let Meta = require('lsq-meta')
let routes = require('./routes')
let proxy = require('./proxy')
let config = {}

Meta.config()
  .then(c => config = c)
  .then(() => proxy.updateConfig(config))
  .then(() => Meta.on('configChange', c => proxy.updateConfig(c)))
  .then(() => routes.updateConfig(config))
  .then(() => Meta.on('configChange', c => routes.updateConfig(c)))
