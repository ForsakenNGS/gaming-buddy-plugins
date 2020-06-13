// Nodejs dependencies
const fs = require('fs');
const path = require('path');
const { createWorker, createScheduler } = require('tesseract.js');

const cacheDir = path.resolve("./cache/tesseract");

class TesseractCluster {

  constructor(threads) {
    this.scheduler = createScheduler();
    this.queue = [];
    this.threadIndex = 0;
    while (this.threadIndex < threads) {
      this.addWorker(this.threadIndex++);
    }
  }

  addWorker(threadIndex) {
    let threadCache = path.join(cacheDir, "thread"+threadIndex);
    if (!fs.existsSync(threadCache)) {
      fs.mkdirSync(threadCache, { recursive: true });
    }
    let worker = createWorker({
      cachePath: threadCache,
      //cacheMethod: "none",
      errorHandler: (error) => {
        console.error(error);
      }
    });
    (async() => {
      await worker.load();
      await worker.loadLanguage("eng+lat+rus+kor");
      await worker.initialize("eng+lat+rus+kor");
      this.scheduler.addWorker(worker);
      this.checkQueue();
    })();
  }

  addJob(image, langs, params) {
    return new Promise((resolve, reject) => {
      let job = {
        image: image, langs: langs, params: params,
        resolve: resolve, reject: reject
      };
      if (this.scheduler.getNumWorkers() == 0) {
        // No  workers ready yet, queue task
        this.queue.push(job)
      } else {
        // Add job to scheduler
        this.scheduler.addJob('recognize', image, params).then((...result) => {
          job.resolve(...result);
        }).catch((...result) => {
          job.reject(...result);
        });
      }
    });
  }

  checkQueue() {
    if (this.queue.length > 0) {
      let nextJob = this.queue.shift();
      // Add job to scheduler
      this.scheduler.addJob('recognize', nextJob.image, nextJob.params).then((...result) => {
        nextJob.resolve(...result);
      }).catch((...result) => {
        nextJob.reject(...result);
      });
    }
  }

  recognize(image, langs, params) {
    return this.addJob(image, langs, params);
  }

}

module.exports = TesseractCluster;