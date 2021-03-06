const date_format = "YYYY-MM-DD hh:mm:ss"
const moment = require("moment")
const settings = require("../settings.json")
const sleep = require("sleep-promise")
const remind_date_format = "MM月DD日 HH:mm"
let reminds = []

const isExistsRemind = (title) => {
  return new Promise(resolve => {
    reminds.forEach(remind => {
      if (remind.title == title) resolve(true)
    })
    resolve(false)
  })
}

module.exports = {
  set: (msg, args) => {
    const set_date = moment(args[0], "hh:mm")
    args.shift()
    const set_title = args.join(" ")
    const now = moment()
    let diff = set_date.diff(now)

    isExistsRemind(set_title).then(isExists => {
      if (isExists) throw "is exists remind"
      if (!diff) {
        msg.channel.send("無効な日時フォーマットです＞＜;")
        return
      }
      if (diff < 1){
        set_date.add(1, "days")
        diff = set_date.diff(now)
      }
      const formated_set_date = set_date.format(remind_date_format)

      msg.channel.send("リマインダーをセットしましたっ！").then(sended_msg => {
        msg.channel.send({
          embed: {
            color: 0x48f442,
            title: `[${formated_set_date}] ${set_title}`
          }
        })
      })
      reminds.push({ title: set_title, date: formated_set_date })
      sleep(diff).then(sleeped => {
        reminds.forEach((remind, index) => {
          if (remind.title === set_title) reminds.splice(index, 1)
        })
        msg.channel.send({
          embed: {
            color: 0x48f442,
            title: set_title
          }
        })
      })
    }).catch(error => {
      switch (error) {
        case "is exists remind":
          msg.channel.send("既存のリマインドです＞＜;")
          break;
        default:
          console.log(error)
          break;
      }
    })
  },
  list: (msg) => {
    let have_ask = false
    reminds.forEach(remind => {
      have_ask = true
      msg.channel.send({
        embed: {
          color: 0x48f442,
          title: `[${remind.date}] ${remind.title}`
        }
      })
    })
    if (!have_ask) msg.channel.send("設定されていません＞＜；")
  }
}