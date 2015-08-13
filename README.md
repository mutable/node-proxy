Node Proxy
===

- Config

Config
---

Go to the config tab and set it with 
You must white list every service you want to access to the outside world think of it like a firewall all outside traffic comes through here

```json
{

  "hosts": {
    "lsq": {
      "target": "http://www/[~]",
      "routes": {
        "health": {
          "target": "http://health/[~]"
        },
        "v2":{
          "target": "http://www-2/[*]",
          "routes": {
            "status": {
              "target": "http://status.aws.amazon.com"
              "redirect": true,
            }
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




Hosts
---
- the list of hosts and the routes that map to a service 
- use [~] at the end for adding the rest of the path to your path 
  - example: http://lsq/health/helloworld of http://health/[~] becomes http://health/helloworld
- use [*] at the end to add all the original path on top
  - example: http://lsq/health/helloworld of http://health/[*] becomes http://health/health/helloworld
- surround a varible with {} so it can be used as a wildcard and used in the template of the domain
  - example: http://lsq/v2/users/pelle/uploads of http://upload/user/{userid} becomes http://upload/user/pelle
- the stucture is 
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
      "target": "http://example-1.com/[~]"
      "routes":{
        "{company}":{
          "target": "http://company/{company}"
        }
      }
    }
  }
}
```

Tokens
---
use to go through to unpublished services 
in the Headers you just add a "x-lsq" with one of the tokens and you can proxy to the service
example: "x-lsq: 1234567890" 
Also you can use "x-lsq-host" with a token to proxy to any host or service 
example: "x-lsq-host: http://health/" will take that host and append the full path after
  
Publish
---
Is a white list of services that can be reached by the outside world with no protection like a firewall
you can use tokens to override it and access the service anyway, this an easy auth

Page404
---
Is a custom 404 page that you can customize how you would like there is a default so you dont need to put one.

  
