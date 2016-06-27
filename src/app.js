'use strict'

let config = require('./config')
let routes = require('./routes')
let proxy = require('./proxy')

config.init()
  .then(()=> proxy.updateConfig(config.toString()))
  .then(()=> config.on('updated', c=> proxy.updateConfig(c)))
  .then(()=> routes.updateConfig(config.toString()))
  .then(()=> config.on('updated', c=> routes.updateConfig(c)))
