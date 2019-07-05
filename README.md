# Mutable Proxy

- [Installation](#installation)
- [Usage](#usage)
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

## Configuration

The config object may contain the following keys to specify the behavior of the proxy:

- `hosts`
- `token`
- `publish`
- `page404`

### Hosts (`Object`)

This is the list of hosts and the routes that map to a service.

- You can use `[~]` at the end for adding the rest of the path to your path.

**Example**

`http://todo/health/helloworld` of `http://health/[~]` becomes `http://health/helloworld`

- You can use `[*]` at the end to add all the original path on top.

**Example**

`http://todo/health/helloworld` of `http://health/[*]` becomes `http://health/health/helloworld`

- You can surround a varible with {} so it can be used as a wildcard and used in the template of the domain.

**Example**

`http://todo/v2/users/pelle/uploads` of `http://upload/user/{userid}` becomes `http://upload/user/pelle`

The stucture is:

- `target` (`string`) The URL it is pointing to. It can contain a service which will be replaced with real host.
- `redirect` (`boolean`) It will do a 302 redirect to the target.
- `changeHost` (`boolean`) It will replace the `headers.host` to the target host so other proxies know how to route.
- `routes` (`Object`) If there is a sub path you want to direct recursively.

Here's a sample:

```json
{
  "target": "http://example/",
  "redirect": true,
  "changeHost":true,
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

Use these to go through to unpublished services. In the headers, you can just add a `"x-mut"` with one of the tokens and you can proxy to the service.

**Example**

`x-mut: 1234567890`

Also you can use `"x-mut-host"` with a token to proxy to any host or service.

**Example**

`"x-mut-host: http://health/"` will take that host and append the full path after

### Publish (`string[]`)

It is a white list of services that can be reached by the outside world with no protection like a firewall you can use tokens to override it and access the service anyway.

### Page 404 (`string`)

When specified, these would be the contents of your 404 page.

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

This is useful for local development when you want to use external devices to access local development API endpoints.

This is done by specifying a custom host IP address as the 'MYIP' env variable and adding the IP to the Service Configuration.

**Example**

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
