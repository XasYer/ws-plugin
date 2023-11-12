import { Config, Version } from '../components/index.js'
import { getLatestMsg } from './DataBase.js'
/**
 * 生命周期
 * @param {*} socket 
 */
function lifecycle(uin) {
    return JSON.stringify({
        meta_event_type: 'lifecycle',
        post_type: 'meta_event',
        self_id: uin,
        sub_type: 'connect',
        time: Date.parse(new Date()) / 1000
    })
}

/**
 * 心跳
 * @param {*} socket 
 */
function heartbeat(uin) {
    let latestMsg = getLatestMsg()
    let time = 0
    if (latestMsg) {
        time = latestMsg.time
    }
    let status
    if (Version.isTrss) {
        status = {
            online: true,
            good: true,
            stat: {}
        }
    } else {
        status = {
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
                last_message_time: time
            }

        }
    }
    return JSON.stringify({
        time: Date.parse(new Date()) / 1000,
        self_id: uin,
        post_type: 'meta_event',
        meta_event_type: 'heartbeat',
        status,
        interval: Config.heartbeatInterval * 1000
    })
}

export {
    lifecycle,
    heartbeat
}