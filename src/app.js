'use strict'
const Meta = require('@mutable/meta')
const routes = require('./routes')
const proxy = require('./proxy')
let config = {}

Meta.config()
  .then(c => {
    config = c
    proxy.updateConfig(config)
    routes.updateConfig(config)
    Meta.on('configChange', c => proxy.updateConfig(c))
    Meta.on('configChange', c => routes.updateConfig(c))
    return c
  })
  .catch(e => {throw e})
