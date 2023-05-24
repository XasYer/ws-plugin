import WebSocket, { WebSocketServer } from 'ws'
import Config from './Config.js'
import { lifecycle, heartbeat } from '../model/index.js'
import { getApiData } from '../model/index.js'

let socketList = []
let serverList = []
let timerList = []

function createWebSocket(servers) {
    if (!servers) {
        return
    }
    servers.forEach((item) => {
        if (item.address != 'ws_address') {
            if (item.type == 1) {
                let socket = new WebSocket(item.address, {
                    headers: {
                        'X-Self-ID': Bot.uin,
                        'Content-Type': 'application/json'
                    }
                });
                socket.type = item.type
                socket.name = item.name
                socket.reconnectAttempts = 0
                let timer = null
                socket.onopen = async (event) => {
                    logger.mark(`${item.name}已连接`);
                    socket.reconnectAttempts = 0
                    lifecycle(socket)
                    socketList.push(socket)
                    if (Config.heartbeat.interval > 0) {
                        timer = setInterval(async () => {
                            heartbeat(socket)
                        }, Config.heartbeat.interval * 1000)
                        timerList.push(timer)
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
                    clearInterval(timer)
                    socketList = socketList.filter(function (s) {
                        return s.name !== socket.name;
                    });

                    // if (item.reconnectInterval > 0) {
                    //     logger.warn(`${item.reconnectInterval}秒后尝试重新连接,第${socket.reconnectAttempts + 1}次`);
                    //     socket.reconnectAttempts++
                    //     setTimeout(function () {
                    //         let newSocket = new WebSocket(item.address, {
                    //             headers: {
                    //                 'X-Self-ID': Bot.uin,
                    //                 'Content-Type': 'application/json'
                    //             }
                    //         });
                    //         newSocket.type = item.type;
                    //         newSocket.name = item.name;
                    //         newSocket.reconnectAttempts = socket.reconnectAttempts
                    //         newSocket.onopen = socket.onopen;
                    //         newSocket.onmessage = socket.onmessage;
                    //         newSocket.onclose = socket.onclose;
                    //         newSocket.onerror = socket.onerror
                    //         if (newSocket.reconnectAttempts >= item.maxReconnectAttempts && item.maxReconnectAttempts != 0) {
                    //             newSocket.onclose = () => {
                    //                 logger.warn('达到最大重连次数,停止重新连接');
                    //             }
                    //         }
                    //     }, item.reconnectInterval * 1000);
                    // }
                };

                socket.onerror = async (event) => {
                    logger.error(`${item.name}连接失败\n${event.error}`);
                };

            } else if (item.type == 2) {
                var parts = item.address.split(':');
                var host = parts[0];
                var port = parts[1];
                let server = new WebSocketServer({ port, host });
                server.type = item.type
                server.name = item.name
                server.on('listening', () => {
                    logger.mark(`ws服务器已启动并监听 ${host}:${port}`);
                    serverList.push(server)
                });
                server.on('connection', async function (socket) {
                    socket.type = item.type
                    socket.name = item.name
                    logger.mark(`新的客户端连接,连接端口为${port}`);
                    lifecycle(socket)
                    if (Config.heartbeat.interval > 0) {
                        timer = setInterval(async () => {
                            heartbeat(socket)
                        }, Config.heartbeat.interval * 1000)
                        timerList.push(timer)
                    }
                    socket.on('close', function () {
                        logger.warn(`客户端断开连接,端口为${port}`);
                        socketList = socketList.filter(function (s) {
                            return s.name !== socket.name;
                        });
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
                    socketList.push(socket);
                })
                server.on('error', async function (error) {
                    logger.error(`${item.address}启动失败,请检查地址是否填写正确,或者端口是否占用\n${error}`);
                })
                server.on('close', async function (error) {
                    logger.error(`${item.address}已关闭`);
                    serverList = serverList.filter(function (s) {
                        return s.name !== server.name;
                    });
                })
            } else if (item.type == 3) {
                let socket = new WebSocket(item.address);
                socket.type = item.type
                socket.name = item.name
                socket.reconnectAttempts = 0
                socket.onopen = (event) => {
                    logger.mark(`${item.name}已连接`);
                    socket.reconnectAttempts = 0
                    socketList.push(socket)
                };
                socket.onclose = (event) => {
                    logger.warn(`${item.name}连接已关闭`);
                    // clearInterval(timer)
                    socketList = socketList.filter(function (s) {
                        return s.name !== socket.name;
                    });
                    // if (item.reconnectInterval > 0) {
                    //     logger.warn(`${item.reconnectInterval}秒后尝试重新连接,第${socket.reconnectAttempts + 1}次`);
                    //     socket.reconnectAttempts++
                    //     setTimeout(function () {
                    //         let newSocket = new WebSocket(item.address, {
                    //             headers: {
                    //                 'X-Self-ID': Bot.uin,
                    //                 'Content-Type': 'application/json'
                    //             }
                    //         });
                    //         newSocket.type = item.type;
                    //         newSocket.name = item.name;
                    //         newSocket.reconnectAttempts = socket.reconnectAttempts
                    //         newSocket.onmessage = socket.onmessage;
                    //         newSocket.onclose = socket.onclose;
                    //         newSocket.onerror = socket.onerror
                    //         newSocket.onopen = socket.onopen;
                    //         if (newSocket.reconnectAttempts >= item.maxReconnectAttempts && item.maxReconnectAttempts != 0) {
                    //             newSocket.onclose = () => {
                    //                 logger.warn('达到最大重连次数,停止重新连接');
                    //             }
                    //         }
                    //     }, item.reconnectInterval * 1000);
                    // }
                };
                socket.onmessage = async (event) => {
                    const decoder = new TextDecoder();
                    let data = decoder.decode(event.data);
                    data = JSON.parse(data)
                    let msg = data.content
                    if (msg[0].type.startsWith('log')) {
                        logger.info(msg[0].data);
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
                        await Bot[target](data.target_id).sendMsg(sendMsg)
                    }
                }
                socket.onerror = (event) => {
                    logger.error(`${item.name}连接失败\n${event.error}`);
                };
            }
        }
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
    timerList.forEach((timer) => {
        clearInterval(timer);
    });
    timerList = timerList.filter(() => false);
    closeWebSocket(socketList, serverList)
}

export {
    createWebSocket,
    closeWebSocket,
    clearWebSocket,
    socketList,
    serverList
}

