import { Config } from '../components/index.js'
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
    const status = {
        app_good: true,
        online: true,
        good: true,
        // 不想统计了,有问题再说
        stat: {}
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