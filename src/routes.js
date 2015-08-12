import Promise from 'promise'
import Url from 'url'
import _ from 'underscore'

class Routes {
  constructor () {
    this.updateConfig({})
  }

  updateConfig (config) {
    this.hosts = config.hosts || {}
    this.tokens = config.tokens || {}
    this.publish = config.publish || []
  }

  getTarget (url, headers) {
    return new Promise((resolve, reject)=> {
      url = Url.parse(url)
      let host = this.hosts[url.hostname.toLowerCase()]
      if (!host) return reject('No Hosts')
      let urlPath = (url.path[url.path.length - 1] === '/') ? url.path.substring(1, url.path.length - 1) : url.path.substring(1, url.path.length)
      let result = this.findTarget(host, urlPath.split('/'), {}, host.target, [])
      resolve(this.applyTemplate(urlPath, result.currentPath, result.vars, this._newHost(result.host), headers))
    })
  }

  _newHost (host) {
    let newHost = {
      'target': host.target,
      'redirect': host.redirect,
      'changeHost': host.changeHost
    }
    return newHost
  }

  findTarget (host, path, vars, base, currentPath) {
    if (!path.length || !_.isObject(host)) {
      if (!_.isObject(host)) currentPath.pop()
      return {vars, 'host': base, currentPath}
    } else if (!host.routes) {
      if (!host.target) {
        currentPath.pop()
        return {vars, 'host': base, currentPath}
      }
      return {vars, 'host': host, currentPath}
    }

    let pathPart = path.shift()
    currentPath.push(pathPart)

    let next = null
    if (_.isObject(host.routes[pathPart])) next = host.routes[pathPart]

    if (!next) {
      let key = null
      for (let k in host.routes) {
        if (k[0] === '{') {
          key = k
          break
        }
      }

      if (!key) return this.findTarget(next, path, vars, next && next.target ? next : host || base, currentPath)

      next = host.routes[key]
      vars[key.substring(1, key.length - 1)] = pathPart
    }

    return this.findTarget(next, path, vars, next && next.target ? next : host || base, currentPath)
  }

  applyTemplate (fullPath, currentPath, vars, host, headers) {
    let base = host.target
    let path = currentPath.join('/')

    if (base.substring(base.length - 4, base.length) === '/[~]') {

      base = base.substring(0, base.length - 4)
      base = Url.resolve(base, fullPath.replace(path, ''))

    } else if (base.substring(base.length - 4, base.length) === '/[*]') {

      base = base.substring(0, base.length - 4)
      base = Url.resolve(base, fullPath)

    }

    for (let key in vars)
      base = base.replace('{' + key + '}', vars[key])

    host.target = base

    let url = Url.parse(base)
    if (url.hostname.indexOf('.') > -1) return Promise.resolve(host)

    let hybridPass = _.isObject(headers) ? _.findKey(this.tokens, token => token === headers['x-lsq']) : false
    let hybridHost = _.isObject(headers) ? headers['x-lsq-host'] : false
    if (hybridHost && hybridPass) return Promise.resolve({'target': Url.resolve(hybridHost, fullPath)})

    if (this.publish.indexOf(url.hostname) === -1 && !hybridPass) {
      return Promise.reject('Not Allowed')
    }

    host.target = base
    return Promise.resolve(host)
  }

}

module.exports = new Routes()
