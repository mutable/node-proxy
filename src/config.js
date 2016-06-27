'use strict'
let Consul = require('lsq-consul')
let lsq = require('lsq')
let Events = require('events')
let EventEmitter = Events.EventEmitter

let SERVICE_NAME = process.env.SERVICE_NAME
let CONSUL_HOST = process.env.CONSUL_HOST
let CONSUL_PORT = process.env.CONSUL_PORT

class Config extends EventEmitter {
  constructor () {
    super()
    this.config = {}
  }

  toString () {
    return this.config
  }

  init () {
    this.fetch()
    return Promise.resolve(this.keepUptodate())
  }

  fetch () {
    return lsq.services.get(SERVICE_NAME)

    .then(service=> {
      if (typeof service === 'object') {
        this.me = service
      }
      return
    })
    .then(()=> lsq.config.get())
    .catch(e=> {
      if (!this.config.hosts) {
        setTimeout(()=> this.fetch(), 5000)
      }
      console.log(e)
    })
    .then(config=> {
      this.config = config
    })
  }

  keepUptodate () {
    this._consul = new Consul({'host': CONSUL_HOST, 'port': CONSUL_PORT })
    this._consulWatcher = this._consul.watch(this._consul.kv.get, {'key': SERVICE_NAME })
    this._consulWatcher.on('change', result=> this.updateConfig(result))
    this._consulWatcher.on('error', err=> console.error('consul watch:', err))
    return this._consul
  }

  updateConfig (result) {
    if (process.env.DEBUG) {
      console.log('DEBUG :: updateConfig', result)
    }
    try {
      if (!result) throw new Error('configuration not present')
      this.config = JSON.parse(result.Value)
      this.emit('updated', this.config)
    } catch (e) {
      if (process.env.DEBUG) {
        console.log('DEBUG :: updateConfig JSON', e)
      }
      this.config = this.config || {}
    }
  }
}

let config = new Config()

module.exports = config
