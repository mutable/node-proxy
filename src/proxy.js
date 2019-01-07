'use strict'
const Meta = require('@mutable/meta')
const routes = require('./routes')
const http = require('http')
const httpProxy = require('http-proxy')
const tooBusy = require('toobusy-js')
const Url = require('url')
const isIp = new RegExp(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):?([0-9]{1,5})?$/)


class Proxy {
  constructor () {
    this._proxy = httpProxy.createProxyServer({'ws': true, 'xfwd': false})
    this._proxy.on('error', (err, req, res) => this._onError(err, req, res))
    this._proxy.on('proxyRes', (proxyRes, req, res) => this._onProxyRes(proxyRes, req, res))
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
     if (!isIp.test(req.headers.host) &&
      req.headers.host !== (process.env.MYHOST || 'localhost') + ':' + process.env.PORT &&
      req.headers.host !== (process.env.HOSTNAME || '') + ':' + process.env.PORT) return false

    this._checkRoutes(req, res)
    return true
  }

  _proxyingWeb (req, res) {
    if (this._isLocal(req, res)) return
    if (process.env.DEBUG) console.log('DEBUG :: _proxyingWeb : ', req.headers.host + req.url)

    this._timeTrack(req,'_proxyingWeb')

    routes.getTarget(`http://${req.headers.host}${req.url}`)
      .then(host=> this._replaceServerUrl(host), ()=> this._routePage404(req, res))
      .done(host=> this._proxyWeb(req, res, host))
  }

  _proxyingWebSockets (req, res, socket, head) {
    if (this._isLocal(req, res)) return
    routes.getTarget(`http://${req.headers.host}${req.url}`)
      .then(host=> this._replaceServerUrl(host), ()=> this._routePage404(req, res))
      .done(host => this._proxyWebSockets(req, socket, head, host))
  }

  _proxyWebSockets (req, socket, head, opt, cb) {
    let error = false
    let url = Url.parse(opt.target)
    req.url = url.path
    opt.target = Url.format({ protocol: url.protocol, host: url.host})
    if (process.env.DEBUG) console.log('DEBUG :: _proxyWeb : ', opt.target + req.url)
    try {
      this._setXHeaders(req)
      if (opt.changeHost) req.headers['host'] = url.host
      if (process.env.DEBUG_HEADERS) console.log('DEBUG :: headers : ', req.headers)

      this._proxy.ws(req, socket, head, opt, (err, d)=> {
        if (err && err.code && err.code === 'ECONNREFUSED' && typeof cb === 'function') cb()
      })
    } catch (e) {
      error = true
      console.error('error:: _proxyWebSockets: ',e)
    }
  }

  _proxyWeb (req, res, opt, cb) {
    if (!isObject(opt)) return this._checkRoutes(req, res)
    let error = false
    let url = Url.parse(opt.target)
    req.headers.host = req.headers.host || ''
    req.url = url.path
    url.pathname = ''
    opt.target = Url.format({ protocol: url.protocol, host: url.host})
    if (process.env.DEBUG) console.log('DEBUG :: _proxyWeb : ', opt.target + req.url)

    if (opt.redirect) return this._webRedirect(req, res, opt)
    if (opt.content) return this._webContent(req, res, opt)
    try {
      this._setXHeaders(req)
      if (opt.changeHost) req.headers['host'] = url.host

      if (process.env.DEBUG_HEADERS) console.log('DEBUG :: headers : ', req.headers)

      this._timeTrack(req, '_proxyWeb')
      this._proxy.web(req, res, opt)
    } catch(e) {
      this._timeTrack(req, '_proxyWeb catch')
      error = true
      this._routePage404(req, res)
    }
  }

  _onError(err, req, res) {
    this._timeTrack(req, '_onError')
    if (!err || !err.code) return this._routePage500(req, res)
    if (err.code === 'ECONNREFUSED') return this._routePage500(req, res,'Error with ECONNREFUSED') 
    return this._routePage404(req, res)
  }

  _onProxyRes(proxyRes, req, res) {
    this._timeTrack(req, '_onProxyRes')
  }

  _routeHealthCheck (req, res) {
    res.end(tooBusy.lag() + '')
  }

  _timeTrack(req, label) {
    if (!req.headers['timetrack']) return
    if (req.headers['timetrack'] != '*' && req.headers['timetrack'] != req.url) return
    if (!req.startTime) req.startTime = Date.now()
    if (!req.startTimeRandom) req.startTimeRandom = Math.floor(Math.random() * (1000000 + 1) )

    console.log(`TimeTrack :: ${label} :: http://${req.headers.host}${req.url} ${req.startTime}-${req.startTimeRandom} ${Date.now() - req.startTime}`)
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

  _routePage404 (req, res) {
    this._sendWeb(res, this._page404 || '404', 404)
  }

  _routePage500(req, res, err) {
    this._sendWeb(res, err || 'Something seems to be wrong' , 500)
  }

  _webContent (req, res, opt) {
    this._sendWeb(res, opt.content, opt.statusCode || 200)
  }

  _webRedirect (req, res, opt) {
    res.writeHead(opt.statusCode || 302, {'location': Url.resolve(opt.target, req.url)})
    res.end()
  }

  _sendWeb (res, content, code) {
    if (!res.headersSent) {
      if (typeof code === 'number') res.writeHead(code)
      res.end(content)
    }
  }

  _replaceServerUrl (host, protocol) {
    let url = Url.parse(host.target)
    if (process.env.DEBUG) console.log('DEBUG :: _replaceServerUrl : ', url.hostname)

    return Meta.service(url.hostname)
      .then(service=> {
        if (protocol) url.protocol = protocol
        url.host = service[Math.random() * service.length | 0]
        host.target = (service.length ? Url.format(url) : host.target)
        if (process.env.DEBUG) console.log('DEBUG :: _replaceServerUrlSuccess : ', host)
        return host
      }, ()=> host)
  }

  _setXHeaders (req) {
    req.headers['x-forwarded-for'] = req.connection.remoteAddress
    req.headers['x-forwarded-host'] = req.headers.host
    req.headers['x-forwarded-port'] = this._getPort(req)
    req.headers['x-forwarded-proto'] = (req.isSpdy || this._hasEncryptedConnection(req)) ? 'https' : 'http'

  }

  _getPort (req) {
    var res = req.headers.host ? req.headers.host.match(/:(\d+)/) : ''

    return res ? res[1] : this._hasEncryptedConnection(req) ? '443' : '80'
  }

  _hasEncryptedConnection (req) {
    return Boolean(req.connection.encrypted || req.connection.pair)
  }
}
function isObject(a) {
  return typeof a === 'object'
}
let proxy = new Proxy()

module.exports = proxy
