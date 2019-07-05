const fs = require('fs');
const http = require('http');
const path = require('path');
const Url = require('url');

const httpProxy = require('http-proxy');
const Meta = require('@mutable/meta');
const tooBusy = require('toobusy-js');

const Routes = require('./routes');
const { IsObject, DebugPrint, IsIP } = require('./utils');

const defaultPage404 = fs.readFileSync(path.join(__dirname, '../static/404.html')).toString();

function TimeTrack(req, label) {
  if (
    req.headers.timetrack
    && (req.headers.timetrack === '*' || req.headers.timetrack === req.url)
  ) {
    if (!req.startTime) req.startTime = Date.now();
    if (!req.startTimeRandom) req.startTimeRandom = Math.floor(Math.random() * (1000000 + 1));

    console.log(
      `TimeTrack :: ${label} :: http://${req.headers.host}${req.url} ${req.startTime}-${
        req.startTimeRandom
      } ${Date.now() - req.startTime}`,
    );
  }
}

function SendWeb(res, content, code) {
  if (!res.headersSent) {
    if (typeof code === 'number') res.writeHead(code);
    res.end(content);
  }
}

function ReplaceServerUrl(host, protocol) {
  const url = Url.parse(host.target);
  DebugPrint('_replaceServerUrl', url.hostname);
  return Meta.service(url.hostname).then(
    (service) => {
      if (protocol) url.protocol = protocol;
      url.host = service[(Math.random() * service.length) | 0];
      host.target = service.length ? Url.format(url) : host.target;
      DebugPrint('_replaceServerUrlSuccess', host);
      return host;
    },
    () => host,
  );
}

function RoutePage500(res, err) {
  SendWeb(res, err || 'Something seems to be wrong', 500);
}

function HasEncryptedConnection(req) {
  return req.connection.encrypted || req.connection.pair;
}

function GetPort(req) {
  const res = req.headers.host ? req.headers.host.match(/:(\d+)/) : '';
  if (res) {
    return res[1];
  }
  return HasEncryptedConnection(req) ? '443' : '80';
}

function SetXHeaders(req) {
  req.headers['x-forwarded-for'] = req.connection.remoteAddress;
  req.headers['x-forwarded-host'] = req.headers.host;
  req.headers['x-forwarded-port'] = GetPort(req);
  req.headers['x-forwarded-proto'] = req.isSpdy || HasEncryptedConnection(req) ? 'https' : 'http';
}

class Proxy {
  constructor(config) {
    this._proxy = httpProxy.createProxyServer({ ws: true, xfwd: false });
    this._proxy.on('error', (err, req, res) => this._onError(err, req, res));
    this._proxy.on('proxyRes', (proxyRes, req) => TimeTrack(req, '_onProxyRes'));
    this._routes = new Routes(config);
    if (config) this.updateConfig(config);
    this.startProxy();
  }

  updateConfig(config) {
    this._page404 = config.page404 || defaultPage404;
    this._routes.updateConfig(config);
  }

  startProxy() {
    const port = process.env.PORT || 80;
    this._serverHttp = http.createServer(this._proxyingWeb.bind(this));
    this._serverHttp.on('upgrade', this._proxyingWebSockets.bind(this));
    this._serverHttp.listen(port);
    console.log(`listen on port ${port}`);
    return this._serverHttp;
  }

  _proxyingWeb(req, res) {
    if (!this._isLocal(req, res)) {
      DebugPrint('_proxyingWeb', req.headers.host + req.url);
      TimeTrack(req, '_proxyingWeb');
      this._routes
        .getTarget(`http://${req.headers.host}${req.url}`, req.headers)
        .then(host => ReplaceServerUrl(host), () => this._routePage404(res))
        .done(host => this._proxyWeb(req, res, host));
    }
  }

  _proxyingWebSockets(req, res, socket, head) {
    if (!this._isLocal(req, res)) {
      this._routes
        .getTarget(`http://${req.headers.host}${req.url}`, req.headers)
        .then(host => ReplaceServerUrl(host), () => this._routePage404(res))
        .done(host => this._proxyWebSockets(req, socket, head, host));
    }
  }

  _proxyWebSockets(req, socket, head, opt, cb) {
    const url = Url.parse(opt.target);
    req.url = url.path;
    opt.target = Url.format({ protocol: url.protocol, host: url.host });
    DebugPrint('_proxyWeb', opt.target + req.url);
    try {
      SetXHeaders(req);
      if (opt.changeHost) req.headers.host = url.host;
      DebugPrint('headers', req.headers);

      this._proxy.ws(req, socket, head, opt, (err) => {
        if (err && err.code && err.code === 'ECONNREFUSED' && typeof cb === 'function') cb();
      });
    } catch (e) {
      console.error('error:: _proxyWebSockets: ', e);
    }
  }

  _proxyWeb(req, res, opt) {
    if (IsObject(opt)) {
      const url = Url.parse(opt.target);
      req.headers.host = req.headers.host || '';
      req.url = url.path;
      url.pathname = '';
      opt.target = Url.format({ protocol: url.protocol, host: url.host });
      DebugPrint('_proxyWeb', opt.target + req.url);

      if (opt.redirect) {
        res.writeHead(opt.statusCode || 302, {
          location: Url.resolve(opt.target, req.url),
        });
        res.end();
      } else if (opt.content) {
        SendWeb(res, opt.content, opt.statusCode || 200);
      } else {
        try {
          SetXHeaders(req);
          if (opt.changeHost) req.headers.host = url.host;
          DebugPrint('headers', req.headers);
          TimeTrack(req, '_proxyWeb');
          this._proxy.web(req, res, opt);
        } catch (e) {
          TimeTrack(req, '_proxyWeb catch');
          this._routePage404(res);
        }
      }
    } else {
      this._checkRoutes(req, res);
    }
  }

  _routePage404(res) {
    SendWeb(res, this._page404 || '404', 404);
  }

  _onError(err, req, res) {
    TimeTrack(req, '_onError');
    if (!err || !err.code) return RoutePage500(res);
    if (err.code === 'ECONNREFUSED') return RoutePage500(res, 'Error with ECONNREFUSED');
    return this._routePage404(res);
  }

  _checkRoutes(req, res) {
    const theUrlis = Url.parse(`http://${req.headers.host}${req.url}`);
    switch (theUrlis.pathname) {
      case '/health':
        res.end(`${tooBusy.lag()}`);
        break;
      default:
        this._routePage404(res);
    }
  }

  _isLocal(req, res) {
    if (
      req.headers.host === `${process.env.MYIP}:${process.env.PORT}`
      || (!IsIP.test(req.headers.host)
        && req.headers.host !== `${process.env.MYHOST || 'localhost'}:${process.env.PORT}`
        && req.headers.host !== `${process.env.HOSTNAME || ''}:${process.env.PORT}`)
    ) return false;
    this._checkRoutes(req, res);
    return true;
  }
}

module.exports = Proxy;
