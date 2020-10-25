const { Client, Util, MessageEmbed } = require("discord.js");
const YouTube = require("simple-youtube-api");
const ytdl = require("ytdl-core");
require("dotenv").config();
require("./server.js");

const bot = new Client({
    disableMentions: "all"
});

const PREFIX = process.env.PREFIX;
const youtube = new YouTube(process.env.YTAPI_KEY);
const queue = new Map();

bot.on("warn", console.warn);
bot.on("error", console.error);
bot.on("ready", () => console.log(`[READY] ${bot.user.tag} has been successfully booted up!`));
bot.on("shardDisconnect", (event, id) => console.log(`[SHARD] Shard ${id} disconnected (${event.code}) ${event}, trying to reconnect...`));
bot.on("shardReconnecting", (id) => console.log(`[SHARD] Shard ${id} reconnecting...`));

// prevent force disconnect affecting to guild queue
bot.on("voiceStateUpdate", (mold, mnew) => {
	if( !mold.channelID) return;
	if( !mnew.channelID && bot.user.id == mold.id ) {
		 const serverQueue = queue.get(mold.guild.id);
		 if(serverQueue)  queue.delete(mold.guild.id);
	} ;
})

bot.on("message", async (message) => { // eslint-disable-line
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.split(" ");
    const searchString = args.slice(1).join(" ");
    const url = args[1] ? args[1].replace(/<(.+)>/g, "$1") : "";
    const serverQueue = queue.get(message.guild.id);

    let command = message.content.toLowerCase().split(" ")[0];
    command = command.slice(PREFIX.length);

    if (command === "help" || command === "cmd") {
        const helpembed = new MessageEmbed()
            .setColor("BLUE")
            .setAuthor(bot.user.tag, bot.user.displayAvatarURL())
            .setDescription(`
__**Command list**__
> \`play\` > **\`play [title/url]\`**
> \`search\` > **\`search [title]\`**
> \`skip\`, \`stop\`,  \`pause\`, \`resume\`
> \`nowplaying\`, \`queue\`, \`volume\``)
            .setFooter("©️ 2020 clef.", "https://cdn.discordapp.com/attachments/769662421782233138/769667975640383488/image3.png");
        message.channel.send(helpembed);
    }
    if (command === "play" || command === "p") {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.channel.send("يجب أن تكون في روم صوتي لتشغيل البوت!");
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has("CONNECT")) {
            return message.channel.send("البوت بحاجة إلى ** `CONNECT` ** بروموشن للمتابعة!");
        }
        if (!permissions.has("SPEAK")) {
            return message.channel.send("البوت بحاجة إلى ** `SPEAK` ** بروموشن للمتابعة!");
        }
        if (!url || !searchString) return message.channel.send("يرجى إدخال الرابط / العنوان لتشغيل البوت");
        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, message, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
            return message.channel.send(`✅ ** | ** قائمة التشغيل: تمت إضافة **\`${playlist.title}\`** إلى قائمة الانتظار`);
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    var video = await youtube.getVideoByID(videos[0].id);
                    if (!video) return message.channel.send("🆘 ** | ** لم أتمكن من الحصول على أي نتائج بحث");
                } catch (err) {
                    console.error(err);
                    return message.channel.send("🆘 ** | ** لم أتمكن من الحصول على أي نتائج بحث");
                }
            }
            return handleVideo(video, message, voiceChannel);
        }
    }
    if (command === "search" || command === "sc") {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.channel.send("يجب أن تكون في روم صوتي لتشغيل البوت!");
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has("CONNECT")) {
            return message.channel.send("البوت بحاجة إلى ** `CONNECT` ** بروموشن للمتابعة!");
        }
        if (!permissions.has("SPEAK")) {
            return message.channel.send("البوت بحاجة إلى ** `SPEAK` ** بروموشن للمتابعة!");
        }
        if (!url || !searchString) return message.channel.send("يرجى إدخال الرابط / العنوان للبحث عن الموسيقى!");
        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, message, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
            return message.channel.send(`✅ ** | ** قائمة التشغيل: تمت إضافة **\`${playlist.title}\`** إلى قائمة الانتظار`)
            ;
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    let index = 0;
                    let embedPlay = new MessageEmbed()
                        .setColor("BLUE")
                        .setAuthor("Search results", message.author.displayAvatarURL())
                        .setDescription(`${videos.map(video2 => `**\`${++index}\`  |**  ${video2.title}`).join("\n")}`)
                        .setFooter("Please choose one of the following 10 results, this embed will auto-deleted in 15 seconds");
                    // eslint-disable-next-line max-depth
                    message.channel.send(embedPlay).then(m => m.delete({
                        timeout: 15000
                    }))
                    try {
                        var response = await message.channel.awaitMessages(message2 => message2.content > 0 && message2.content < 11, {
                            max: 1,
                            time: 15000,
                            errors: ["time"]
                        });
                    } catch (err) {
                        console.error(err);
                        return message.channel.send("انتهى وقت اختيار الموسيقى في 15 ثانية ، تم إلغاء الطلب.");
                    }
                    const videoIndex = parseInt(response.first().content);
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                } catch (err) {
                    console.error(err);
                    return message.channel.send("🆘 ** | ** لم أتمكن من الحصول على أي نتائج بحث");
                }
            }
            response.delete();
            return handleVideo(video, message, voiceChannel);
        }

    } else if (command === "skip") {
        if (!message.member.voice.channel) return message.channel.send("يجب أن تكون في روم صوتي لتشغيل البوت!");
        if (!serverQueue) return message.channel.send("لا يوجد أي شيء يمكنني تخطيه");
        serverQueue.connection.dispatcher.end("[runCmd] تم استخدام أمر تخطي");
        return message.channel.send("⏭️ ** | ** لقد تخطيت الموسيقى من أجلك");

    } else if (command === "stop") {
        if (!message.member.voice.channel) return message.channel.send("يجب أن تكون في روم صوتي لتشغيل البوت!");
        if (!serverQueue) return message.channel.send("لا يوجد شيء يمكنني إيقافه");
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end("[runCmd] تم استخدام أمر الإيقاف");
        return message.channel.send("⏹️ ** | ** حذف قوائم الانتظار ومغادرة روم الصوت ...");

    } else if (command === "v" || command === "vol") {
        if (!message.member.voice.channel) return message.channel.send("أنا آسف ، لكن يجب أن تكون في روم صوتي لتعيين مستوى الصوت!");
        if (!serverQueue) return message.channel.send("لا يوجد شيء للبدا");
        if (!args[1]) return message.channel.send(`مستوى الصوت الحالي هو: **\`${serverQueue.volume}%\`**`);
        if (isNaN(args[1]) || args[1] > 100) return message.channel.send("يمكن ضبط مستوى الصوت فقط بين** \ `1 \` ** - ** \ `100 \` **");
        serverQueue.volume = args[1];
        serverQueue.connection.dispatcher.setVolume(args[1] / 100);
        return message.channel.send(`قمت بتعيين مستوى الصوت على: **\`${args[1]}%\`**`);

    } else if (command === "nowplaying" || command === "np") {
        if (!serverQueue) return message.channel.send("لا يوجد شيء للبدا");
        return message.channel.send(`🎶 ** | ** جارٍ التشغيل الآن: **\`${serverQueue.songs[0].title}\`**`);

    } else if (command === "queue" || command === "q") {

        let songsss = serverQueue.songs.slice(1)
        
        let number = songsss.map(
            (x, i) => `${i + 1} - ${x.title}`
        );
        number = chunk(number, 5);

        let index = 0;
        if (!serverQueue) return message.channel.send("لا يوجد شيء للبدا");
        let embedQueue = new MessageEmbed()
            .setColor("BLUE")
            .setAuthor("Song queue", message.author.displayAvatarURL())
            .setDescription(number[index].join("\n"))
            .setFooter(`• Now Playing: ${serverQueue.songs[0].title} | Page ${index + 1} of ${number.length}`);
        const m = await message.channel.send(embedQueue);

        if (number.length !== 1) {
            await m.react("⬅");
            await m.react("🛑");
            await m.react("➡");
            async function awaitReaction() {
                const filter = (rect, usr) => ["⬅", "🛑", "➡"].includes(rect.emoji.name) &&
                    usr.id === message.author.id;
                const response = await m.awaitReactions(filter, {
                    max: 1,
                    time: 30000
                });
                if (!response.size) {
                    return undefined;
                }
                const emoji = response.first().emoji.name;
                if (emoji === "⬅") index--;
                if (emoji === "🛑") m.delete();
                if (emoji === "➡") index++;

                if (emoji !== "🛑") {
                    index = ((index % number.length) + number.length) % number.length;
                    embedQueue.setDescription(number[index].join("\n"));
                    embedQueue.setFooter(`Page ${index + 1} of ${number.length}`);
                    await m.edit(embedQueue);
                    return awaitReaction();
                }
            }
            return awaitReaction();
        }

    } else if (command === "pause") {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return message.channel.send("⏸ ** | ** أوقف الموسيقى مؤقتًا");
        }
        return message.channel.send("لا يوجد شيء للبدا");

    } else if (command === "resume") {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return message.channel.send("▶ ** | ** استأنف الموسيقى");
        }
        return message.channel.send("لا يوجد شيء للبدا");

    } else if (command === "loop") {
        if (serverQueue) {
            serverQueue.loop = !serverQueue.loop;
            return message.channel.send(`🔁  **|**  Loop is **\`${serverQueue.loop === true ? "تشفيل" : "معطل"}\`**`);
        }
        return message.channel.send("لا يوجد شيء للبدا");
    }
});

async function handleVideo(video, message, voiceChannel, playlist = false) {
    const serverQueue = queue.get(message.guild.id);
    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    };
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 100,
            playing: true,
            loop: false
        };
        queue.set(message.guild.id, queueConstruct);
        queueConstruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(message.guild, queueConstruct.songs[0]);
        } catch (error) {
            console.error(`[ERROR] لم أتمكن من الانضمام إلى روم الصوتي ، بسبب: ${error}`);
            queue.delete(message.guild.id);
            return message.channel.send(`لم أتمكن من الانضمام إلى روم الصوتي ، بسبب: **\`${error}\`**`);
        }
    } else {
        serverQueue.songs.push(song);
        if (playlist) return;
        else return message.channel.send(`تمت إضافة ✅ ** | ** **\`${song.title}\`** إلى قائمة الانتظار`);
    }
    return;
}

function chunk(array, chunkSize) {
    const temp = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        temp.push(array.slice(i, i + chunkSize));
    }
    return temp;
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        return queue.delete(guild.id);
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
        .on("finish", () => {
            const shiffed = serverQueue.songs.shift();
            if (serverQueue.loop === true) {
                serverQueue.songs.push(shiffed);
            };
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolume(serverQueue.volume / 100);

    serverQueue.textChannel.send(`🎶 ** | ** بدء التشغيل: **\`${song.title}\`**`);
}

bot.login(process.env.BOT_TOKEN);

process.on("unhandledRejection", (reason, promise) => {
    try {
        console.error("Unhandled Rejection at: ", promise, "reason: ", reason.stack || reason);
    } catch {
        console.error(reason);
    }
});

process.on("uncaughtException", err => {
    console.error(`Caught exception: ${err}`);
    process.exit(1);
});
