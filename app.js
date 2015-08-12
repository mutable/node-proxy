var   path		= require('path')
	, http 		= require('http')
	, Promise	= require('promise')
	, httpProxy = require('http-proxy')
	, consul 	= require('lsq-consul')({ host: process.env.CONSUL_HOST, port: process.env.CONSUL_PORT })
	, lsq		= require('lsq')
	, tooBusy 	= require('toobusy-js')
	, Url 		= require('url')
	, _ 		= require('underscore')
	, proxy 	= httpProxy.createProxyServer({ws: true,xfwd:true})
	, baseUrl 	= process.env.BASEURL || ""
	, list 		= {}
	, config 	= {}
	, myHost 	= {}
	, serverHttp

if(process.env.MYHOST)
	myHost.hostname = process.env.MYHOST

updateList()
startProxy()

function getServices(){
	if (process.env.DEBUG == "true")
		console.log("getserv",process.env.PORT)
	return new Promise(function (resolve,reject) {
		if (process.env.DEBUG == "true")
			console.log("get serv",process.env.SERVICE_NAME)
		lsq.services.get(process.env.SERVICE_NAME)
		.then(function(service){
			if(_.isObject(service))
				myHost = service
			else
				console.log("service not a object",service) 
			if (process.env.DEBUG == "true")
				console.log("get service",myHost)
		},reject)
		.then(lsq.services.list)
  		.then(function(services){
  			if (process.env.DEBUG == "true")
				console.log("get services",services)
  			resolve()
  		},reject)
	})
}

function updateList(){
	var watcher = consul.watch(consul.kv.get, { key: process.env.SERVICE_NAME })
	watcher.on('change', function(result) {
		 try {
			if (!result)
			throw new Error('configuration not present')
			config = JSON.parse(result.Value)
			list = config.list
		}
		catch (e) { 
			return list = {}
		}
	})
	watcher.on('error', function(err) {
	  console.log('error:', err)
	})
}

function checkRoutes(req,res){
	var theUrlis = Url.parse('http://' + req.headers.host + req.url)
	switch(theUrlis.pathname){
		case "/health":
			healthCheck(req,res)
			break;
		default:
			sendWeb(res,list.page404 || "404",404)
	}
}



function healthCheck(req,res) {
	res.end(tooBusy.lag()+"")
}

function startProxy(){
	getServices()
	.then(function(){
		theProxy()
	},function(){
		theProxy()
		setTimeout(function(){ getServices() },60*1000*5)
	})	
}

function theProxy(){
	var options = {
			enable : { xforward: true }
		 }
		if (process.env.DEBUG == "true")
			console.log("start proxy")
		
		serverHttp = http.createServer(function(req,res){
			var host = req.headers.host || ""
			host = host.toLowerCase()
			var theUrlis = Url.parse('http://' + host + req.url)
			host = theUrlis.hostname
			
			
			var hostForList = (list 
				&& _.isObject(list.router) 
				&& _.has(list.router,host)) 
				? list.router[host] 
				: theUrlis.hostname.replace(baseUrl,"")
			if (process.env.DEBUG == "true")
				console.log("hostForList",hostForList)

			if( hostForList == baseUrl.substring(1)
				|| hostForList == myHost.hostname 
				|| hostForList == process.env.SERVICE_NAME
				|| hostForList == "") return checkRoutes(req,res)
			
			if (process.env.DEBUG == "true")
				console.log("host not the proxy")

			if(list && _.isArray(list.publish) && _.indexOf(list.publish,hostForList) == -1) return sendWeb(res,list.page404 || "404",404)

			
			lsq.services.get(hostForList)
			.then(function(service){
				console.log("the service",service)
				if(!_.isObject(service)) return sendWeb(res,list.page404 || "404",404)
				proxyWeb(req,res,{ target: 'http://'+service })
			})
		})
		serverHttp.on('upgrade', function (req, socket, head) {
			var host = req.headers.host || ""
			host = host.toLowerCase()
			var theUrlis = Url.parse('http://' + host + req.url)
			host = theUrlis.hostname
			var hostForList = (list 
				&& _.isObject(list.router) 
				&& _.has(list.router,host)) 
				? list.router[host] 
				: theUrlis.hostname.replace(baseUrl,"")
			if( hostForList == baseUrl.substring(1)
				|| hostForList == myHost.hostname 
				|| hostForList == process.env.SERVICE_NAME
				|| hostForList == "") return checkRoutes(req,res)
			
			if(list && _.isArray(list.publish) && _.indexOf(list.publish,hostForList) == -1) return sendWeb(res,list.page404 || "404",404)

			lsq.services.get(hostForList)
			.then(function(service){
				if(!_.isObject(service)) return sendWeb(res,list.page404 || "404",404)
				proxyWs(req,socket,head,{ target: 'http://'+service })
			})
		})
		serverHttp.listen(process.env.PORT  || 80)
		console.log("listen on port "+ (process.env.PORT  || 80))
		return serverHttp
}
function sendWeb(res,content,code){
	if(!res.headersSent){
		if(_.isNumber(code))
			res.writeHead(code)
		res.end(content)
	}
}

function proxyWs(req,socket,head,opt,cb){
	req.headers.host = req.headers.host || ""
	try {
		proxy.ws(req, socket,head, opt,function(err,d){
			if (err && err.code){
				if(err.code == "ECONNREFUSED" && _.isFunction(cb))
					cb()
			}
		})
	}catch(e){
	}
}

function proxyWeb(req,res,opt,cb){
	var error = false;
	req.headers.host = req.headers.host || ""

	try {
		res.headers = {'x-forwarded-for': req.connection.remoteAddress}
		proxy.web(req, res, opt,function(err,d){
			if (err && err.code){
				if(err.code == "ECONNREFUSED" && _.isFunction(cb))
					cb();
				else if(!error){
					sendWeb(res,list.page404 || "404",404)
				}	
			}
		});
	}catch(e){
		error = true
		sendWeb(res,list.page404 || "404",404)
	}
}
