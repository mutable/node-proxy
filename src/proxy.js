'use strict'

import lsq from 'lsq'
import routes from './routes'
import http from 'http'
import httpProxy from 'http-proxy'
import tooBusy from 'toobusy-js'
import _ from 'underscore'
import Url from 'url'

class Proxy {
  constructor () {
    this._proxy = httpProxy.createProxyServer({'ws': true, 'xfwd': true})
    this.updateConfig({})
    this.startProxy()
  }

  updateConfig (config) {
    this._page404 = config.page404 || `<html><head><style>h1{margin: auto; position: absolute; top: 0; left: 0; right: 0; bottom: 0; height: 100px; font-family: 'arial'; font-weight: 100; color: #555; text-align: center; }body{background:#000;}</style></head><body><h1>404 Not Found</h1></body></html>`
  }

  startProxy () {
    this._serverHttp = http.createServer(this._proxyingWeb.bind(this))
    this._serverHttp.on('upgrade', this._proxyingWebSockets.bind(this))
    this._serverHttp.listen(process.env.PORT || 80)
    console.log('listen on port ' + (process.env.PORT || 80))
    return this._serverHttp
  }

  _isLocal (req, res) {
    if (req.headers.host !== (process.env.MYHOST || 'localhost') + ':' + process.env.PORT &&
      req.headers.host !== (process.env.MYHOST || '127.0.0.1') + ':' + process.env.PORT &&
      req.headers.host !== (process.env.MYHOST || '0.0.0.0') + ':' + process.env.PORT) return false
    this._checkRoutes(req, res)
    return true
  }

  _proxyingWeb (req, res) {
    if (this._isLocal(req, res)) return
    routes.getTarget('http://' + req.headers.host + req.url, req.headers)
      .then(host=> this._replaceServerUrl(host), ()=> this._routePage404(req, res))
      .done(host=> this._proxyWeb(req, res, host))
  }

  _proxyingWebSockets (req, res, socket, head) {
    if (this._isLocal(req, res)) return
    routes.getTarget('http://' + req.headers.host + req.url, req.headers)
      .then(host=> this._replaceServerUrl(host), ()=> this._routePage404(req, res))
      .done(host=> this._proxyWeb(req, res, host))
  }

  _proxyWebSockets (req, socket, head, opt, cb) {
    req.headers.host = req.headers.host || ''
    let url = Url.parse(opt.target)
    req.headers.host = req.headers.host || ''
    req.url = url.path
    try {
      req.headers['x-forwarded-for'] = req.connection.remoteAddress
      this._proxy.ws(req, socket, head, opt, (err, d)=> {
        if (err && err.code && err.code === 'ECONNREFUSED' && _.isFunction(cb)) cb()
      })
    } catch (e) {}
  }

  _proxyWeb (req, res, opt, cb) {
    if (!_.isObject(opt)) return this._checkRoutes(req, res)
    let error = false
    let url = Url.parse(opt.target)
    req.headers.host = req.headers.host || ''
    req.url = url.path
    url.pathname = ''
    opt.target = Url.format(url)
    if (opt.redirect) this._webRedirect(req, res, opt)
    try {
      req.headers['x-forwarded-for'] = req.connection.remoteAddress
      if (opt.changeHost) req.headers['host'] = url.host

      this._proxy.web(req, res, opt, (err, d)=> {
        if (err && err.code) {
          if (err.code === 'ECONNREFUSED' && _.isFunction(cb)) cb()
          else if (!error) this._routePage404(req, res)
        }
      })
    } catch(e) {
      error = true
      this._routePage404(req, res)
    }
  }
  _routeHealthCheck (req, res) {
    res.end(tooBusy.lag() + '')
  }

  _routePage404 (req, res) {
    this._sendWeb(res, this._page404 || '404', 404)
  }

  _checkRoutes (req, res) {
    let theUrlis = Url.parse('http://' + req.headers.host + req.url)
    switch (theUrlis.pathname) {
      case '/health':
        this._routeHealthCheck(req, res)
        break
      default:
        this._routePage404(req, res)
    }
  }

  _webRedirect (req, res, opt) {
    req.headers['location'] = Url.resolve(opt.target, req.url)
    res.writeHead(302, req.headers)
    res.end()
  }

  _sendWeb (res, content, code) {
    if (!res.headersSent) {
      if (_.isNumber(code)) res.writeHead(code)
      res.end(content)
    }
  }

  _replaceServerUrl (host) {
    let url = Url.parse(host.target)
    return lsq.services.get(url.hostname)
      .then(service=> {
        url.host = service + ''
        host.target = (service ? Url.format(url) : host.target)
        return host
      }, ()=> host)
  }
}

let proxy = new Proxy()

module.exports = proxy
