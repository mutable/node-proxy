'use strict'

import config from './config'
import routes from './routes'
import proxy from './proxy'

config.init()
  .then(()=> proxy.updateConfig(config.toString()))
  .then(()=> config.on('updated', c=> proxy.updateConfig(c)))
  .then(()=> routes.updateConfig(config.toString()))
  .then(()=> config.on('updated', c=> routes.updateConfig(c)))
