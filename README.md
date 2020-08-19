# Mutable Proxy

- [Installation](#installation)
- [Usage](#usage)
- [Migrating from v1.x](#migrating-from-v1.x)
- [Configuration](#configuration)
  - [Hosts](#hosts)
  - [Token](#token)
  - [Publish](#publish)
  - [Page 404](#page-404)
  - [Example](#example)
- [Environment](#environment)
  - [Debug Mode](#debug-mode)
  - [Custom IP Addresses as Host](#custom-ip-addresses-as-host)
- [License](#license)

## Installation

```shell
$ npm install @mutable/proxy
```

## Usage

```javascript
const { Proxy } = require('@mutable/proxy');
const config = { /* your config object */ };
const proxy = new Proxy(config);
const newConfig = { /* your new config object */ };
proxy.updateConfig(newConfig);
```

## Migrating from `v1.x`

Being a major release, `v2.0` has inconsistencies with `v1.x` that would require
rewriting your application code. Here's a set of brief instructions that would
help you successfully migrate from `v1.x` to `v2.0`:

1. **Clean-up the directory**
When using `v1.x`, it was recommended to clone the git directory directly into
your project. Since the proxy lives inside an npm module now, you can cleanup
any source files relating to the proxy (example: `src/proxy.js` and `src/routes.js`),
keeping only files relevant to the project (example: `src/app.js`).

2. **Add the new module to your dependencies and import it**
Add the module to your dependencies in your `package.json` by running `npm
install @mutable/proxy` and import the module into your project. If you're using
CommonJS imports, you can write `const { Proxy } = require('@mutable/proxy')` or `import { Proxy } from '@mutable/proxy'` if you're using something like Babel or
TypeScript that transpile ES Modules to CommonJS.

3. **Update your usage**
There have been a couple of changes to the external APIs which would require you
to change the way you use these APIs in your code.
    1. We do not expose `Routes` anymore, please remove all references to routes
    in your codebase. Updating the configuration of `Proxy` would update the
    corresponding routes' configuration, so you can still do whatever you used
    to do earlier. In case you do something which requires a direct reference to
    the `Routes` class which isn't permitted by the current model, please let us
    know on the issue tracker.
    2. The `constructor` now accepts initial configuration. This means you do not
    need to construct a new `Proxy` and immediately call `updateConfig` since you
    can now pass the initial config object directly into the constructor.
    3. Instead of exporting instances of `Proxy` and `Routes`, we export the
    classes themselves. This means you will have to instantiate your own instances.

4. **Clean-up your `package.json`**
At this point, your `package.json` (which happened to be a replica of the file
in the repository) would have a lot of unneeded stuff, including but not limited
to, unused dependencies. You are recommended to clean it up appropriately (by
using commands such as `npm uninstall`).

An example application before and after the migration might look something like:

```javascript
// BEFORE
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

// AFTER
const Meta = require('@mutable/meta')
const { Proxy } = require('@mutable/proxy')

Meta.config()
  .then(config => {
    const proxy = new Proxy(config);
    Meta.on('configChange', c => proxy.updateConfig(c))
  })
  .catch(e => {throw e})
```

## Configuration

The config object may contain the following keys to specify the behavior of the proxy:

- `hosts`
- `token`
- `publish`
- `page404`

### Hosts (`Object`)

This is the list of hosts and the routes that map to a service.

#### Structure

- `target` (`string`) The URL it is pointing to. It can contain a service which
will be replaced with real host.
- `redirect` (`boolean`) It will do a 302 redirect to the target.
- `changeHost` (`boolean`) It will replace the `headers.host` to the target host
so other proxies know how to route.
- `routes` (`Object`) If there is a sub path you want to direct recursively.
- `forceHttps` (`boolean`) It will do a 301 redirect to https, defaults to false.

A simple example usage would be along the lines of:

```json
{
  "target": "http://google.com",
  "redirect": true,
  "changeHost": true,
  "forceHttps": true
}
```

Further, you can use the following rules for more advanced configuration.

#### Rules

- You can use `[~]` at the end for adding the rest of the path to your path.
**Example** `http://todo/health/helloworld` of `http://health/[~]` becomes
`http://health/helloworld`

- You can use `[*]` at the end to add all the original path on top.
**Example** `http://todo/health/helloworld` of `http://health/[*]` becomes
`http://health/health/helloworld`

- You can surround a varible with {} so it can be used as a wildcard and used in
the template of the domain.
**Example** `http://todo/v2/users/pelle/uploads` of `http://upload/user/{userid}`
becomes `http://upload/user/pelle`

An advanced example usage using the above rules would be along the lines of:

```json
{
  "target": "http://example/",
  "redirect": true,
  "changeHost": true,
  "forceHttps": false,
  "routes":{
    "v1":{
      "target": "http://example-1.com/[~]",
      "routes":{
        "{company}":{
          "target": "http://company/{company}"
        }
      }
    }
  }
}
```


### Tokens (`{[index: string]: string}`)

Use these to go through to unpublished services.

In the headers, you can just add a `"x-mut"` with one of the tokens and you can proxy to the service.
**Example** `"x-mut: 1234567890"`

Also you can use `"x-mut-host"` with a token to proxy to any host or service.
**Example** `"x-mut-host: http://health/"` will take that host and append the
full path after

### Publish (`string[]`)

It is a white list of services that can be reached by the outside world with no
protection like a firewall. You can use tokens to override it and access the
service anyway.

### Page 404 (`string`)

When specified, these would be the contents of your custom 404 page.

### Example

A sample complete configurations object would look something like this:

```json
{
  "hosts": {
    "mutable.local": {
      "target": "http://www/[~]",
      "routes": {
        "health": {
          "target": "http://health/[~]"
        },
        "v2":{
          "target": "http://www-2/[*]",
          "routes": {
            "status": {
              "target": "http://status.aws.amazon.com",
              "redirect": true,
            },
            "users": {
              "target": "http://user.com/[~]",
              "routes": {
                "{userid}": {
                  "routes": {
                    "upload": {
                      "target": "http://upload/user/{userid}"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "token":{
    "pelle": "1234567890"
  },
  "publish": [
    "www",
    "health",
    "upload",
    "email",
    "corbis"
  ],
  "page404": "<html><head><style>h1{margin: auto; position: absolute; top: 0; left: 0; right: 0; bottom: 0; height: 100px; font-family: 'arial'; font-weight: 100; color: #555; text-align: center; }body{background:#000;}</style></head><body><h1>404 Not Found</h1></body></html>"
}
```

## Environment

### Debug Mode

In order to turn on debug mode, set `DEBUG` environment variable to `true`.

### Custom IP Addresses as Host

This is useful for local development when you want to use external devices to
access local development API endpoints.

This is done by specifying a custom host IP address as the `MYIP` env variable
and adding the IP to the Service Configuration.

#### Example

`MYIP` as the env name and `192.168.1.123`

```json
{
  "hosts": {
    "mutable.local": {  },
    "192.168.1.123": {  }
  },
  "token": {  },
  "publish": [  ],
  "page404": "<html>  </html>"
}
```

## License

Copyright (c) Mutable Inc. All rights reserved.

Licensed under the [MIT](./LICENSE) license.
