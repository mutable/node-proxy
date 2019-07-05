# Mutable Proxy

- Installation
- Usage
- Configuration
  - Hosts
    - Custom IP Addresses
  - Token
  - Publish
  - Page 404
  - Example
- Environment
- License

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

### Hosts

This is the list of hosts and the routes that map to a service.

- You can use `[~]` at the end for adding the rest of the path to your path.

**Example**

`http://lsq/health/helloworld` of `http://health/[~]` becomes `http://health/helloworld`

- You can use `[*]` at the end to add all the original path on top.

**Example**

`http://lsq/health/helloworld` of `http://health/[*]` becomes `http://health/health/helloworld`

- You can surround a varible with {} so it can be used as a wildcard and used in the template of the domain.

**Example**

`http://lsq/v2/users/pelle/uploads` of `http://upload/user/{userid}` becomes `http://upload/user/pelle`

The stucture is:

```json
{
  // the url it is pointing to it can contain a service which it will be replaced with real host
  "target": "http://example/",
  // it will do a 302 redirect to target
  "redirect": true,
  // it will replace the headers.host to the target host so other proxies know how to route
  "changeHost":true,
  // if there is a sub path you want to direct recursively
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

#### Custom IP Addresses as Host
This is useful for local development when you want to use external devices to access local development API endpoints.

This is done by specifying a custom host IP address as the 'MYIP' env variable and adding the IP to the Service Configuration.

**Example**

`MYIP` as the env name and `192.168.1.123`

```json
{
  "hosts": {
    "mutable.local": {  },
    "192.168.1.123": {  } // new
  },
  "token": {  },
  "publish": [  ],
  "page404": "<html>  </html>"
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

There's only one environment variable, `DEBUG`, which can be set to `true` to turn on debug mode and recieve debug logs in the console.

## License

Copyright (c) Mutable Inc. All rights reserved.

Licensed under the [MIT](./LICENSE) license.
