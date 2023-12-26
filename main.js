//    Imports    \\
const { Client, Intents, Interaction, Permissions, GuildMember, MessageEmbed, MessageActionRow, MessageSelectMenu } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] });

const config = require("./config.json");

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const rest = new REST({ version: '9' }).setToken(config.token);
const axios = require("axios");

//    On enable    \\
client.on('ready', async () => {
    console.log("The bot is online !");
    // register commands \\
    await rest.put( Routes.applicationCommands(client.user.id), { body: [{"name": "ping", "description": "Ping a Minecraft server !"}] } ).then( function (response) { 
        //console.log(response);
    });
    
    // Set the bot presence \\
    client.user.setPresence({
        status: 'online',
        activities: [{
            name: config.ip,
            type: 'WATCHING', //PLAYING, WATCHING, LISTENING, or STREAMING
        }]
    })
})

//    on interaction    \\
client.on('interactionCreate', async interaction => {

    try {
        if(interaction.commandName === 'ping') {

            // start the timer
            var startTime = Date.now();

            // send success to discord to avoid timeout message
            await interaction.deferReply().then(async function () {
                // set the bot latency time
                const bot_latency = Date.now() - startTime;

                // reset the timer
                startTime = Date.now();
                
                // get minecraft server ping informations
                axios.get("https://minecraft-api.com/api/ping/" + config.ip + "/" + config.port, { timeout: config.timeout })
                .then(async function (response) {
                    // format the json response
                    const json = response.data;

                    var pingEmbed = null;
                    var message = null;
                    var pingMenu = null;
                    
                    // set the minecraft api (api.minetools.eu) latency time
                    const minecraft_api_latency = Date.now() - startTime;

                    if(config.message.embed == true) {
                        // make discord embed
                        pingEmbed = new MessageEmbed()
                        .setColor(config.message.color)
                        .setTitle(config.message.title)
                        .setDescription(getDescription(json, bot_latency, minecraft_api_latency))
                        .setTimestamp();
                    } else {
                        // make message
                        message = "**" + config.message.title + "**\n\n" + getDescription(json, bot_latency, minecraft_api_latency);
                    }

                    // if the menu is enabled in the config
                    if(config.enable_menu == true) {

                        // make the discord drop down menu
                        pingMenu = new MessageActionRow()
                        .addComponents(
                            new MessageSelectMenu()
                                .setCustomId('servers')
                                .setPlaceholder(config.menu.title)
                                .addOptions(getServersList(interaction)),
                        );
                    }
                    // reply the the message (edit the defer message)
                    sendReply(interaction, pingEmbed, message, pingMenu);
                });

            // if there is an error send an error embed
            }).catch(async function (error) {
                const errorEmbed = new MessageEmbed()
                    .setColor('#ff0000')
                    .setTitle('❌ **Error :**')
                    .setDescription("```" + error + " ```");
                await interaction.editReply({ embeds: [errorEmbed] });
            });

            
        } else if(interaction.customId === 'servers') {

            // send success to discord to avoid timeout message
            await interaction.deferReply({ ephemeral: true });

            // get minecraft server ping informations
            axios.get("https://minecraft-api.com/api/ping/" + interaction.values[0] + "/" + config.port, { timeout: config.timeout })
            .then(async function (response) {
                // format the json response
                const json = response.data;

                if(config.message.embed == true) {
                    const pingEmbed = new MessageEmbed()
                    .setColor(config.message.color)
                    .setTitle(config.message.title)
                    .setDescription(getDescription(json))
                    .setTimestamp();

                    // reply the the message (edit the defer message)
                    await interaction.editReply({ embeds: [pingEmbed], ephemeral: true });
                } else {
                    const message = "**" + config.message.title + "**\n\n" + getDescription(json);

                    // reply the the message (edit the defer message)
                    await interaction.editReply({ content: message, ephemeral: true });
                }

            // if there is an error send an error embed
            }).catch(async function (error) {
                const errorEmbed = new MessageEmbed()
                    .setColor('#ff0000')
                    .setTitle('❌ **Error :**')
                    .setDescription("```" + error + " ```");
                await interaction.editReply({ embeds: [errorEmbed] });
            });
        }
    // if there is an other error send an error embed
    } catch (error) {
        const errorEmbed = new MessageEmbed()
                .setColor('#ff0000')
                .setTitle('❌ **Error :**')
                .setDescription("```" + error + " ```");
        await interaction.editReply({ embeds: [errorEmbed] });
    }
});

// reply the message
async function sendReply(interaction, pingEmbed, message, pingMenu) {
    if(pingMenu != null) {
        if(pingEmbed != null) {
            await interaction.editReply({ components: [pingMenu], embeds: [pingEmbed] });
        } else {
            await interaction.editReply({ components: [pingMenu], content: message });
        }
    } else {
        if(pingEmbed != null) {
            await interaction.editReply({ embeds: [pingEmbed] });
        } else {
            await interaction.editReply({ content: message });
        }
    }
}

// format the embed description with the config (and other parameters)
function getDescription(json, bot_latency, minecraft_api_latency) {
    var description = "";
    for (let i = 0; i < config.message.description.length; i++) {
        description += config.message.description[i];
    } 

    return description.replace("${server_name}", config.name).replace("${motd_1}", getMOTD(json)[0]).replace("${motd_2}", getMOTD(json)[1])
                .replace("${online_players}", getOnlinePlayers(json)).replace("${max_players}", getMaxPlayers(json))
                .replace("${server_version}", getVersion(json)).replace("${server_latency}", getPing(json)).replace("${bot_latency}", bot_latency)
                .replace("${discordapi_latency}", client.ws.ping).replace("${minecraftapi_latency}", minecraft_api_latency);
}

// get the server list in the config
function getServersList() {
    var commands = [];

    for (let i = 0; i < config.menu.servers.length; i++) {
        const server = config.menu.servers[i];
        commands.push({
            label: server.name,
            description: "Ping the " + server.name + " server (ip: " + server.ip + ") !",
            value: server.ip,
        });
    }

    return commands;
}

// get the minecraft server MOTD
function getMOTD(json) {
    return json.description.split("\n");
}

// get the online players on the minecraft server
function getOnlinePlayers(json) {
    return json.players.online;
}

// get the maximum players on the minecraft server
function getMaxPlayers(json) {
    return json.players.max;
}

// get the minecraft server version
function getVersion(json) {
    return json.version.name;
}

// get the minecraft server latency
function getPing(json) {
    return json.latency;
}

//    login the bot    \\
client.login(config.token);