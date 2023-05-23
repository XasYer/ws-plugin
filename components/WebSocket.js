import WebSocket, { WebSocketServer } from 'ws'
import Config from './Config.js'
import { lifecycle, heartbeat } from '../model/index.js'
import { getApiData } from '../model/index.js'

let sockets = []

function createWebSocket(servers) {
    servers.forEach((item) => {
        if (!item.address == 'ws_address') {
            if (item.type == 1) {
                let socket = new WebSocket(item.address, {
                    headers: {
                        'X-Self-ID': Bot.uin,
                        'Content-Type': 'application/json'
                    }
                });
                socket.type = item.type
                socket.name = item.name
                let timer = null
                socket.onopen = async (event) => {
                    logger.mark(`${item.name}已连接`);

                    lifecycle(socket)
                    sockets.push(socket)
                    if (Config.heartbeat.interval > 0) {
                        timer = setInterval(async () => {
                            heartbeat(socket)
                        }, Config.heartbeat.interval * 1000)
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
                    logger.warn(`${item.name}连接已关闭`);
                    // if (sendMaster) {
                    //     Bot.pickFriend(cfg.masterQQ[0]).sendMsg(`${item.name}已断开连接`)
                    // }
                    clearInterval(timer)
                    sockets = sockets.filter(function (s) {
                        return s.name !== socket.name;
                    });

                    console.log(`3秒后尝试重新连接`);
                    setTimeout(function () {
                        let newSocket = new WebSocket(item.address, {
                            headers: {
                                'X-Self-ID': Bot.uin,
                                'Content-Type': 'application/json'
                            }
                        });
                        newSocket.type = item.type;
                        newSocket.name = item.name;
                        newSocket.onmessage = socket.onmessage;
                        newSocket.onclose = socket.onclose;
                        newSocket.onerror = socket.onerror
                        newSocket.onopen = socket.onopen;
                    }, 3000);
                };

                socket.onerror = async (event) => {
                    logger.error(`${item.name}连接失败\n${event.error}`);
                };

            } else if (item.type == 2) {
                try {
                    var parts = wsObj.address.split(':');
                    var host = parts[0];
                    var port = parts[1];
                    let server = new WebSocketServer({ port, host });
                    server.on('listening', () => {
                        logger.mark(`ws服务器已启动并监听 ${item.host}:${item.port}`);
                    });
                    server.on('connection', async function (socket) {
                        socket.type = item.type
                        logger.mark(`新的客户端连接,连接端口为${item.port}`);
                        lifecycle(socket)
                        sockets.push(socket);

                        socket.on('close', function () {
                            logger.warn(`客户端断开连接,端口为${item.port}`);
                            let index = sockets.indexOf(socket);
                            if (index !== -1) {
                                sockets.splice(index, 1);
                            }
                        })
                        socket.on('message', async (event) => {
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
                        });
                    })
                    server.on('error', async function (event) {
                        logger.error(event.error);
                    })
                } catch (err) {
                    logger.error('服务器启动失败:', err);
                }
            } else if (item.type == 3) {
                let socket = new WebSocket(item.address);
                socket.onopen = (event) => {
                    logger.mark(`${item.name}已连接`);
                    sockets.push({ socket, item })
                };
                socket.onclose = (event) => {
                    logger.warn(`${item.name}连接已关闭`);
                    clearInterval(timer)
                    sockets = sockets.filter(function (s) {
                        return s.name !== socket.name;
                    });
                    console.log(`3秒后尝试重新连接`);
                    setTimeout(function () {
                        let newSocket = new WebSocket(item.address, {
                            headers: {
                                'X-Self-ID': Bot.uin,
                                'Content-Type': 'application/json'
                            }
                        });
                        newSocket.type = item.type;
                        newSocket.name = item.name;
                        newSocket.onmessage = socket.onmessage;
                        newSocket.onclose = socket.onclose;
                        newSocket.onerror = socket.onerror
                        newSocket.onopen = socket.onopen;
                    }, 3000);
                };
                socket.onmessage = async (event) => {
                    const decoder = new TextDecoder();
                    let data = decoder.decode(event.data);
                    data = JSON.parse(data)
                    let msg = data.content
                    console.log(data);
                    if (msg[0].type.startsWith('log')) {
                        logger.mark(msg[0].data);
                    } else {
                        let sendMsg = []
                        let target = data.target_type == 'group' ? 'pickGroup' : 'pickFriend'
                        for (let k = 0; k < msg.length; k++) {
                            if (msg[k].type == 'image') {
                                sendMsg.push(segment.image(msg[k].data))
                            } else if (msg[k].type == 'text') {
                                sendMsg.push(msg[k].data)
                            } else if (msg[k].type == 'node') {
                                for (let i = 0; i < msg[k].data.length; i++) {
                                    let _sendMsg
                                    if (msg[k].data[i].type == 'text') {
                                        _sendMsg = msg[k].data[i].data
                                    } else if (msg[k].data[i].type == 'image') {
                                        _sendMsg = segment.image(msg[k].data[i].data)
                                    }
                                    sendMsg.push({
                                        message: [
                                            _sendMsg
                                        ],
                                        nickname: '小助手',
                                        user_id: 2854196310
                                    })
                                }
                                sendMsg = await Bot[target](data.target_id).makeForwardMsg(sendMsg)
                            }
                        }
                        let sendRet = await Bot[target](data.target_id).sendMsg(sendMsg)
                    }
                }
                socket.onerror = (event) => {
                    logger.error(event);
                    logger.error(`${item.name}连接失败`);
                };
            }
        }
    })
    return sockets
}

function closeWebSocket(sockets) {
    sockets.forEach(function (socket) {
        socket.close();
    });
}

export {
    createWebSocket,
    closeWebSocket,
    sockets
}

