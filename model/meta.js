import { Config } from '../components/index.js'
/**
 * 生命周期
 * @param {*} socket 
 */
function lifecycle(socket) {
    let data = {
        meta_event_type: 'lifecycle',
        post_type: 'meta_event',
        self_id: Bot.uin,
        sub_type: 'connect',
        time: Date.now()
    }
    socket.send(JSON.stringify(data));
}

/**
 * 心跳
 * @param {*} socket 
 */
function heartbeat(socket) {
    let data = {
        time: Date.parse(new Date()) / 1000,
        self_id: Bot.uin,
        post_type: 'meta_event',
        meta_event_type: 'heartbeat',
        status: {
            online: Bot.isOnline(),
            good: Bot.isOnline(),
            stat: {
                packet_receivend: Bot.stat.recv_pkt_cnt,
                packet_send: Bot.stat.sent_pkt_cnt,
                packet_lost: Bot.stat.lost_pkt_cnt,
                message_received: Bot.stat.recv_msg_cnt,
                message_send: Bot.stat.sent_msg_cnt,
                disconnect_times: 0,
                lost_times: Bot.stat.lost_times,
                last_message_time: Date.parse(new Date()) / 1000    //就当是现在吧
            }
        },
        interval: Config.heartbeat.interval * 1000
    }
    socket.send(JSON.stringify(data))
}

export {
    lifecycle,
    heartbeat
}