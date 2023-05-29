import WebSocket, { WebSocketServer } from 'ws'
import Config from './Config.js'
import { lifecycle, heartbeat } from '../model/index.js'
import { getApiData, makeGSUidSendMsg } from '../model/index.js'

let socketList = []
let serverList = []

function createWebSocket({ name, address, type, reconnectInterval, maxReconnectAttempts, close }, reconnectCount = 1, isInit = true) {
    if (address != 'ws_address') {
        if (close) {
            return
        }
        if (type == 1) {
            let socket = new WebSocket(address, {
                headers: {
                    'X-Self-ID': Bot.uin,
                    'Content-Type': 'application/json'
                }
            });
            socket.type = type
            socket.name = name
            socket.onopen = async (event) => {
                logger.mark(`${name}已连接`);
                if (!isInit && Config.reconnectToMaster) {
                    Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${name}重连成功~`)
                } else if (isInit && Config.firstconnectToMaster) {
                    let sendRet = null
                    //延迟5s发送
                    let sendTimer = setInterval(async () => {
                        sendRet = await Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${name}连接成功~`)
                        if (sendRet) {
                            clearInterval(sendTimer)
                        }
                    }, 5000)
                }
                reconnectCount = 1
                lifecycle(socket)
                socketList.push(socket)
                if (Config.heartbeatInterval > 0) {
                    socket.timer = setInterval(async () => {
                        heartbeat(socket)
                    }, Config.heartbeatInterval * 1000)
                }
            };
            socket.onmessage = async (event) => {
                let data = event.data;
                data = JSON.parse(data);
                let ResponseData = await getApiData(data.action, data.params);
                let ret = {
                    status: 'ok',
                    retcode: 0,
                    data: ResponseData,
                    echo: data.echo
                };
                socket.send(JSON.stringify(ret));
            };

            socket.onclose = async (event) => {
                logger.warn(`${name}连接已关闭`);
                clearInterval(socket.timer)
                socketList = socketList.filter(function (s) {
                    return s.name !== socket.name;
                });
                if (!isInit && Config.disconnectToMaster && reconnectCount <= 1) {
                    Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${name}已断开连接`)
                } else if (isInit && Config.firstconnectToMaster && reconnectCount <= 1) {
                    let sendRet = null
                    //延迟5s发送
                    let sendTimer = setInterval(async () => {
                        sendRet = await Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${name}连接失败...`)
                        if (sendRet) {
                            clearInterval(sendTimer)
                        }
                    }, 5000)
                }
                if ((reconnectCount < maxReconnectAttempts) || maxReconnectAttempts <= 0) {
                    logger.warn('开始尝试重新连接第' + reconnectCount + '次');
                    setTimeout(() => {
                        createWebSocket({ name, address, type, reconnectInterval, maxReconnectAttempts, close }, reconnectCount + 1, false); // 重新连接服务器
                    }, reconnectInterval * 1000);
                } else {
                    logger.warn('达到最大重连次数,停止重连');
                }
            };

            socket.onerror = async (event) => {
                logger.error(`${name}连接失败\n${event.error}`);
            };

        }
        else if (type == 2) {
            var parts = address.split(':');
            var host = parts[0];
            var port = parts[1];
            let server = new WebSocketServer({ port, host });
            server.type = type
            server.name = name
            server.on('listening', () => {
                logger.mark(`ws服务器已启动并监听 ${host}:${port}`);
                serverList.push(server)
            });
            server.on('connection', async function (socket) {
                socket.type = type
                socket.name = name
                logger.mark(`新的客户端连接,连接端口为${port}`);
                lifecycle(socket)
                if (Config.heartbeatInterval > 0) {
                    socket.timer = setInterval(async () => {
                        heartbeat(socket)
                    }, Config.heartbeatInterval * 1000)
                }
                socket.on('close', function () {
                    logger.warn(`客户端断开连接,端口为${port}`);
                    socketList = socketList.filter(function (s) {
                        return s.name !== socket.name;
                    });
                    clearInterval(socket.timer)
                })
                socket.on('message', async (event) => {
                    let data = null
                    if (Buffer.isBuffer(event)) {
                        data = JSON.parse(event.toString())
                    } else {
                        data = JSON.parse(event.data);
                    }
                    let ResponseData = await getApiData(data.action, data.params);
                    let ret = {
                        status: 'ok',
                        retcode: 0,
                        data: ResponseData,
                        echo: data.echo
                    };
                    socket.send(JSON.stringify(ret));
                });
                socketList.push(socket);
            })
            server.on('error', async function (error) {
                logger.error(`${address}启动失败,请检查地址是否填写正确,或者端口是否占用\n${error}`);
            })
            server.on('close', async function (error) {
                logger.error(`${address}已关闭`);
                let oldServerList = socketList.filter(item => item.type == 2);
                serverList = serverList.filter(function (s) {
                    return s.name != server.name;
                });
            })
        }
        else if (type == 3) {
            let socket = new WebSocket(address);
            socket.type = type
            socket.name = name
            socket.onopen = (event) => {
                logger.mark(`${name}已连接`);
                if (!isInit && Config.reconnectToMaster) {
                    Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${name}重连成功~`)
                } else if (isInit && Config.firstconnectToMaster) {
                    let sendRet = null
                    //延迟5s发送
                    let sendTimer = setInterval(async () => {
                        sendRet = await Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${name}连接成功~`)
                        if (sendRet) {
                            clearInterval(sendTimer)
                        }
                    }, 5000)
                }
                socketList.push(socket)
                if (!isInit && Config.reconnectToMaster) {
                    Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${name}重连成功~`)
                }
            };
            socket.onclose = (event) => {
                logger.warn(`${name}连接已关闭`);
                socketList = socketList.filter(function (s) {
                    return s.name !== socket.name;
                });
                if (!isInit && Config.disconnectToMaster && reconnectCount <= 1) {
                    Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${name}已断开连接`)
                } else if (isInit && Config.firstconnectToMaster && reconnectCount <= 1) {
                    let sendRet = null
                    //延迟5s发送
                    let sendTimer = setInterval(async () => {
                        sendRet = await Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${name}连接失败...`)
                        if (sendRet) {
                            clearInterval(sendTimer)
                        }
                    }, 5000)
                }
                if ((reconnectCount < maxReconnectAttempts) || maxReconnectAttempts <= 0) {
                    logger.warn('开始尝试重新连接第' + reconnectCount + '次');
                    setTimeout(() => {
                        createWebSocket({ name, address, type, reconnectInterval, maxReconnectAttempts }, reconnectCount + 1, false); // 重新连接服务器
                    }, reconnectInterval * 1000);
                } else {
                    logger.warn('达到最大重连次数,停止重连');
                }
            };
            socket.onmessage = async (event) => {
                const decoder = new TextDecoder();
                let data = decoder.decode(event.data);
                data = JSON.parse(data)
                await makeGSUidSendMsg(data)
            }
            socket.onerror = (event) => {
                logger.error(`${name}连接失败\n${event.error}`);
            };
        }
    }
}

function modifyWebSocket(servers, reconnectCount = 1, isInit = true) {
    let newServers = servers.filter(item => !item.hasOwnProperty('close') || !item.close);
    let newSocket = newServers.filter(item => item.type == 1 || item.type == 3)
    let newServer = newServers.filter(item => item.type == 2)
    let oldSocketList = socketList.filter(item => item.type == 1 || item.type == 3);

    //增加1或3
    if (newSocket.length > oldSocketList.length) {
        let result = newSocket.filter(item1 => !oldSocketList.find(item2 => item2.name === item1.name));
        if (result.length > 0) {
            result.forEach(item => {
                createWebSocket(item)
            })
        }
    }
    //减少1或3
    else if (newSocket.length < oldSocketList.length) {
        oldSocketList.reduce((acc, item1, index) => {
            if (!newSocket.find(item2 => item2.name === item1.name)) {
                item1.onclose = () => {
                    if (Config.disconnectToMaster) {
                        Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${item1.name}已断开连接`)
                    }
                    logger.warn(`${item1.name}连接已关闭`);
                    clearInterval(item1.timer)
                    socketList = socketList.filter(function (s) {
                        return s.name !== item1.name;
                    });
                }
                item1.close()
            }
            return acc;
        }, []);
    }

    //增加2
    if (newServer.length > serverList.length) {
        let result = newServer.filter(item1 => !serverList.find(item2 => item2.name === item1.name));
        if (result.length > 0) {
            result.forEach(item => {
                createWebSocket(item)
            })
        }
    } else if (newServer.length < serverList.length) {
        const oldServers = socketList.filter(socket => !newServers.some(server => server.name === socket.name && server.type === socket.type));
        oldServers.forEach(item => item.close())
        serverList.reduce((acc, item1, index) => {
            if (!newServer.find(item2 => item2.name === item1.name)) {
                item1.close();
            }
            return acc;
        }, []);
    }
}


function initWebSocket(servers, reconnectCount = 1, isInit = true) {
    if (!servers) {
        return
    }
    servers.forEach(item => {
        createWebSocket(item, reconnectCount, isInit)
    })
}


function closeWebSocket(socketList, serverList = '') {
    socketList.forEach(function (socket) {
        socket.close();
    });
    if (serverList) {
        serverList.forEach(function (server) {
            server.close()
        })
    }
}

function clearWebSocket() {
    socketList.forEach(socket => {
        socket.onclose = () => {
            if (Config.disconnectToMaster) {
                Bot.pickFriend(Config.masterQQ[0]).sendMsg(`${item1.name}已断开连接`)
            }
            clearInterval(socket.timer)
            socketList = socketList.filter(function (s) {
                return s.name !== socket.name;
            });
        }
    })
    serverList.forEach(server => {
        server.on('close', async function (error) {
            serverList = serverList.filter(function (s) {
                return s.name !== server.name;
            });
        })
    })
    closeWebSocket(socketList, serverList)
}

export {
    initWebSocket,
    clearWebSocket,
    modifyWebSocket,
    socketList,
    serverList
}

