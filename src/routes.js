const Promise = require('promise');
const Url = require('url');
const Path = require('path');

const { IsObject, DebugPrint } = require('./utils');

function FindTarget(host, path) {
  const thePath = path.split('/');
  let currentHost = Object.assign({}, host);
  const vars = {};
  const listTargets = [];
  const currentPath = [];
  if (currentHost.target || currentHost.redirect || currentHost.content) {
    listTargets.push({ template: currentHost, path: currentPath });
  }
  // iterate through the path to get the target
  for (let currentPathIndex = 0; currentPathIndex < thePath.length; currentPathIndex += 1) {
    // if no routes end
    if (!IsObject(currentHost.routes)) break;
    // set current
    const segment = thePath[currentPathIndex];
    let segHost = currentHost.routes[segment];
    // if no route host then end
    if (!IsObject(segHost)) {
      let key = null;
      Object.keys(currentHost.routes).some((k) => {
        if (k[0] === '{') {
          key = k;
          return true;
        }
        return false;
      });
      if (!key) break;
      segHost = currentHost.routes[key];
      vars[key.substring(1, key.length - 1)] = segment;
    }
    // set the next host to be currenthost
    currentHost = segHost;
    // if no target then go to the next
    if (segHost.target || segHost.redirect || segHost.content) {
      // add the level path you're at
      currentPath.push(segment);
      //  add as possible targets
      listTargets.push({ template: segHost, path: [].concat(currentPath) });
    }
  }

  if (!listTargets.length) return { template: {} };
  //  get the last valid target
  const lastEl = listTargets.pop();
  return { vars, template: lastEl.template, path: lastEl.path };
}

class Routes {
  constructor(config) {
    if (config) this.updateConfig(config);
  }

  updateConfig(config) {
    DebugPrint('updateConfig:router', config);
    this.hosts = config.hosts || {};
    this.tokens = config.tokens || {};
    this.publish = config.publish || [];
  }

  getTarget(url, headers) {
    const parsedUrl = Url.parse(url);

    // get the host based on key in config
    const template = this.hosts[parsedUrl.hostname.toLowerCase()];
    DebugPrint('getTarget', template, parsedUrl, this.hosts);
    if (!template) return Promise.reject(new Error('No matching hosts'));

    // remove trailing / in url path
    const fullUrlPath = parsedUrl.path[parsedUrl.path.length - 1] === '/'
      ? parsedUrl.path.substring(1, parsedUrl.path.length - 1)
      : parsedUrl.path.substring(1, parsedUrl.path.length);
    const urlPathname = parsedUrl.pathname[parsedUrl.pathname.length - 1] === '/'
      ? parsedUrl.pathname.substring(1, parsedUrl.pathname.length - 1)
      : parsedUrl.pathname.substring(1, parsedUrl.pathname.length);

    // look for the target/redirect it will push to
    const result = FindTarget(template, urlPathname);

    // Couldnt find a target
    if (!result.template.target && !result.template.redirect && !result.template.content) return Promise.reject(new Error('No Target/Redirect/Content'));

    // replace the target with template vars
    return Promise.resolve(
      this.applyTemplate(fullUrlPath, result.path, result.vars, result.template, headers),
    );
  }

  applyTemplate(fullPath, currentPath, vars, template, headers) {
    DebugPrint('applyTemplate:pre', vars, template, currentPath, headers);
    template = template || {};
    template = {
      target: template.target || '',
      redirect: template.redirect,
      content: template.content,
      statusCode: template.statusCode,
      changeHost: template.changeHost,
    };

    // if content just return don't care about url replacing
    if (template.content) return Promise.resolve(template);

    // set base to
    let base = template.target;
    const path = currentPath.join('/');
    if (base.substring(base.length - 4, base.length) === '/[~]') {
      //  remove suffix and add just the path that wasnt used in findtarget
      //  EX: exmaple.com/images/a.jpg -> http://image/[~] = http://image/a.jpg
      base = base.substring(0, base.length - 4);
      const url = Url.parse(base);
      let restOfPath = fullPath.replace(path, '');
      let query = '';
      if (restOfPath.length > 0 && restOfPath[0] === '?') {
        query = restOfPath;
        restOfPath = '';
      }
      base = Url.resolve(base, Path.join(url.path, restOfPath) + query);
    } else if (base.substring(base.length - 4, base.length) === '/[*]') {
      //  remove suffix and add the whole path as is
      //  EX: exmaple.com/images/a.jpg -> http://image/[*] = http://image/images/a.jpg
      base = base.substring(0, base.length - 4);
      base = Url.resolve(base, fullPath);
    }

    // fill in the variables from template
    Object.keys(vars).forEach((key) => {
      base = base.replace(`%7B${key}%7D`, vars[key]).replace(`{${key}}`, vars[key]);
      return base;
    });

    // reset the changes to url back to target
    template.target = base;
    const url = Url.parse(base);

    // if there is . in hostname then exit now with that target
    if (url.hostname.indexOf('.') > -1) return Promise.resolve(template);

    // Check if there is a pass through token that ignores publish arr
    const hybridPass = IsObject(headers)
      ? Object.keys(this.tokens).filter(key => this.tokens[key] === headers['x-lsq'])
      : false;
    const hybridHost = IsObject(headers) ? headers['x-lsq-host'] : false;

    // if pass through then do a direct mapping of org path to target path; ignore template
    if (hybridHost && hybridPass) {
      return Promise.resolve({ target: Url.resolve(hybridHost, fullPath) });
    }

    // checks to see if it is in the publish arr otherwise deny
    if (this.publish.indexOf(url.hostname) === -1 && !hybridPass) {
      return Promise.reject(new Error('Not Allowed'));
    }
    // allow for redirect replace url like target
    DebugPrint('applyTemplate', template);
    return Promise.resolve(template);
  }
}

module.exports = Routes;
