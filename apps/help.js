import plugin from '../../../lib/plugins/plugin.js'
import { Render, Version } from '../components/index.js'

export class setting extends plugin {
    constructor() {
        super({
            name: '[ws-plugin] 帮助',
            dsc: '[ws-plugin] 帮助',
            event: 'message',
            priority: 998,
            rule: [
                {
                    reg: '^#ws版本$',
                    fnc: 'version'
                }
            ]
        })

    }
    async version(e) {
        return await Render.render('help/version-info', {
            currentVersion: Version.version,
            changelogs: Version.changelogs,
            elem: 'cryo'
        }, { e, scale: 1.2 })
    }

}