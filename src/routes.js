'use strict'
let Promise = require('promise')
let Url = require('url')
let Path = require('path')

class Routes {
  constructor () {
    this.updateConfig({})
  }

  updateConfig (config) {
    if (process.env.DEBUG) {
      console.log('DEBUG :: updateConfig:router : ', config)
    }
    this.hosts = config.hosts || {}
    this.tokens = config.tokens || {}
    this.publish = config.publish || []
  }

  getTarget (url, headers) {
      url = Url.parse(url)
      //
      // get the host based on key in config 
      //
      let template = this.hosts[url.hostname.toLowerCase()]
      if (process.env.DEBUG) {
        console.log('DEBUG :: getTarget : ', template, url, this.hosts)
      }
      if (!template) return Promise.reject('No Hosts')
      //
      // remove trailing / in url path
      //
      let fullUrlPath = (url.path[url.path.length - 1] === '/') ? url.path.substring(1, url.path.length - 1) : url.path.substring(1, url.path.length)
      let urlPathname = (url.pathname[url.pathname.length - 1] === '/') ? url.pathname.substring(1, url.pathname.length - 1) : url.pathname.substring(1, url.pathname.length)
      //
      // look for the target/redirect it will push to
      //
      let result = this.findTarget(template,urlPathname)
      // 
      // Couldnt find a target
      //
      if (!result.template.target && !result.template.redirect && !result.template.content) return Promise.reject('No Target/Redirect/Content') 
      //
      // replace the target with template vars 
      //
      return Promise.resolve(this.applyTemplate(fullUrlPath, result.path, result.vars, result.template, headers))
  }

  findTarget (host, path) {
    let thePath = path.split('/')
    let currentHost = Object.assign({}, host)
    let vars = {}
    let currentPathIndex = 0
    let listTargets = []
    let currentPath = []
    if (currentHost.target || currentHost.redirect || currentHost.content)
        listTargets.push({template:currentHost, path:currentPath})
    //
    // iterate through the path to get the target
    //
    for (let l = thePath.length; currentPathIndex < l; currentPathIndex++ ) {
      //
      // if no routes end
      //
        if (!isObject(currentHost.routes)) break
      //
      // set current 
      //
      let segment = thePath[currentPathIndex]
      let segHost = currentHost.routes[segment]
      //
      // if no route host then end 
      //
      if (!isObject(segHost)) {
        let key = null
        for (let k in currentHost.routes) {
          if (k[0] === '{') {
            key = k
            break
          }
        }
        if (!key) break
        segHost = currentHost.routes[key]
        vars[key.substring(1, key.length - 1)] = segment
      }
      //
      // set the next host to be currenthost 
      //
      currentHost = segHost
      //
      // if no target then go to the next
      //
      if (!segHost.target && !segHost.redirect && !segHost.content) continue 
      //
      // add the level path your at
      //
      currentPath.push(segment)
      //
      //  add as possible targets
      //
      listTargets.push({template:segHost,path:[].concat(currentPath)})
    }

    if (!listTargets.length) return {template:{}}
    //
    //  get the last valid target 
    //
    let lastEl = listTargets.pop()
    return { vars, 
      template: lastEl.template,
      path: lastEl.path  
    }
  }

  applyTemplate (fullPath, currentPath, vars, template, headers) {
    if (process.env.DEBUG) {
      console.log('DEBUG :: applyTemplate:pre : ', vars, template, currentPath, headers)
    }
    template = template || {}
    template = {
      'target': template.target || "",
      'redirect': template.redirect,
      'content': template.content,
      'statusCode': template.statusCode,
      'changeHost': template.changeHost
    }
    //
    // if content just return don't care about url replacing
    //
    if(template.content) return Promise.resolve(template)
    //
    // set base to 
    //
    let base = template.target
    let path = currentPath.join('/')
    if (base.substring(base.length - 4, base.length) === '/[~]') {
      //
      //  remove suffix and add just the path that wasnt used in findtarget
      //  EX: exmaple.com/images/a.jpg -> http://image/[~] = http://image/a.jpg
      //
      base = base.substring(0, base.length - 4)
      let url = Url.parse(base)
      base = Url.resolve(base, Path.join(url.path, fullPath.replace(path, '')))
    } else if (base.substring(base.length - 4, base.length) === '/[*]') {
      //
      //  remove suffix and add the whole path as is
      //  EX: exmaple.com/images/a.jpg -> http://image/[*] = http://image/images/a.jpg
      //
      base = base.substring(0, base.length - 4)
      base = Url.resolve(base, fullPath)

    }
    //
    // fill in the variables from template
    //
    for (let key in vars)
      base = base.replace('%7B' + key + '%7D', vars[key]).replace('{' + key + '}', vars[key])
    //
    // reset the changes to url back to target
    //
    template.target = base
    let url = Url.parse(base)
    //
    // if there is . in hostname then exit now with that target
    //
    if (url.hostname.indexOf('.') > -1) return Promise.resolve(template)
    //
    // Check if there is a pass through token that ignores publish arr
    //
    let hybridPass = isObject(headers) ? Object.keys(this.tokens).filter(key => this.tokens[key] === headers['x-lsq']) : false
    let hybridHost = isObject(headers) ? headers['x-lsq-host'] : false
    //
    // if pass through then do a direct mapping of org path to target path; ignore template 
    //
    if (hybridHost && hybridPass) return Promise.resolve({'target': Url.resolve(hybridHost, fullPath)})
    //
    // checks to see if it is in the publish arr otherwise deny
    //
    if (this.publish.indexOf(url.hostname) === -1 && !hybridPass) {
      return Promise.reject('Not Allowed')
    }
    //
    // allow for redirect replace url like target
    //

    if (process.env.DEBUG) {
      console.log('DEBUG :: applyTemplate : ', template)
    }
    return Promise.resolve(template)
  }

}

function isObject(a) {
  return typeof a === 'object'
}
module.exports = new Routes()
