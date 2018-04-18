/**
 * [using envs list]
 * twitter_consumer_key
 * twitter_consumer_secret
 * twitter_access_token_key
 * twitter_access_token_secret
 * discord_token
*/

const player_api_url = "https://api.r6stats.com/api/v1/players/<name>?platform=uplay"
const operator_api_url = "https://api.r6stats.com/api/v1/players/<name>/operators?platform=uplay"
const discord = require("discord.js")
const dclient = new discord.Client()
const settings = require("./settings.json")[0]
const moment = require("moment")
const twitter = require("twitter")
const sleep = require("sleep-promise")
const bgm_path = "./bgm/<number>.mp3"
const cron = require("cron").CronJob
const http = require("http")
const vote = require("./lib/vote")
const remind = require("./lib/remind")
const tclient = new twitter({
  consumer_key: process.env.twitter_consumer_key,
  consumer_secret: process.env.twitter_consumer_secret,
  access_token_key: process.env.twitter_access_token_key,
  access_token_secret: process.env.twitter_access_token_secret
})
moment.locale("ja")

//app running check for heroku
http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type": "text:plain"})
  res.end(process.env.app_status)
}).listen(process.env.PORT || 8080)

//対象ユーザーのIDを取得
console.log("twitter: ")
settings.twitter_targets.forEach((option, index) => {
  sleep((index + 1) * 60000).then(resolve => {
    console.log(option)
    tclient.get('statuses/user_timeline', { screen_name: option.user_name }, (error, tweets, response) => {
      if (!error) {
        const user_id = tweets[0].user.id_str
        //取得できたIDを用いてストリームを生成
        tclient.stream('statuses/filter', { follow: user_id }, stream => {
          stream.on('data', tweet => {
            if ((tweet.user.id_str === user_id) && !tweet.in_reply_to_user_id) {
              if (tweet.user.screen_name === "hoge37" && tweet.text != "sync test") return
              const tweet_url = `https://twitter.com/${option.user_name}/status/${tweet.id_str}`
              dclient.channels.find("name", option.post_channel_name).send(tweet_url)
            }
          })
        })
      }
    })
  }).catch(error => {
    console.log(error)
  })
})

new cron({
  cronTime: `0 0 ${settings.info_hour} * * ${settings.info_on_week}`,
  onTick: () => {
    dclient.channels.find("name", settings.info_msg_channel_name).send(settings.info_msg)
  },
  timeZone: "Asia/Tokyo"
}).start()

dclient.on("ready", () => {
  console.log("started: " + moment().tz('Asia/Tokyo').format(settings.date_format))
})

dclient.on("guildMemberAdd", member => {
  const name = member.user.username
  dclient.channels.find("name", settings.welcome_msg_channel_name).send(settings.join_msg.replace("<name>", name))
})

dclient.on("message", msg => {
  switch (msg.content) {
    case "!help":
      require("./lib/help")(msg)
      break;
    case "!now":
      msg.channel.send(moment().tz('Asia/Tokyo').format(settings.date_format))
      break;
    case "!info":
      msg.channel.send(settings.info_msg)
      break;
    case "!active":
      require("./lib/active")(msg, dclient)
      break
    case "!vote list":
      vote.list(msg)
      break
    case "!remind list":
      remind.list(msg)
     break
    default:
      //take argment commands
      settings.ban_words.forEach(ban_word => {
        if (msg.content.match(ban_word) && !msg.author.bot) {
          const log = settings.ban_word_log_msg.replace("<name>", msg.author.username).replace("<id>", msg.author.id).replace("<content>", msg.content).replace("<channel>", msg.channel.name).replace("<date>", moment().format(dateFormat))
          dclient.channels.find("name", settings.ban_manage_channel_name).send(log);
          return
        }
      })

      const r6s_player_data_find_cmd = msg.content.match(/^!r6s (.+)$/)
      const r6s_operator_data_find_cmd = msg.content.match(/^!r6s op (.+)$/)
      const roulette_cmd = msg.content.match(/^!roulette_cmd (.+)$/)
      const join_vc_cmd = msg.content.match(/^!joinvc (.+)$/)
      const add_vote_cmd = msg.content.match(/^!vote add (.+)/)
      const vote_cmd = msg.content.match(/^!vote (.+) (.+)$/)
      const finish_vote_cmd = msg.content.match(/^!vote finish (.+)$/)
      const remind_cmd = msg.content.match(/^!remind (.+) (\d{1,4})$/)

      if (r6s_operator_data_find_cmd) {
        require("./lib/r6sop")(msg, r6s_operator_data_find_cmd)
      } else if (r6s_player_data_find_cmd) {
        require("./lib/r6spl")(msg, r6s_player_data_find_cmd)
      } else if (roulette_cmd) {
        const values = msg.content.replace("!roulette_cmd ", "").split(" ")
        msg.channel.send(values[Math.floor(Math.random() * values.length)])
      } else if (add_vote_cmd) {
        vote.add(msg, add_vote_cmd)
      } else if (finish_vote_cmd) {
        vote.finish(msg, finish_vote_cmd)
      } else if (vote_cmd) {
        vote.vote(msg, vote_cmd)
      } else if (remind_cmd) {
        remind.set(msg, remind_cmd)
      }
  }
})

dclient.login(process.env.discord_token)
