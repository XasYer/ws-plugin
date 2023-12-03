export default class TaskQueue {
    constructor(concurrency) {
        this.concurrency = concurrency
        this.queue = []
        this.running = 0
    }

    runTask(task) {
        return new Promise((resolve, reject) => {
            const taskWithHandling = async () => {
                try {
                    this.running++
                    const result = await task()
                    resolve(result)
                } catch (error) {
                    reject(error)
                } finally {
                    this.running--
                    this.next()
                }
            }
            this.queue.push(taskWithHandling)
            this.next()
        })
    }

    next() {
        if (this.running < this.concurrency && this.queue.length) {
            const task = this.queue.shift()
            task()
        }
    }
}