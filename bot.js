const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    PermissionFlagsBits,
    WebhookClient,
    EmbedBuilder,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js')

const System = require('fs')

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers
    ],
    partials: ['CHANNEL', 'MESSAGE']
})

const Allowed = '1125379742191849503'
const AutoPurgeUsers = new Set()
const DangerousRoles = new Map()
const ForcedNicknames = new Map()
const LockedRoles = new Map()
const LinkWarnings = new Map()

let AntiLinkEnabled = false

const webhook = new WebhookClient({
    url: 'https://discord.com/api/webhooks/1423870598869815420/7DZHKBkmo1je9cZ4jNR4G5FA6_j_k9lmAZge5HiOk0jshPl5tLpLiuzY7a6onitGJdFT'
})

function ReadWhitelist() {
    try {
        return JSON.parse(System.readFileSync('whitelist.json', 'utf-8'));
    } catch {
        return [];
    }
}

function ReadLinkWarning() {
    try {
        return JSON.parse(System.readFileSync('linkwarnings.json', 'utf-8'))
    } catch {
        return {}
    }
}

function WriteWhitelist(data) {
    System.writeFileSync('whitelist.json', JSON.stringify(data, null, 2));
}

function WriteLinkWarning(data) {
    System.writeFileSync('linkwarnings.json', JSON.stringify(data, null, 2))
}

async function IDOrUser(interaction, input) {
    if (/^\d+$/.test(input)) {
        const member = await interaction.guild.members.fetch(input)
            .catch(() => null);
        if (member) {
            return member;
        }
    }
    const members = await interaction.guild.members.fetch({
        query: input,
        limit: 1
    });
    if (members.first()) {
        return members.first();
    }
    return null;
}

function Ephemeral(interaction, text) {
    const message = text.toLowerCase()
    const send = async() => {
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({
                content: message,
                flags: 64
            })
        } else if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({
                content: message,
                flags: 64
            })
        } else {
            await interaction.followUp({
                content: message,
                flags: 64
            })
        }
        setTimeout(() => {
            interaction.deleteReply()
                .catch(() => {})
        }, 1500)
    }
    send()
        .catch(() => {})
}

function OnSendChannel(channel, text) {
    return channel.send(text.toLowerCase())
        .then((message) => {
            setTimeout(() => {
                message.delete()
                    .catch(() => {})
            }, 1500)
        })
        .catch(() => {})
}

function IntDuration(string) {
    const match = string.match(/^(\d+)(s|m|h|d|w)$/i)
    if (!match) {
        return null
    }

    const number = parseInt(match[1], 10)
    const unit = match[2].toLowerCase()

    let min = 0
    if (unit === 's') {
        min = number * 1000
    }
    if (unit === 'm') {
        min = number * 60 * 1000
    }
    if (unit === 'h') {
        min = number * 60 * 60 * 1000
    }
    if (unit === 'd') {
        min = number * 24 * 60 * 60 * 1000
    }
    if (unit === 'w') {
        min = number * 7 * 24 * 60 * 60 * 1000
    }

    const max = 3 * 7 * 24 * 60 * 60 * 1000
    if (min > max) {
        return null
    }

    return min
}

function CreateCommand({
    name,
    description,
    options = [],
    permissions = null,
    handler
}) {
    const builder = new SlashCommandBuilder()
        .setName(name)
        .setDescription(description)
        .setDMPermission(false)
        .setContexts([InteractionContextType.Guild]);

    if (permissions !== null) {
        builder.setDefaultMemberPermissions(permissions);
    }

    for (let index = 0; index < options.length; index += 1) {
        const option = options[index];

        if (option.type === 'user') {
            builder.addUserOption((options) => {
                options.setName(option.name)
                    .setDescription(option.description)
                    .setRequired(option.required === true);
                return options;
            });
        }

        if (option.type === 'string') {
            builder.addStringOption((options) => {
                options.setName(option.name)
                    .setDescription(option.description)
                    .setRequired(option.required === true);
                return options;
            });
        }

        if (option.type === 'integer') {
            builder.addIntegerOption((options) => {
                options.setName(option.name)
                    .setDescription(option.description)
                    .setRequired(option.required === true);
                return options;
            });
        }

        if (option.type === 'role') {
            builder.addRoleOption((options) => {
                options.setName(option.name)
                    .setDescription(option.description)
                    .setRequired(option.required === true);
                return options;
            });
        }

        if (option.type === 'channel') {
            builder.addChannelOption((options) => {
                options.setName(option.name)
                    .setDescription(option.description)
                    .setRequired(option.required === true);
                return options;
            });
        }

        if (option.type === 'boolean') {
            builder.addBooleanOption((options) => {
                options.setName(option.name)
                    .setDescription(option.description)
                    .setRequired(option.required === true);
                return options;
            });
        }

        if (option.type === 'subcommand') {
            builder.addSubcommand((sub) => {
                sub.setName(option.name)
                    .setDescription(option.description);

                if (option.options && option.options.length > 0) {
                    for (let index = 0; index < option.options.length; index++) {
                        const suboptions = option.options[index];
                        if (suboptions.type === 'string') {
                            sub.addStringOption(options => options
                                .setName(suboptions.name)
                                .setDescription(suboptions.description)
                                .setRequired(suboptions.required === true));
                        }
                        if (suboptions.type === 'integer') {
                            sub.addIntegerOption(options => options
                                .setName(suboptions.name)
                                .setDescription(suboptions.description)
                                .setRequired(suboptions.required === true));
                        }
                        if (suboptions.type === 'user') {
                            sub.addUserOption(options => options
                                .setName(suboptions.name)
                                .setDescription(suboptions.description)
                                .setRequired(suboptions.required === true));
                        }
                        if (suboptions.type === 'role') {
                            sub.addRoleOption(options => options
                                .setName(suboptions.name)
                                .setDescription(suboptions.description)
                                .setRequired(suboptions.required === true));
                        }
                        if (suboptions.type === 'channel') {
                            sub.addChannelOption(options => options
                                .setName(suboptions.name)
                                .setDescription(suboptions.description)
                                .setRequired(suboptions.required === true));
                        }
                        if (suboptions.type === 'boolean') {
                            sub.addBooleanOption(options => options
                                .setName(suboptions.name)
                                .setDescription(suboptions.description)
                                .setRequired(suboptions.required === true));
                        }
                    }
                }

                return sub;
            });
        }
    }

    return {
        data: builder,
        async execute(interaction) {
            const Whitelist = ReadWhitelist();

            if (interaction.user.id !== Allowed && !Whitelist.includes(interaction.user.id)) {
                await Ephemeral(interaction, 'you cannot use this command');

                try {
                    const embed = new EmbedBuilder()
                        .setTitle('Unauthorized Command Attempt')
                        .addFields({
                            name: 'User',
                            value: `${interaction.user.tag} (${interaction.user.id})`
                        }, {
                            name: 'Command',
                            value: `/${interaction.commandName}`
                        }, {
                            name: 'Server',
                            value: `${interaction.guild.name} (${interaction.guild.id})`
                        })
                        .setTimestamp()
                        .setColor(0xfff0f5);

                    await webhook.send({
                        embeds: [embed]
                    });
                } catch (error) {
                    console.error('Failed to send webhook alert:', error);
                }

                return;
            }

            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({
                    flags: 64
                });
            }
            await handler(interaction);
        }
    };
}

const commands = [
    CreateCommand({
        name: 'test',
        description: 'check if bot is alive',
        options: [],
        permissions: 0,
        handler: async(interaction) => {
            await Ephemeral(interaction, 'Bot is running!');
        }
    }),

    CreateCommand({
        name: 'whitelist',
        description: 'add a user to the whitelist',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to whitelist',
            required: true
        }],
        permissions: 0,
        handler: async(interaction) => {
            if (interaction.user.id !== Allowed) {
                await Ephemeral(interaction, 'you cannot use this command')
                return
            }

            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!target) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const whitelist = ReadWhitelist()
            if (whitelist.includes(target.id)) {
                await Ephemeral(interaction, `<@${target.id}> is already whitelisted`)
                return
            }

            whitelist.push(target.id)
            WriteWhitelist(whitelist)
            await Ephemeral(interaction, `<@${target.id}> has been whitelisted`)
        }
    }),

    CreateCommand({
        name: 'unwhitelist',
        description: 'remove a user from the whitelist',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to remove from whitelist',
            required: true
        }],
        permissions: 0,
        handler: async(interaction) => {
            if (interaction.user.id !== Allowed) {
                await Ephemeral(interaction, 'you cannot use this command')
                return
            }

            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!target) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            let whitelist = ReadWhitelist()
            if (!whitelist.includes(target.id)) {
                await Ephemeral(interaction, `<@${target.id}> is not whitelisted`)
                return
            }

            whitelist = whitelist.filter(id => id !== target.id)
            WriteWhitelist(whitelist)
            await Ephemeral(interaction, `<@${target.id}> has been removed from whitelist`)
        }
    }),

    CreateCommand({
        name: 'clearwhitelist',
        description: 'clear all users from the whitelist',
        permissions: 0,
        handler: async(interaction) => {
            if (interaction.user.id !== Allowed) {
                await Ephemeral(interaction, 'you cannot use this command');
                return;
            }

            WriteWhitelist([]);
            await Ephemeral(interaction, 'whitelist has been cleared');
        }
    }),

    CreateCommand({
        name: 'listwhitelist',
        description: 'list all users currently in the whitelist',
        permissions: 0,
        handler: async(interaction) => {
            if (interaction.user.id !== Allowed) {
                await Ephemeral(interaction, 'you cannot use this command');
                return;
            }

            try {
                const whitelist = ReadWhitelist();
                if (!whitelist || whitelist.length === 0) {
                    await Ephemeral(interaction, 'the whitelist is currently empty');
                    return;
                }

                const users = await Promise.all(
                    whitelist.map(async id => {
                        try {
                            const user = await interaction.client.users.fetch(id);
                            return `\`${user.tag} (<@${id}>)\``;
                        } catch {
                            return `\`<@${id}>\``;
                        }
                    })
                );

                await Ephemeral(interaction, `**Whitelist Users:**\n${users.join('\n')}`);
            } catch (error) {
                await Ephemeral(interaction, `failed to list whitelist: ${error.message}`);
            }
        }
    }),

    CreateCommand({
        name: 'purge',
        description: 'delete messages from this channel (up to 1000) with optional filters',
        options: [{
                type: 'integer',
                name: 'amount',
                description: 'number of messages to delete (max 1000)',
                required: true
            },
            {
                type: 'user',
                name: 'user',
                description: 'delete messages from this user only',
                required: false
            },
            {
                type: 'string',
                name: 'keyword',
                description: 'delete messages containing this word',
                required: false
            },
            {
                type: 'string',
                name: 'duration',
                description: 'delete messages newer than this duration (5s,10m,1h,1d,2w max 3w)',
                required: false
            },
            {
                type: 'boolean',
                name: 'bot',
                description: 'delete only bot messages',
                required: false
            }
        ],
        permissions: PermissionFlagsBits.ManageMessages,
        handler: async(interaction) => {
            let amount = interaction.options.getInteger('amount')
            const useroption = interaction.options.getUser('user')
            let target = null
            if (useroption) {
                target = await IDOrUser(interaction, useroption.id)
            }
            let keyword = interaction.options.getString('keyword')
            let durationinput = interaction.options.getString('duration')
            let onlybot = interaction.options.getBoolean('bot')

            if (amount < 1 || amount > 1000) {
                await Ephemeral(interaction, 'you can only delete 1-1000 messages at a time')
                return
            }

            let min = null
            if (durationinput) {
                min = IntDuration(durationinput)
                if (min === null || min > 60 * 24 * 21) {
                    await Ephemeral(interaction, 'invalid duration. use formats like 5s, 10m, 1h, 1d, 2w (max 3w)')
                    return
                }
            }

            let now = Date.now()
            let durationms = min ? min * 60 * 1000 : null
            let counts = 0

            try {
                while (amount > 0) {
                    let batch = Math.min(amount, 100)
                    let messages = await interaction.channel.messages.fetch({ limit: batch })

                    if (messages.size === 0) {
                        break
                    }

                    let todelete = messages.filter(message => {
                        if (onlybot) {
                            if (!message.author.bot) {
                                return false
                            }
                        }

                        if (target) {
                            if (message.author.id !== target.id) {
                                return false
                            }
                        }

                        if (keyword) {
                            if (!message.content.includes(keyword)) {
                                return false
                            }
                        }

                        if (durationms) {
                            if ((now - message.createdTimestamp) > durationms) {
                                return false
                            }
                        }

                        return true
                    })

                    if (todelete.size === 0) {
                        break
                    }

                    await interaction.channel.bulkDelete(todelete, true)
                    counts += todelete.size
                    amount -= todelete.size
                }

                if (target) {
                    const tag = target.user ? target.user.tag : target.tag
                    await Ephemeral(interaction, `deleted ${counts} messages from ${tag}`)
                    await OnSendChannel(interaction.channel, `deleted ${counts} messages from ${tag}`)
                } else {
                    await Ephemeral(interaction, `deleted ${counts} messages`)
                    await OnSendChannel(interaction.channel, `deleted ${counts} messages`)
                }
            } catch (error) {
                console.error(error)
                await Ephemeral(interaction, `failed to delete messages: ${error}`)
            }
        }
    }),

    CreateCommand({
        name: 'clearwarning',
        description: 'user to clear warning',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user',
            required: true
        }],
        permissions: PermissionFlagsBits.ManageMessages,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null)

            if (!target) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            if (LinkWarnings.has(target.id)) {
                LinkWarnings.delete(target.id)

                let warnings = ReadLinkWarning()
                delete warnings[target.id]
                WriteLinkWarning(warnings)

                await Ephemeral(interaction, `cleared warnings for <@${target.id}>`)
                await OnSendChannel(interaction.channel, `warnings for <@${target.id}> have been cleared`)
            } else {
                await Ephemeral(interaction, `<@${target.id}> has no warnings`)
            }
        }
    }),

    CreateCommand({
        name: 'listwarning',
        description: 'list user warnings',
        permissions: PermissionFlagsBits.ManageMessages,
        handler: async(interaction) => {
            let warnings = ReadLinkWarning()
            let ids = Object.keys(warnings)

            if (ids.length === 0) {
                await Ephemeral(interaction, 'no users currently have warnings')
                return
            }

            let list = ''
            for (const id of ids) {
                list += `<@${id}> \`${warnings[id]}\`\n`
            }

            await Ephemeral(interaction, list)
        }
    }),

    CreateCommand({
        name: 'anti-link',
        description: 'disable links',
        permissions: PermissionFlagsBits.ManageMessages,
        handler: async(interaction) => {
            AntiLinkEnabled = !AntiLinkEnabled
            if (AntiLinkEnabled) {
                await Ephemeral(interaction, 'anti-link enabled')
            } else {
                await Ephemeral(interaction, 'anti-link disabled')
            }
        }
    }),

    CreateCommand({
        name: 'auto-purge',
        description: "automatically delete a user's messages",
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to auto purge',
            required: true
        }],
        permissions: PermissionFlagsBits.ManageMessages,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!target) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            if (target.id === Allowed) {
                await Ephemeral(interaction, 'you cannot auto purge yourself (owner is ignored)')
                return
            }

            if (AutoPurgeUsers.has(target.id)) {
                AutoPurgeUsers.delete(target.id)
                await Ephemeral(interaction, `disabled auto purge for <@${target.id}>`)
                await OnSendChannel(interaction.channel, `auto purge disabled for <@${target.id}>`)
                return
            }

            AutoPurgeUsers.add(target.id)
            await Ephemeral(interaction, `enabled auto purge for <@${target.id}>`)
            await OnSendChannel(interaction.channel, `auto purge enabled for <@${target.id}>`)
        }
    }),

    CreateCommand({
        name: 'impersonate',
        description: 'send a message pretending to be another user',
        options: [{
                type: 'user',
                name: 'user',
                description: 'the user to impersonate',
                required: true
            },
            {
                type: 'string',
                name: 'message',
                description: 'the message to send',
                required: true
            }
        ],
        permissions: 0,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!target) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const message = interaction.options.getString('message')

            try {
                const webhooks = await interaction.channel.fetchWebhooks()
                let webhook = webhooks.find(found => found.name === 'impersonator')

                if (!webhook) {
                    webhook = await interaction.channel.createWebhook({
                        name: 'impersonator'
                    })
                }

                await webhook.send({
                    content: message,
                    username: target.displayName,
                    avatarURL: target.user.displayAvatarURL({
                        dynamic: true
                    }),
                    allowedMentions: {
                        parse: []
                    }
                })

                await Ephemeral(interaction, `impersonated <@${target.id}>`)
            } catch (error) {
                await Ephemeral(interaction, `failed to impersonate: ${error}`)
            }
        }
    }),

    CreateCommand({
        name: 'penis',
        description: 'check how long someone penis is',
        options: [{
                type: 'user',
                name: 'user',
                description: 'the user to check',
                required: false
            },
            {
                type: 'integer',
                name: 'size',
                description: 'optional',
                required: false
            }
        ],
        permissions: 0,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null) || interaction.member
            const inputsize = interaction.options.getInteger('size')
            const size = inputsize || Math.floor(Math.random() * 30) + 1

            try {
                await interaction.channel.send(`<@${target.id}> penis: 8${'='.repeat(size)}D`)
                await Ephemeral(interaction, `<@${target.id}> penis size is ${size}`)
            } catch (error) {
                await Ephemeral(interaction, `failed to send penis size: ${error}`)
            }
        }
    }),

    CreateCommand({
        name: 'howgay',
        description: 'check how gay someone is',
        options: [{
                type: 'user',
                name: 'user',
                description: 'the user to check',
                required: false
            },
            {
                type: 'integer',
                name: 'percent',
                description: 'optional',
                required: false
            }
        ],
        permissions: 0,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null) || interaction.member
            const inputPercent = interaction.options.getInteger('percent')
            const percent = inputPercent !== null && inputPercent !== undefined ? Math.min(Math.max(inputPercent, 0), 100) : Math.floor(Math.random() * 101)

            try {
                await interaction.channel.send(`<@${target.id}> is ${percent}% gay`)
                await Ephemeral(interaction, `<@${target.id}> is ${percent}% gay`)
            } catch (error) {
                await Ephemeral(interaction, `failed to send result: ${error}`)
            }
        }
    }),

    CreateCommand({
        name: 'howlesbian',
        description: 'check how lesbian someone is',
        options: [{
                type: 'user',
                name: 'user',
                description: 'the user to check',
                required: false
            },
            {
                type: 'integer',
                name: 'percent',
                description: 'optional',
                required: false
            }
        ],
        permissions: 0,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null) || interaction.member
            const inputPercent = interaction.options.getInteger('percent')
            const percent = inputPercent !== null && inputPercent !== undefined ? Math.min(Math.max(inputPercent, 0), 100) : Math.floor(Math.random() * 101)

            try {
                await interaction.channel.send(`<@${target.id}> is ${percent}% lesbian`)
                await Ephemeral(interaction, `<@${target.id}> is ${percent}% lesbian`)
            } catch (error) {
                await Ephemeral(interaction, `failed to send result: ${error}`)
            }
        }
    }),

    CreateCommand({
        name: 'howretarded',
        description: 'check how retarded someone is',
        options: [{
                type: 'user',
                name: 'user',
                description: 'the user to check',
                required: false
            },
            {
                type: 'integer',
                name: 'percent',
                description: 'optional',
                required: false
            }
        ],
        permissions: 0,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null) || interaction.member
            const inputPercent = interaction.options.getInteger('percent')
            const percent = inputPercent !== null && inputPercent !== undefined ? Math.min(Math.max(inputPercent, 0), 100) : Math.floor(Math.random() * 101)

            try {
                await interaction.channel.send(`<@${target.id}> is ${percent}% retarded`)
                await Ephemeral(interaction, `<@${target.id}> is ${percent}% retarded`)
            } catch (error) {
                await Ephemeral(interaction, `failed to send result: ${error}`)
            }
        }
    }),

    CreateCommand({
        name: 'lockdown',
        description: 'lock a specific channel or the current one',
        options: [{
            type: 'string',
            name: 'channel',
            description: 'channel id (leave empty for current)',
            required: false
        }],
        permissions: 0,
        handler: async(interaction) => {
            const everyonerole = interaction.guild.roles.everyone
            let channelid = interaction.options.getString('channel')
            let chat = null

            if (channelid) {
                chat = interaction.guild.channels.cache.get(channelid)
            } else {
                chat = interaction.channel
            }

            if (!chat || !chat.isTextBased()) {
                await Ephemeral(interaction, `invalid channel`)
                return
            }

            try {
                const overwrite = chat.permissionOverwrites.cache.get(everyonerole.id)
                const islocked = overwrite ? overwrite.deny.has('SendMessages') : false
                if (islocked) {
                    await interaction.channel.send({
                        embeds: [{
                            description: `${chat} is already locked`,
                            color: 0xfff0f5
                        }]
                    })
                    await Ephemeral(interaction, `${chat.name} is already locked`)
                    return
                }

                await chat.permissionOverwrites.edit(everyonerole, {
                    SendMessages: false
                })
                await interaction.channel.send({
                    embeds: [{
                        description: `locked ${chat}`,
                        color: 0xfff0f5
                    }]
                })
                await Ephemeral(interaction, `locked ${chat.name}`)
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'unlockdown',
        description: 'unlock a specific channel or the current one',
        options: [{
            type: 'string',
            name: 'channel',
            description: 'channel id (leave empty for current)',
            required: false
        }],
        permissions: 0,
        handler: async(interaction) => {
            const everyonerole = interaction.guild.roles.everyone
            let channelid = interaction.options.getString('channel')
            let chat = null

            if (channelid) {
                chat = interaction.guild.channels.cache.get(channelid)
            } else {
                chat = interaction.channel
            }

            if (!chat || !chat.isTextBased()) {
                await Ephemeral(interaction, `invalid channel`)
                return
            }

            try {
                const overwrite = chat.permissionOverwrites.cache.get(everyonerole.id)
                const islocked = overwrite ? overwrite.deny.has('SendMessages') : false
                if (!islocked) {
                    await interaction.channel.send({
                        embeds: [{
                            description: `${chat} is not locked`,
                            color: 0xfff0f5
                        }]
                    })
                    await Ephemeral(interaction, `${chat.name} is not locked`)
                    return
                }

                await chat.permissionOverwrites.edit(everyonerole, {
                    SendMessages: true
                })
                await interaction.channel.send({
                    embeds: [{
                        description: `unlocked ${chat}`,
                        color: 0xfff0f5
                    }]
                })
                await Ephemeral(interaction, `unlocked ${chat.name}`)
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'lockdown-all',
        description: 'lock all text channels for neutral role',
        options: [],
        permissions: 0,
        handler: async(interaction) => {
            const role = interaction.guild.roles.cache.get('1424087217260986540')
            if (!role) {
                await Ephemeral(interaction, `role not found`)
                return
            }
            try {
                let changed = 0
                for (const chat of interaction.guild.channels.cache.values()) {
                    if (chat.type === 0 || chat.type === 15) {
                        if (chat.type === 5) {
                            continue
                        }
                        const overwrite = chat.permissionOverwrites.cache.get(role.id)
                        const islocked = overwrite ? overwrite.deny.has(PermissionsBitField.Flags.SendMessages) : false
                        if (islocked === true) {
                            continue
                        }
                        await chat.permissionOverwrites.edit(role, {
                            SendMessages: false,
                            ViewChannel: true
                        })
                        changed++
                    }
                }
                await interaction.channel.send({
                    embeds: [{
                        description: `locked ${changed} channels`,
                        color: 0xfff0f5
                    }]
                })
                await Ephemeral(interaction, `locked ${changed} channels`)
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'unlockdown-all',
        description: 'unlock all text channels for neutral role',
        options: [],
        permissions: 0,
        handler: async(interaction) => {
            const role = interaction.guild.roles.cache.get('1424087217260986540')
            if (!role) {
                await Ephemeral(interaction, `role not found`)
                return
            }
            try {
                let changed = 0
                for (const chat of interaction.guild.channels.cache.values()) {
                    if (chat.type === 0 || chat.type === 15) {
                        if (chat.type === 5) {
                            continue
                        }
                        const overwrite = chat.permissionOverwrites.cache.get(role.id)
                        const islocked = overwrite ? overwrite.deny.has(PermissionsBitField.Flags.SendMessages) : false
                        if (islocked === false) {
                            continue
                        }

                        await chat.permissionOverwrites.edit(role, {
                            SendMessages: null
                        })
                        changed++
                    }
                }
                await interaction.channel.send({
                    embeds: [{
                        description: `unlocked ${changed} channels`,
                        color: 0xfff0f5
                    }]
                })
                await Ephemeral(interaction, `unlocked ${changed} channels`)
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'role-permission',
        description: 'edit channel permissions for a role (except announcements)',
        options: [{
                type: 'role',
                name: 'role',
                description: 'role to edit permissions',
                required: true
            },
            {
                type: 'string',
                name: 'type',
                description: 'channel type to edit: text / voice / stage / all',
                required: true
            },
            {
                type: 'string',
                name: 'sendmessages',
                description: 'permission for SendMessages: true / false / null / default',
                required: true
            },
            {
                type: 'string',
                name: 'viewchannel',
                description: 'permission for ViewChannel: true / false / null / default',
                required: true
            },
            {
                type: 'string',
                name: 'connect',
                description: 'permission for Connect (voice): true / false / null / default',
                required: false
            },
            {
                type: 'string',
                name: 'speak',
                description: 'permission for Speak (voice): true / false / null / default',
                required: false
            }
        ],
        permissions: 0,
        handler: async(interaction) => {
            const role = interaction.options.getRole('role')
            const typeOption = interaction.options.getString('type')
                .toLowerCase()

            const sendmsesageraw = interaction.options.getString('sendmessages')
            const sendmessage = sendmsesageraw ? sendmsesageraw.toLowerCase() : undefined

            const viewchannelraw = interaction.options.getString('viewchannel')
            const viewchannel = viewchannelraw ? viewchannelraw.toLowerCase() : undefined

            const connectraw = interaction.options.getString('connect')
            const connect = connectraw ? connectraw.toLowerCase() : undefined

            const speakraw = interaction.options.getString('speak')
            const speak = speakraw ? speakraw.toLowerCase() : undefined

            if (interaction.user.id !== Allowed) {
                await Ephemeral(interaction, 'you cannot use this command');
                return;
            }

            if (!role) {
                await Ephemeral(interaction, `role not found`)
                return
            }

            let typesToEdit = []

            if (typeOption === 'text') {
                typesToEdit = [0, 15]
            } else if (typeOption === 'voice') {
                typesToEdit = [2]
            } else if (typeOption === 'stage') {
                typesToEdit = [13]
            } else if (typeOption === 'all') {
                typesToEdit = [0, 2, 13, 15]
            } else {
                await Ephemeral(interaction, `invalid channel type`)
                return
            }

            const perms = {
                SendMessages: sendmsesageraw,
                ViewChannel: viewchannelraw,
                Connect: connectraw,
                Speak: speakraw
            }

            try {
                let changed = 0
                for (const channel of interaction.guild.channels.cache.values()) {
                    if (typesToEdit.includes(channel.type)) {
                        if (channel.type === 5) {
                            continue
                        }

                        const current = channel.permissionOverwrites.cache.get(role.id)
                        const final = {}

                        for (const key of Object.keys(perms)) {
                            if (!perms[key] || perms[key] === 'default') {
                                if (current) {
                                    final[key] = current.allow.has(PermissionsBitField.Flags[key]) ? true : null
                                } else {
                                    final[key] = null
                                }
                            } else if (perms[key] === 'true') {
                                final[key] = true
                            } else if (perms[key] === 'false') {
                                final[key] = false
                            } else if (perms[key] === 'null') {
                                final[key] = null
                            }
                        }

                        await channel.permissionOverwrites.edit(role, final)
                        changed++
                    }
                }

                await interaction.channel.send({
                    embeds: [{
                        description: `updated permissions for ${role.name} on ${changed} channels`,
                        color: 0xfff0f5
                    }]
                })
                await Ephemeral(interaction, `updated permissions for ${role.name} on ${changed} channels`)
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'role-add',
        description: 'give a role to a user',
        options: [{
                type: 'user',
                name: 'user',
                description: 'user to add role to',
                required: true
            },
            {
                type: 'role',
                name: 'role',
                description: 'role to add',
                required: true
            }
        ],
        permissions: 0,
        handler: async(interaction) => {
            const member = interaction.options.getMember('user')
            const role = interaction.options.getRole('role')

            try {
                if (member.roles.cache.has(role.id)) {
                    await interaction.channel.send({
                        embeds: [{
                            description: `${member} already has the **${role.name}** role`,
                            color: 0xfff0f5
                        }]
                    })
                    await Ephemeral(interaction, `${member} already has the ${role.name} role`)
                    return
                }

                await member.roles.add(role)
                await interaction.channel.send({
                    embeds: [{
                        description: `added the **${role.name}** role to ${member}`,
                        color: 0xfff0f5
                    }]
                })
                await Ephemeral(interaction, `added the ${role.name} role to ${member}`)
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'role-remove',
        description: 'remove a role from a user',
        options: [{
                type: 'user',
                name: 'user',
                description: 'user to remove role from',
                required: true
            },
            {
                type: 'role',
                name: 'role',
                description: 'role to remove',
                required: true
            }
        ],
        permissions: 0,
        handler: async(interaction) => {
            const member = interaction.options.getMember('user')
            const role = interaction.options.getRole('role')

            try {
                if (!member.roles.cache.has(role.id)) {
                    await interaction.channel.send({
                        embeds: [{
                            description: `${member} does not have the **${role.name}** role`,
                            color: 0xfff0f5
                        }]
                    })
                    await Ephemeral(interaction, `${member} does not have the ${role.name} role`)
                    return
                }

                await member.roles.remove(role)
                await interaction.channel.send({
                    embeds: [{
                        description: `removed the **${role.name}** role from ${member}`,
                        color: 0xfff0f5
                    }]
                })
                await Ephemeral(interaction, `removed the ${role.name} role from ${member}`)
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'websearch',
        description: 'search for a website and show a clickable button',
        options: [{
            type: 'string',
            name: 'site',
            description: 'website URL or domain',
            required: true
        }],
        permissions: 0,
        handler: async(interaction) => {
            const input = interaction.options.getString('site')
                .trim();

            const isip = /^(\d{1,3}\.){3}\d{1,3}$/.test(input);

            let url;
            if (isip) {
                url = 'https://www.google.com';
            } else if (!input.startsWith('http://') && !input.startsWith('https://')) {
                url = `https://www.${input.replace(/^www\./, '')}`;
            } else {
                url = input;
            }

            try {
                await interaction.channel.send({
                    components: [
                        new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                            .setLabel('Open Url')
                            .setStyle(ButtonStyle.Link)
                            .setURL(url)
                        )
                    ]
                });

                await Ephemeral(interaction, `website button created for \`${input}\``);
            } catch (error) {
                await Ephemeral(interaction, `failed to create website button: ${error.message}`);
            }
        }
    }),

    CreateCommand({
        name: 'avatar',
        description: 'show the avatar of a user',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to show avatar for',
            required: false
        }],
        permissions: 0,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null) || interaction.user

            try {
                const user = await interaction.client.users.fetch(target.id, {
                    force: true
                })
                const avatarurl = user.displayAvatarURL({
                    dynamic: true,
                    size: 1024
                })

                await interaction.channel.send({
                    embeds: [{
                        title: `${user.tag}'s avatar`,
                        color: 0xfff0f5,
                        image: {
                            url: avatarurl
                        }
                    }],
                    components: [
                        new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                            .setLabel('open url')
                            .setStyle(ButtonStyle.Link)
                            .setURL(avatarurl)
                        )
                    ]
                })

                await Ephemeral(interaction, `avatar displayed for <@${user.id}>`)
            } catch (error) {
                await Ephemeral(interaction, `failed to get avatar: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'banner',
        description: 'show the banner of a user',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to show banner for',
            required: false
        }],
        permissions: 0,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null) || interaction.user

            try {
                const user = await interaction.client.users.fetch(target.id, {
                    force: true
                })
                const bannerurl = user.bannerURL({
                    dynamic: true,
                    size: 1024
                })

                if (!bannerurl) {
                    await interaction.channel.send({
                        embeds: [{
                            title: `${user.tag}'s banner`,
                            color: 0xfff0f5,
                            description: 'no banner available'
                        }]
                    })
                } else {
                    await interaction.channel.send({
                        embeds: [{
                            title: `${user.tag}'s banner`,
                            color: 0xfff0f5,
                            image: {
                                url: bannerurl
                            }
                        }],
                        components: [
                            new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                .setLabel('open url')
                                .setStyle(ButtonStyle.Link)
                                .setURL(bannerurl)
                            )
                        ]
                    })
                }

                await Ephemeral(interaction, `banner displayed for <@${user.id}>`)
            } catch (error) {
                await Ephemeral(interaction, `failed to get banner: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'user-info',
        description: 'show server info about a user',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to get info for',
            required: false
        }],
        permissions: 0,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null) || interaction.member;
            if (!target) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            try {
                const roles = []
                target.roles.cache.forEach(role => {
                    if (role.id !== interaction.guild.id) roles.push(role.name)
                })

                const date = `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`
                const nickname = target.nickname || 'none'
                const rolesText = roles.length > 0 ? roles.join(', ') : 'none'

                await interaction.channel.send({
                    embeds: [{
                        title: `User Info for ${target.user.tag}`,
                        color: 0xfff0f5,
                        fields: [{
                                name: 'Nickname',
                                value: nickname,
                                inline: true
                            },
                            {
                                name: 'Joined',
                                value: date,
                                inline: true
                            },
                            {
                                name: 'Roles',
                                value: `\`\`\`${rolesText}\`\`\``,
                                inline: false
                            }
                        ]
                    }]
                })

                await Ephemeral(interaction, `info displayed for ${target.user.tag}`)
            } catch (error) {
                await Ephemeral(interaction, `failed to get user info: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'slowmode',
        description: 'set slowmode',
        options: [{
            type: 'integer',
            name: 'seconds',
            description: 'slowmode in seconds',
            required: true
        }],
        permissions: PermissionFlagsBits.ManageChannels,
        handler: async(interaction) => {
            const seconds = interaction.options.getInteger('seconds');
            if (seconds < 0 || seconds > 21600) return await Ephemeral(interaction, 'slowmode must be 0-21600 seconds');

            try {
                await interaction.channel.setRateLimitPerUser(seconds);
                await Ephemeral(interaction, `slowmode set to ${seconds} seconds`);
                await OnSendChannel(interaction.channel, `slowmode set to ${seconds} seconds`);
            } catch (error) {
                await Ephemeral(interaction, `failed to set slowmode: ${error.message}`);
            }
        }
    }),

    CreateCommand({
        name: 'role-info',
        description: 'show info about a role',
        options: [{
            type: 'role',
            name: 'role',
            description: 'select a role',
            required: true
        }],
        permissions: 0,
        handler: async(interaction) => {
            const role = interaction.options.getRole('role');
            if (!role) {
                return await Ephemeral(interaction, 'role not found');
            }

            const createdDate = `<t:${Math.floor(role.createdTimestamp / 1000)}:F>`;
            const members = role.members.map(member => member.user.tag)
                .slice(0, 25)
                .join('\n') || 'No members';

            await interaction.channel.send({
                embeds: [{
                    title: `Role Info: ${role.name}`,
                    color: 0xfff0f5,
                    fields: [{
                            name: 'ID',
                            value: role.id,
                            inline: true
                        },
                        {
                            name: 'Name',
                            value: role.name,
                            inline: true
                        },
                        {
                            name: 'Mention',
                            value: `<@&${role.id}>`,
                            inline: true
                        },
                        {
                            name: 'Position',
                            value: role.position.toString(),
                            inline: true
                        },
                        {
                            name: 'Mentionable',
                            value: role.mentionable ? 'Yes' : 'No',
                            inline: true
                        },
                        {
                            name: 'Managed',
                            value: role.managed ? 'Yes' : 'No',
                            inline: true
                        },
                        {
                            name: 'Role Created',
                            value: createdDate,
                            inline: true
                        }
                    ]
                }]
            });

            await Ephemeral(interaction, `info displayed for role ${role.name}`);
        }
    }),

    CreateCommand({
        name: 'embed',
        description: 'embed',
        options: [{
            type: 'string',
            name: 'text',
            description: 'say',
            required: true
        }],
        permissions: PermissionFlagsBits.ManageMessages,
        handler: async(interaction) => {
            let text = interaction.options.getString('text');
            try {
                await interaction.channel.send({
                    embeds: [{
                        color: 0xfff0f5,
                        description: `\`\`\`\n${text}\n\`\`\``
                    }]
                });
                await Ephemeral(interaction, `sent your message in an embed`);
            } catch (error) {
                await Ephemeral(interaction, `failed to send the message: ${error}`);
            }
        }
    }),

    CreateCommand({
        name: 'say',
        description: 'say',
        options: [{
            type: 'string',
            name: 'text',
            description: 'say',
            required: true
        }],
        permissions: PermissionFlagsBits.ManageMessages,
        handler: async(interaction) => {
            let text = interaction.options.getString('text');
            try {
                await interaction.channel.send(text);
                await Ephemeral(interaction, `said: ${text}`);
            } catch (error) {
                await Ephemeral(interaction, `failed to send the message: ${error}`);
            }
        }
    }),

    CreateCommand({
        name: 'mock',
        description: 'mock someone by alternating caps',
        options: [{
            type: 'string',
            name: 'text',
            description: 'text to mock',
            required: true
        }],
        permissions: 0,
        handler: async(interaction) => {
            const text = interaction.options.getString('text');
            let mocked = '';
            for (let index = 0; index < text.length; index++) {
                mocked += index % 2 === 0 ? text[index].toLowerCase() : text[index].toUpperCase();
            }
            try {
                await interaction.channel.send(mocked);
                await Ephemeral(interaction, 'mocked text sent');
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`);
            }
        }
    }),

    CreateCommand({
        name: 'reverse',
        description: 'reverse your text',
        options: [{
            type: 'string',
            name: 'text',
            description: 'text to reverse',
            required: true
        }],
        permissions: 0,
        handler: async(interaction) => {
            const text = interaction.options.getString('text');
            const reversed = text.split('')
                .reverse()
                .join('');
            try {
                await interaction.channel.send(reversed);
                await Ephemeral(interaction, 'reversed text sent');
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`);
            }
        }
    }),

    CreateCommand({
        name: 'spam-text',
        description: 'spam your text multiple times',
        options: [{
            type: 'string',
            name: 'text',
            description: 'text to spam',
            required: true
        }, {
            type: 'integer',
            name: 'amount',
            description: 'how many times to spam',
            required: true
        }],
        permissions: 0,
        handler: async(interaction) => {
            const text = interaction.options.getString('text');
            const amount = interaction.options.getInteger('amount');
            try {
                for (let index = 0; index < amount; index++) {
                    await interaction.channel.send(text);
                    await new Promise(r => setTimeout(r, 100));
                }
                await Ephemeral(interaction, `spammed ${amount} times`);
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`);
            }
        }
    }),

    CreateCommand({
        name: 'mock-text',
        description: 'repeat your text in random capitalization',
        options: [{
            type: 'string',
            name: 'text',
            description: 'text to randomize',
            required: true
        }],
        permissions: 0,
        handler: async(interaction) => {
            const text = interaction.options.getString('text');
            let randomized = '';
            for (let index = 0; index < text.length; index++) {
                randomized += Math.random() > 0.5 ? text[index].toLowerCase() : text[index].toUpperCase();
            }
            try {
                await interaction.channel.send(randomized);
                await Ephemeral(interaction, 'randomized text sent');
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`);
            }
        }
    }),

    CreateCommand({
        name: 'say-morse',
        description: 'convert your text to morse code',
        options: [{
            type: 'string',
            name: 'text',
            description: 'text to convert',
            required: true
        }],
        permissions: 0,
        handler: async(interaction) => {
            const morsecode = {
                a: '.-',
                b: '-...',
                c: '-.-.',
                d: '-..',
                e: '.',
                f: '..-.',
                g: '--.',
                h: '....',
                i: '..',
                j: '.---',
                k: '-.-',
                l: '.-..',
                m: '--',
                n: '-.',
                o: '---',
                p: '.--.',
                q: '--.-',
                r: '.-.',
                s: '...',
                t: '-',
                u: '..-',
                v: '...-',
                w: '.--',
                x: '-..-',
                y: '-.--',
                z: '--..',
                0: '-----',
                1: '.----',
                2: '..---',
                3: '...--',
                4: '....-',
                5: '.....',
                6: '-....',
                7: '--...',
                8: '---..',
                9: '----.',
                ' ': '/',
                '.': '.-.-.-',
                ',': '--..--',
                '?': '..--..',
                '!': '-.-.--'
            };

            const text = interaction.options.getString('text')
                .toLowerCase();
            let morse = '';
            for (let index = 0; index < text.length; index++) {
                morse += morsecode[text[index]] ? morsecode[text[index]] + ' ' : '';
            }

            try {
                await interaction.channel.send(morse.trim());
                await Ephemeral(interaction, 'converted to morse code');
            } catch (error) {
                await Ephemeral(interaction, `failed: ${error.message}`);
            }
        }
    }),

    CreateCommand({
        name: 'spam-ping',
        description: 'spam ping a user a specified number of times',
        options: [{
                type: 'user',
                name: 'user',
                description: 'user to ping',
                required: true
            },
            {
                type: 'integer',
                name: 'amount',
                description: 'number of pings',
                required: true
            },
            {
                type: 'string',
                name: 'text',
                description: 'text to send before ping',
                required: false
            }
        ],
        permissions: 0,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const user = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!user) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const amount = interaction.options.getInteger('amount')
            const text = interaction.options.getString('text') || ''

            if (amount < 1) {
                await Ephemeral(interaction, 'amount must be at least 1')
                return
            }

            if (amount > 50) {
                await Ephemeral(interaction, 'amount too high, max 50')
                return
            }

            await Ephemeral(interaction, `spamming <@${user.id}> ${amount} times`)

            for (let index = 0; index < amount; index++) {
                try {
                    await interaction.channel.send(`${text} <@${user.id}>`)
                } catch (error) {
                    await Ephemeral(interaction, `failed to ping: ${error}`)
                    break
                }
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }
    }),

    CreateCommand({
        name: 'timeout',
        description: 'timeout a user for a duration (e.g., 5s, 10m, 1h, 1d, 2w)',
        options: [{
                type: 'user',
                name: 'user',
                description: 'user to timeout',
                required: true
            },
            {
                type: 'string',
                name: 'duration',
                description: 'duration like 5s,10m,1h,1d,2w',
                required: true
            }
        ],
        permissions: PermissionFlagsBits.ModerateMembers,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const durationinput = interaction.options.getString('duration')

            const min = IntDuration(durationinput)
            if (min === null) {
                await Ephemeral(interaction, 'invalid duration. use formats like 5s, 10m, 1h, 1d, 2w (max 3w)')
                return
            }

            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)
            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            if (member.id === interaction.guild.ownerId) {
                await Ephemeral(interaction, 'cannot perform action against the server owner')
                return
            }

            if (member.roles.highest.position >= botmember.roles.highest.position) {
                await Ephemeral(interaction, 'cannot perform action due to role hierarchy')
                return
            }

            try {
                await member.timeout(min, `timed out by ${interaction.user.tag}`)
                await Ephemeral(interaction, `<@${member.id}> has been timed out for ${durationinput}`)
                await OnSendChannel(interaction.channel, `<@${member.id}> has been timed out for ${durationinput}`)
            } catch (error) {
                await Ephemeral(interaction, `failed to timeout <@${member.id}>: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'untimeout',
        description: 'remove timeout from a user',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to untimeout',
            required: true
        }],
        permissions: PermissionFlagsBits.ModerateMembers,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')

            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)
            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            if (member.id === interaction.guild.ownerId) {
                await Ephemeral(interaction, 'cannot perform action against the server owner')
                return
            }

            if (member.roles.highest.position >= botmember.roles.highest.position) {
                await Ephemeral(interaction, 'cannot perform action due to role hierarchy')
                return
            }

            try {
                await member.timeout(null, `untimeout by ${interaction.user.tag}`)
                await Ephemeral(interaction, `<@${member.id}> has been un-timed out`)
                await OnSendChannel(interaction.channel, `<@${member.id}> has been un-timed out`)
            } catch (error) {
                await Ephemeral(interaction, `failed to untimeout <@${member.id}>: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'kick',
        description: 'kick a user',
        options: [{
                type: 'user',
                name: 'user',
                description: 'user to kick',
                required: true
            },
            {
                type: 'string',
                name: 'reason',
                description: 'reason',
                required: false
            }
        ],
        permissions: PermissionFlagsBits.KickMembers,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const reason = interaction.options.getString('reason') || 'no reason provided'

            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)
            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            if (member.id === interaction.guild.ownerId) {
                await Ephemeral(interaction, 'cannot perform action against the server owner')
                return
            }

            if (member.roles.highest.position >= botmember.roles.highest.position) {
                await Ephemeral(interaction, 'cannot perform action due to role hierarchy')
                return
            }

            try {
                await member.kick(reason)
                await Ephemeral(interaction, `<@${member.id}> has been kicked: ${reason}`)
                await OnSendChannel(interaction.channel, `<@${member.id}> has been kicked: ${reason}`)
            } catch (error) {
                await Ephemeral(interaction, `failed to kick <@${member.id}>: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'ban',
        description: 'ban a user (optionally delete messages days 0-7)',
        options: [{
                type: 'user',
                name: 'user',
                description: 'user to ban',
                required: true
            },
            {
                type: 'integer',
                name: 'days',
                description: 'delete messages from the last n days (0-7)',
                required: false
            },
            {
                type: 'string',
                name: 'reason',
                description: 'reason',
                required: false
            }
        ],
        permissions: PermissionFlagsBits.BanMembers,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const days = interaction.options.getInteger('days') || 0
            const reason = interaction.options.getString('reason') || 'no reason provided'

            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            if (days < 0) {
                await Ephemeral(interaction, 'days must be between 0 and 7')
                return
            }

            if (days > 7) {
                await Ephemeral(interaction, 'days must be between 0 and 7')
                return
            }

            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)
            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            if (member.id === interaction.guild.ownerId) {
                await Ephemeral(interaction, 'cannot perform action against the server owner')
                return
            }

            if (member.roles.highest.position >= botmember.roles.highest.position) {
                await Ephemeral(interaction, 'cannot perform action due to role hierarchy')
                return
            }

            try {
                await interaction.guild.members.ban(member.id, {
                    deleteMessageSeconds: days * 24 * 60 * 60,
                    reason: reason
                })

                await Ephemeral(interaction, `<@${member.id}> has been banned: ${reason}`)
                await OnSendChannel(interaction.channel, `<@${member.id}> has been banned: ${reason}`)
            } catch (error) {
                await Ephemeral(interaction, `failed to ban <@${member.id}>: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'unban',
        description: 'unban a user by id or username',
        options: [{
                type: 'string',
                name: 'user',
                description: 'user to unban',
                required: true
            },
            {
                type: 'string',
                name: 'reason',
                description: 'reason for unban',
                required: false
            }
        ],
        permissions: PermissionFlagsBits.BanMembers,
        handler: async(interaction) => {
            const useroption = interaction.options.getString('user')
            const reason = interaction.options.getString('reason') || 'no reason provided'

            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, `user not found`)
                return
            }

            try {
                const bans = await interaction.guild.bans.fetch()
                const banned = bans.get(member.id)
                if (!banned) {
                    await Ephemeral(interaction, `user is not banned`)
                    return
                }

                await interaction.guild.members.unban(member.id, reason)
                await Ephemeral(interaction, `<@${member.id}> has been unbanned: ${reason}`)
                await OnSendChannel(interaction.channel, `<@${member.id}> has been unbanned: ${reason}`)
            } catch (error) {
                await Ephemeral(interaction, `failed to unban user: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'softban',
        description: 'softban (ban then unban to purge messages)',
        options: [{
                type: 'user',
                name: 'user',
                description: 'user to softban',
                required: true
            },
            {
                type: 'integer',
                name: 'days',
                description: 'delete messages from last n days (0-7)',
                required: false
            },
            {
                type: 'string',
                name: 'reason',
                description: 'reason',
                required: false
            }
        ],
        permissions: PermissionFlagsBits.BanMembers,
        handler: async function(interaction) {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!target) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const days = interaction.options.getInteger('days') || 0
            const reason = interaction.options.getString('reason') || 'no reason provided'

            if (days < 0 || days > 7) {
                await Ephemeral(interaction, 'days must be between 0 and 7')
                return
            }

            const member = await interaction.guild.members.fetch(target.id)
                .catch(() => null)
            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)

            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            if (member) {
                if (member.id === interaction.guild.ownerId) {
                    await Ephemeral(interaction, 'cannot perform action against the server owner')
                    return
                }

                if (member.roles.highest.position >= botmember.roles.highest.position) {
                    await Ephemeral(interaction, 'cannot perform action due to role hierarchy')
                    return
                }
            }

            try {
                await interaction.guild.members.ban(target.id, {
                    deleteMessageDays: days,
                    reason
                })
                await interaction.guild.bans.remove(target.id)
                    .catch(() => {})
                await Ephemeral(interaction, `<@${target.id}> has been softbanned: ${reason}`)
                await OnSendChannel(interaction.channel, `<@${target.id}> has been softbanned: ${reason}`)
            } catch (error) {
                await Ephemeral(interaction, `failed to softban <@${target.id}>: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'hardban',
        description: 'hardban (permanent ban, deletes messages)',
        options: [{
                type: 'user',
                name: 'user',
                description: 'user to hardban',
                required: true
            },
            {
                type: 'string',
                name: 'reason',
                description: 'reason',
                required: false
            }
        ],
        permissions: PermissionFlagsBits.BanMembers,
        handler: async function(interaction) {
            const useroption = interaction.options.getUser('user')
            const target = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!target) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const reason = interaction.options.getString('reason') || 'no reason provided'

            const member = await interaction.guild.members.fetch(target.id)
                .catch(() => null)
            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)

            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            if (member) {
                if (member.id === interaction.guild.ownerId) {
                    await Ephemeral(interaction, 'cannot perform action against the server owner')
                    return
                }

                if (member.roles.highest.position >= botmember.roles.highest.position) {
                    await Ephemeral(interaction, 'cannot perform action due to role hierarchy')
                    return
                }
            }

            try {
                await interaction.guild.members.ban(target.id, {
                    deleteMessageDays: 7,
                    reason
                })
                await Ephemeral(interaction, `<@${target.id}> has been hardbanned: ${reason}`)
                await OnSendChannel(interaction.channel, `<@${target.id}> has been hardbanned: ${reason}`)
            } catch (error) {
                await Ephemeral(interaction, `failed to hardban <@${target.id}>: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'lock-role',
        description: 'lock a user by removing all their manageable roles until unlocked',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to lock',
            required: true
        }],
        permissions: PermissionFlagsBits.ManageRoles,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)
            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            if (member.id === interaction.guild.ownerId) {
                await Ephemeral(interaction, 'cannot lock the server owner')
                return
            }

            if (member.roles.highest.position >= botmember.roles.highest.position) {
                await Ephemeral(interaction, 'cannot lock due to role hierarchy')
                return
            }

            const manageroles = member.roles.cache.filter(role => role.editable && role.id !== interaction.guild.id)
            if (!manageroles || manageroles.size === 0) {
                await Ephemeral(interaction, 'no roles to lock')
                return
            }

            const saveroleids = manageroles.map(role => role.id)
                .filter(id => id !== undefined)
            LockedRoles.set(member.id, saveroleids)

            try {
                await member.roles.remove(saveroleids)
                await Ephemeral(interaction, `locked <@${member.id}>`)
                await OnSendChannel(interaction.channel, `<@${member.id}> has been locked`)
            } catch (error) {
                await Ephemeral(interaction, `failed to lock <@${member.id}>: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'unlock-role',
        description: 'restore a locked user roles',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to unlock',
            required: true
        }],
        permissions: PermissionFlagsBits.ManageRoles,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)
            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            if (!LockedRoles.has(member.id)) {
                await Ephemeral(interaction, 'this user is not locked')
                return
            }

            const saveroleids = LockedRoles.get(member.id)
                .filter(id => id !== undefined)
            if (!saveroleids || saveroleids.length === 0) {
                LockedRoles.delete(member.id)
                await Ephemeral(interaction, 'no saved roles to restore')
                return
            }

            if (member.id === interaction.guild.ownerId) {
                await Ephemeral(interaction, 'cannot unlock the server owner')
                return
            }

            if (member.roles.highest.position >= botmember.roles.highest.position) {
                await Ephemeral(interaction, 'cannot unlock due to role hierarchy')
                return
            }

            try {
                await member.roles.add(saveroleids)
                LockedRoles.delete(member.id)
                await Ephemeral(interaction, `unlocked <@${member.id}>`)
                await OnSendChannel(interaction.channel, `<@${member.id}> has been unlocked`)
            } catch (error) {
                await Ephemeral(interaction, `failed to unlock <@${member.id}>: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'force-nickname',
        description: 'force a user to have a specific nickname',
        options: [{
                type: 'user',
                name: 'user',
                description: 'user to force nickname',
                required: true
            },
            {
                type: 'string',
                name: 'nickname',
                description: 'nickname to set',
                required: true
            }
        ],
        permissions: PermissionFlagsBits.ManageNicknames,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const nickname = interaction.options.getString('nickname')
            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)
            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            if (member.id === interaction.guild.ownerId) {
                await Ephemeral(interaction, 'cannot change nickname of server owner')
                return
            }

            if (member.roles.highest.position >= botmember.roles.highest.position) {
                await Ephemeral(interaction, 'cannot change nickname due to role hierarchy')
                return
            }

            ForcedNicknames.set(member.id, nickname)
            const oldnickname = member.nickname || member.user.username

            try {
                await member.setNickname(nickname)
                await Ephemeral(interaction, `nickname changed for <@${member.id}>: ${oldnickname} > ${nickname}`)
                await OnSendChannel(interaction.channel, `nickname changed for <@${member.id}>: ${oldnickname} > ${nickname}`)
            } catch (error) {
                await Ephemeral(interaction, `failed to force nickname: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'unforce-nickname',
        description: 'remove forced nickname from a user',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to remove forced nickname',
            required: true
        }],
        permissions: PermissionFlagsBits.ManageNicknames,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            ForcedNicknames.delete(member.id)

            try {
                await member.setNickname(null)
                await Ephemeral(interaction, `nickname removed for <@${member.id}>`)
                await OnSendChannel(interaction.channel, `nickname removed for <@${member.id}>`)
            } catch (error) {
                await Ephemeral(interaction, `failed to remove nickname: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'strip',
        description: 'remove dangerous roles from a user',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to strip roles from',
            required: true
        }],
        permissions: PermissionFlagsBits.ManageRoles,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)
            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            const removeroles = member.roles.cache.filter(role => {
                if (!role.editable) return false
                const perms = role.permissions
                return perms.has(PermissionFlagsBits.Administrator) ||
                    perms.has(PermissionFlagsBits.KickMembers) ||
                    perms.has(PermissionFlagsBits.BanMembers) ||
                    perms.has(PermissionFlagsBits.ManageChannels) ||
                    perms.has(PermissionFlagsBits.ManageGuild) ||
                    perms.has(PermissionFlagsBits.ManageRoles) ||
                    perms.has(PermissionFlagsBits.ModerateMembers)
            })

            if (removeroles.size === 0) {
                await Ephemeral(interaction, 'no dangerous roles found to strip')
                return
            }

            DangerousRoles.set(member.id, removeroles.map(role => role.id))

            try {
                await member.roles.remove(removeroles)
                await Ephemeral(interaction, `dangerous roles removed for <@${member.id}>`)
                await OnSendChannel(interaction.channel, `dangerous roles removed for <@${member.id}>`)
            } catch (error) {
                await Ephemeral(interaction, `failed to strip roles: ${error.message}`)
            }
        }
    }),

    CreateCommand({
        name: 'unstrip',
        description: 'restore dangerous roles previously removed from a user',
        options: [{
            type: 'user',
            name: 'user',
            description: 'user to restore roles for',
            required: true
        }],
        permissions: PermissionFlagsBits.ManageRoles,
        handler: async(interaction) => {
            const useroption = interaction.options.getUser('user')
            const member = await IDOrUser(interaction, useroption ? useroption.id : null)
            if (!member) {
                await Ephemeral(interaction, 'user not found')
                return
            }

            const botmember = await interaction.guild.members.fetch(client.user.id)
                .catch(() => null)
            if (!botmember) {
                await Ephemeral(interaction, 'bot member fetch failed')
                return
            }

            const restoreroles = DangerousRoles.get(member.id)
            if (!restoreroles || restoreroles.length === 0) {
                await Ephemeral(interaction, 'no stripped roles found for this user')
                return
            }

            try {
                await member.roles.add(restoreroles)
                DangerousRoles.delete(member.id)
                await Ephemeral(interaction, `dangerous roles restored for <@${member.id}>`)
                await OnSendChannel(interaction.channel, `dangerous roles restored for <@${member.id}>`)
            } catch (error) {
                await Ephemeral(interaction, `failed to unstrip roles: ${error.message}`)
            }
        }
    })
]

client.once('clientReady', async() => {
    const CommandData = commands.map(c => c.data.toJSON());
    await client.application.commands.set(CommandData);

    console.log(`logged in as ${client.user.tag}`);
    console.log(`servers: ${client.guilds.cache.size}`);
    console.log(`users: ${client.users.cache.size}`);
    console.log(`commands loaded: ${commands.length}`);

    function generate_ascii(length = 100) {
        let result = '';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        for (let index = 0; index < length; index++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    setInterval(() => {
        const status = generate_ascii(100);
        client.user.setPresence({
            activities: [{
                name: status,
                type: 3
            }],
            status: "dnd"
        });
    }, 10000);
});

client.on('messageCreate', async(message) => {
    if (message.author.bot) {
        return
    }

    if (message.author.id === Allowed) {
        return
    }

    if (AutoPurgeUsers.has(message.author.id)) {
        try {
            await message.delete()
        } catch (error) {
            console.error(`failed to delete message from ${message.author.tag}:`, error)
        }
    }

    if (AntiLinkEnabled) {
        if (!message.member.roles.cache.has('1295378600320827432') && !message.member.roles.cache.has('1423208830463901768')) {
            if (/\b(?:https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})([^\s]*)/i.test(message.content)) {
                try {
                    await message.delete()
                    await OnSendChannel(message.channel, `${message.author}, that link is not allowed`)

                    let count = LinkWarnings.get(message.author.id) || 0
                    count++
                    LinkWarnings.set(message.author.id, count)

                    let warnings = ReadLinkWarning()
                    warnings[message.author.id] = count
                    WriteLinkWarning(warnings)

                    if (count >= 3) {
                        try {
                            await message.member.timeout(24 * 60 * 60 * 1000)
                            await OnSendChannel(message.channel, `${message.author} has been muted for 1 day for repeated link sending`)
                        } catch {}
                        LinkWarnings.delete(message.author.id)

                        let warnings = ReadLinkWarning()
                        delete warnings[message.author.id]
                        WriteLinkWarning(warnings)
                    }
                } catch {}
            }
        }
    }
})

client.on('guildMemberUpdate', async(oldmember, newmember) => {
    if (ForcedNicknames.has(newmember.id)) {
        const isforcing = ForcedNicknames.get(newmember.id)

        if (newmember.nickname !== isforcing) {
            const botmember = await newmember.guild.members.fetch(client.user.id)
                .catch(() => null)
            if (!botmember) {
                return
            }

            if (newmember.roles.highest.position < botmember.roles.highest.position) {
                await newmember.setNickname(isforcing)
                    .catch(() => {})
            }
        }
    }

    if (LockedRoles.has(newmember.id)) {
        const savedroles = LockedRoles.get(newmember.id)
        const currentroles = newmember.roles.cache.filter(role => role.id !== newmember.guild.id)
            .map(role => role.id)
        const extraroles = currentroles.filter(role => !savedroles.includes(role))

        if (extraroles.length > 0) {
            try {
                await newmember.roles.remove(extraroles)
            } catch {}
        }
    }
})

client.on('interactionCreate', async(interaction) => {
    if (!interaction.isChatInputCommand()) {
        return
    }

    const Command = commands.find((command) => command.data.name === interaction.commandName)
    if (!Command) {
        return
    }

    try {
        await Command.execute(interaction)
    } catch (error) {
        await Ephemeral(interaction, `command error: ${error.message}`)
    }
})

client.login(Buffer.from(System.readFileSync('token.txt', 'utf8')
        .trim(), 'base64')
    .toString('utf8'));