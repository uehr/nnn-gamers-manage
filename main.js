const request = require("request")
const player_api_url = "https://api.r6stats.com/api/v1/players/<name>?platform=uplay"
const operator_api_url = "https://api.r6stats.com/api/v1/players/<name>/operators?platform=uplay"
const discord = require("discord.js")
const client = new discord.Client()
const settings = require("./settings.json")[0]
const moment = require("moment")
const dateFormat = "YYYY-MM-DD hh:mm:ss"
const cron = require("node-cron")
const MeCab = new require("mecab-lite")
let mecab = new MeCab()

mecab.ENCODING = "UTF-8"


cron.schedule(`0 0 ${settings.info_hour} * * * *`, () => {
  client.channels.find("name", settings.info_msg_channel_name).send(settings.info_msg)
})

client.on("ready", () => {
  console.log("started: " + moment().format(dateFormat))
});

client.on("guildMemberAdd", member => {
  const name = member.user.username
  client.channels.find("name", settings.welcome_msg_channel_name).send(settings.join_msg.replace("<name>", name))
});

client.on("message", msg => {
  switch (msg.content) {
    case "!help":
      msg.channel.send(settings.help_msg)
      break;
    case "!now":
      msg.channel.send(moment().format(dateFormat))
      break;
    case "!info":
      msg.channel.send(settings.info_msg)
      break;
    case "!dev":
      msg.channel.send(settings.dev_msg)
      break;
    case "!active":
      let message = "- *Active VC* -\n"
      client.channels.forEach(channel => {
        if(channel.type === "voice"){
          let joined_user_count = 0;
          channel.members.forEach(details => {
            joined_user_count++;
          })

          if(joined_user_count){
            message += `[${channel.name}] - ${joined_user_count}人\n`
          }
        }
      })
      msg.channel.send(message)
      break;
    default:
      //take argment commands
      settings.ban_words.forEach(ban_word => {
        if(msg.content.match(ban_word) && !msg.author.bot){
          const log = settings.ban_word_log_msg.replace("<name>", msg.author.username).replace("<id>", msg.author.id).replace("<content>", msg.content).replace("<channel>", msg.channel.name).replace("<date>", moment().format(dateFormat))
          client.channels.find("name", settings.ban_manage_channel_name).send(log);
          return
        }
      });

      const r6s_player_data_find = msg.content.match(/^!r6s (.+)$/)
      const r6s_operator_data_find = msg.content.match(/^!r6s op (.+)$/)
      const roulette = msg.content.match(/^!roulette (.+)$/)

      if(r6s_operator_data_find){
         msg.channel.send(settings.loading_msg).then(loading_msg => {
          const name = r6s_operator_data_find[1]
          request.get(operator_api_url.replace("<name>", name), (error, response, body) => {
            if (error) {
              msg.channel.send("GET request error");
              return
            }

            const res = JSON.parse(body);

            if (res.status === "failed") {
              msg.channel.send(res.errors[0].title)
              return
            }

            const operators = res.operator_records
            const indent = {name: "\u200b", value: "\u200b"}
            let atack_operators = []
            let defense_operators = []

            //プレイ時間順　
            const sorted = operators.sort((a, b) => {
                const keyA = a.stats.played,
                      keyB = b.stats.played;
                if(keyA > keyB) return -1;
                if(keyA < keyB) return 1;
                return 0;
            });

            operators.some(op => {
              const operator_data = settings.r6s_operator_msg.replace("<played>", op.stats.played).replace("<wlr>", Math.floor((op.stats.wins / op.stats.losses) * 1000) / 1000).replace("<kd>", Math.floor((op.stats.kills / op.stats.deaths) * 1000) / 1000).replace("<playtime>", Math.floor(op.stats.playtime / 3600))

              if(op.operator.role === "atk" && atack_operators.length < settings.views_count * 2){
                  atack_operators.push(indent)
                  atack_operators.push({name: `- ${op.operator.name} -`, value: operator_data})
              }else if(op.operator.role === "def" && defense_operators.length < settings.views_count * 2){
                  defense_operators.push(indent)
                  defense_operators.push({name: `- ${op.operator.name} -`, value: operator_data})
              }else{
                return false
              }
            })

            msg.channel.send({embed: {
                color: 8421504,
                title: `【${name}】オペレーター情報 (プレイ時間順)`,
            }}).then(sended_msg => {
             return msg.channel.send({embed: {
                color: 8421504,
                title: "【攻撃】",
                fields: atack_operators,
              }
            }).then(sended_msg => {
              return msg.channel.send({embed: {
                color: 8421504,
                title: `【防衛】`,
                fields: defense_operators,
              }
            }).then(sended_msg => {
              loading_msg.delete()
              })
            })
          })
        })
      })
      } else if (r6s_player_data_find) {
        msg.channel.send(settings.loading_msg).then(loading_msg => {
          const name = r6s_player_data_find[1]
          request.get(player_api_url.replace("<name>", name), (error, response, body) => {
            if (error) {
              msg.channel.send("GET request error");
              return
            }

            const res = JSON.parse(body);

            if (res.status === "failed") {
              msg.channel.send(res.errors[0].title)
              return
            }

            const casual = res.player.stats.casual
            const rank = res.player.stats.ranked
            const progression = res.player.stats.progression
            const overall = res.player.stats.overall

            //player
            const player_data = settings.r6s_player_msg.replace("<level>", progression.level).replace("<xp>", progression.xp).replace("<headshots>", overall.headshots).replace("<assists>", overall.assists) + "\n\n"

            //casual
            const casual_data = settings.r6s_battle_record_msg.replace("<wins>", casual.wins).replace("<losses>", casual.losses).replace("<wlr>", casual.wlr).replace("<kills>", casual.kills).replace("<deaths>", casual.deaths).replace("<kd>", casual.kd).replace("<playtime>", Math.floor(casual.playtime / 3600)) + "\n\n"

            //ranked
            const rank_data = settings.r6s_battle_record_msg.replace("<wins>", rank.wins).replace("<losses>", rank.losses).replace("<wlr>", rank.wlr).replace("<kills>", rank.kills).replace("<deaths>", rank.deaths).replace("<kd>", rank.kd).replace("<playtime>", Math.floor(rank.playtime / 3600))

            msg.channel.send({embed: {
              color: 8421504,
              title: `【${name}】戦績`,
              fields: [{
                  name: "\u200b",
                  value: player_data
                },{
                  name: "\u200B",
                  value: "\u200B"
                },{
                  name: "【カジュアル】",
                  value: casual_data
                },{
                  name: "\u200B",
                  value: "\u200B"
                },{
                  name: "【ランク】",
                  value: rank_data
                }
              ]
            }}).then(sended_msg => {
              loading_msg.delete()
            });
          })
        })
      }else if(roulette){
        const values = msg.content.replace("!roulette ","").split(" ")
        msg.channel.send(values[Math.floor(Math.random() * values.length)])
      }
  }
})

client.login(settings.token)