import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    Events,
    GatewayIntentBits,
    Message,
    Partials,
    REST,
    Routes,
    SlashCommandBuilder,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    type InteractionReplyOptions,
} from 'discord.js';
import authHandlers from '../../bot/handlers/auth';
import authMiddleware from '../../bot/middleware/auth';
import { config } from '../../config';
import { dispatchAction, dispatchCommand } from '../routes';
import type { BotAttachmentInput, BotContext, BotReplyMarkupButton, BotReplyOptions } from '../../types/bot';

const commandDefinitions = [
    new SlashCommandBuilder().setName('start').setDescription('Welcome message'),
    new SlashCommandBuilder().setName('help').setDescription('Show available commands'),
    new SlashCommandBuilder().setName('login').setDescription('Start Kite login flow'),
    new SlashCommandBuilder().setName('logout').setDescription('Clear saved session'),
    new SlashCommandBuilder().setName('me').setDescription('Show your Kite profile'),
    new SlashCommandBuilder().setName('holdings').setDescription('Show holdings'),
    new SlashCommandBuilder().setName('portfolio').setDescription('Alias for holdings'),
    new SlashCommandBuilder().setName('positions').setDescription('Show positions'),
    new SlashCommandBuilder().setName('balance').setDescription('Show account balance'),
    new SlashCommandBuilder().setName('funds').setDescription('Alias for balance'),
    new SlashCommandBuilder().setName('pfsnapshot').setDescription('Show portfolio snapshot history'),
    new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Place a buy order')
        .addStringOption(option => option.setName('symbol').setDescription('Instrument symbol').setRequired(true))
        .addIntegerOption(option => option.setName('qty').setDescription('Quantity').setRequired(true))
        .addStringOption(option => option.setName('type').setDescription('Order type'))
        .addNumberOption(option => option.setName('price').setDescription('Limit/trigger price'))
        .addStringOption(option => option.setName('product').setDescription('Product, e.g. CNC or MIS')),
    new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Place a sell order')
        .addStringOption(option => option.setName('symbol').setDescription('Instrument symbol').setRequired(true))
        .addIntegerOption(option => option.setName('qty').setDescription('Quantity').setRequired(true))
        .addStringOption(option => option.setName('type').setDescription('Order type'))
        .addNumberOption(option => option.setName('price').setDescription('Limit/trigger price'))
        .addStringOption(option => option.setName('product').setDescription('Product, e.g. CNC or MIS')),
    new SlashCommandBuilder().setName('orders').setDescription('List recent orders'),
    new SlashCommandBuilder()
        .setName('orderstatus')
        .setDescription('Show order status')
        .addStringOption(option => option.setName('order_id').setDescription('Order ID').setRequired(true)),
    new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Show market quote')
        .addStringOption(option => option.setName('instruments').setDescription('Instrument list').setRequired(true)),
    new SlashCommandBuilder()
        .setName('ohlc')
        .setDescription('Show OHLC data')
        .addStringOption(option => option.setName('instruments').setDescription('Instrument list').setRequired(true)),
    new SlashCommandBuilder()
        .setName('ltp')
        .setDescription('Show last traded price')
        .addStringOption(option => option.setName('instruments').setDescription('Instrument list').setRequired(true)),
    new SlashCommandBuilder()
        .setName('chart')
        .setDescription('Render a chart')
        .addStringOption(option => option.setName('instrument').setDescription('Instrument').setRequired(true))
        .addStringOption(option => option.setName('timeframe').setDescription('Timeframe').setRequired(true)),
    new SlashCommandBuilder()
        .setName('watchadd')
        .setDescription('Add instruments to watchlist')
        .addStringOption(option => option.setName('instruments').setDescription('Instrument list').setRequired(true)),
    new SlashCommandBuilder()
        .setName('watchremove')
        .setDescription('Remove instruments from watchlist')
        .addStringOption(option => option.setName('instruments').setDescription('Instrument list').setRequired(true)),
    new SlashCommandBuilder().setName('watchlist').setDescription('View watchlist'),
    new SlashCommandBuilder()
        .setName('instruments')
        .setDescription('Download Kite instruments CSV')
        .addStringOption(option => option.setName('exchange').setDescription('Optional exchange filter')),
    new SlashCommandBuilder().setName('mfholdings').setDescription('Show mutual fund holdings'),
    new SlashCommandBuilder().setName('mutualfunds').setDescription('Alias for mfholdings'),
    new SlashCommandBuilder().setName('mforders').setDescription('List mutual fund orders'),
    new SlashCommandBuilder()
        .setName('mforder')
        .setDescription('Show MF order details')
        .addStringOption(option => option.setName('order_id').setDescription('MF order ID').setRequired(true)),
    new SlashCommandBuilder().setName('mfsips').setDescription('Show mutual fund SIPs'),
    new SlashCommandBuilder().setName('mfinstruments').setDescription('Download mutual fund instruments CSV'),
    new SlashCommandBuilder()
        .setName('analyze')
        .setDescription('AI analysis for your portfolio')
        .addStringOption(option => option.setName('input').setDescription('detailed, credits, help, or your question')),
    new SlashCommandBuilder()
        .setName('aiportfolio')
        .setDescription('Alias for analyze')
        .addStringOption(option => option.setName('input').setDescription('detailed, credits, help, or your question')),
].map(command => command.toJSON());

const longRunningCommands = new Set([
    'holdings',
    'portfolio',
    'pfsnapshot',
    'buy',
    'sell',
    'orders',
    'orderstatus',
    'quote',
    'ohlc',
    'ltp',
    'chart',
    'watchadd',
    'watchremove',
    'watchlist',
    'instruments',
    'mfholdings',
    'mutualfunds',
    'mforders',
    'mforder',
    'mfsips',
    'mfinstruments',
    'analyze',
    'aiportfolio',
]);

function buildComponents(replyMarkup?: BotReplyOptions['reply_markup']) {
    const keyboard = replyMarkup?.inline_keyboard;
    if (!keyboard?.length) {
        return [];
    }

    return keyboard.map(row =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            row.map((button: BotReplyMarkupButton) =>
                new ButtonBuilder().setCustomId(button.callback_data).setLabel(button.text).setStyle(ButtonStyle.Secondary),
            ),
        ),
    );
}

function buildLegacyCommandText(interaction: ChatInputCommandInteraction) {
    const { commandName, options } = interaction;
    switch (commandName) {
        case 'buy':
        case 'sell': {
            const parts = [
                `/${commandName}`,
                options.getString('symbol', true),
                String(options.getInteger('qty', true)),
                options.getString('type'),
                options.getNumber('price')?.toString(),
                options.getString('product'),
            ].filter(Boolean);
            return parts.join(' ');
        }
        case 'orderstatus':
        case 'mforder':
            return `/${commandName} ${options.getString('order_id', true)}`;
        case 'quote':
        case 'ohlc':
        case 'ltp':
        case 'watchadd':
        case 'watchremove':
            return `/${commandName} ${options.getString('instruments', true)}`;
        case 'chart':
            return `/${commandName} ${options.getString('instrument', true)} ${options.getString('timeframe', true)}`;
        case 'instruments': {
            const exchange = options.getString('exchange');
            return exchange ? `/${commandName} ${exchange}` : `/${commandName}`;
        }
        case 'analyze':
        case 'aiportfolio': {
            const input = options.getString('input');
            return input ? `/${commandName} ${input}` : `/${commandName}`;
        }
        default:
            return `/${commandName}`;
    }
}

class DiscordCompatContext implements BotContext {
    platform: 'discord' = 'discord';
    from?: { id: string; username?: string; first_name?: string };
    chat?: { type?: string };
    message?: { text?: string };
    sessionData?: BotContext['sessionData'];
    kite?: BotContext['kite'];
    updateType?: string;
    private replied = false;

    constructor(
        private readonly source: ChatInputCommandInteraction | ButtonInteraction | Message,
        text?: string,
    ) {
        const user = source instanceof Message ? source.author : source.user;
        const isPrivate = source.channel?.type === ChannelType.DM;
        this.from = { id: user.id, username: user.username, first_name: user.globalName ?? user.username };
        this.chat = { type: isPrivate ? 'private' : 'guild' };
        this.message = text ? { text } : undefined;
        this.updateType = source instanceof Message ? 'text' : source.isButton() ? 'callback_query' : 'slash_command';
    }

    private async sendPayload(payload: InteractionReplyOptions | string) {
        if (this.source instanceof Message) {
            if (typeof payload === 'string') {
                return this.source.reply(payload);
            }

            return this.source.reply({
                content: payload.content ?? undefined,
                files: payload.files ?? [],
                components: payload.components ?? [],
            });
        }

        if (!this.replied) {
            this.replied = true;
            if (typeof payload === 'string') {
                return this.source.reply({ content: payload });
            }
            if (this.source.deferred || this.source.replied) {
                return this.source.editReply({
                    content: payload.content ?? undefined,
                    files: payload.files ?? [],
                    components: payload.components ?? [],
                });
            }
            return this.source.reply(payload);
        }

        if (typeof payload === 'string') {
            return this.source.followUp({ content: payload });
        }

        return this.source.followUp(payload);
    }

    private buildAttachment(file: BotAttachmentInput) {
        return new AttachmentBuilder(file.source, { name: file.filename });
    }

    async reply(text: string, extra?: BotReplyOptions) {
        const payload: InteractionReplyOptions = {
            content: text,
            components: buildComponents(extra?.reply_markup),
        };
        return this.sendPayload(payload);
    }

    async replyWithPhoto(file: BotAttachmentInput, extra?: BotReplyOptions) {
        const payload: InteractionReplyOptions = {
            content: extra?.caption,
            files: [this.buildAttachment(file)],
            components: buildComponents(extra?.reply_markup),
        };
        return this.sendPayload(payload);
    }

    async replyWithDocument(file: BotAttachmentInput, extra?: BotReplyOptions) {
        const payload: InteractionReplyOptions = {
            content: extra?.caption,
            files: [this.buildAttachment(file)],
            components: buildComponents(extra?.reply_markup),
        };
        return this.sendPayload(payload);
    }
}

async function ensureDm(source: ChatInputCommandInteraction | ButtonInteraction | Message) {
    if (source.channel?.type === ChannelType.DM) {
        return true;
    }

    if (source instanceof Message) {
        await source.reply('Use the bot in a Discord DM for account and trading features.');
        return false;
    }

    if (!source.replied && !source.deferred) {
        await source.reply({ content: 'Use the bot in a Discord DM for account and trading features.', ephemeral: true });
    } else {
        await source.followUp({ content: 'Use the bot in a Discord DM for account and trading features.', ephemeral: true });
    }
    return false;
}

async function applyDiscordAuth(ctx: BotContext) {
    return authMiddleware.authMiddleware(ctx, async () => Promise.resolve());
}

async function registerSlashCommands(client: Client) {
    if (!config.discordBotToken || !config.discordClientId) {
        console.warn('Discord command registration skipped: missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID.');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(config.discordBotToken);
    await rest.put(Routes.applicationCommands(config.discordClientId), { body: commandDefinitions });
    console.log('Registered Discord global commands.');

    if (config.discordGuildId) {
        await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), { body: commandDefinitions });
        console.log(`Registered Discord guild commands for ${config.discordGuildId}.`);
    }
}

export async function startDiscordBot() {
    if (!config.discordBotToken) {
        return null;
    }

    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
        partials: [Partials.Channel],
    });

    client.once(Events.ClientReady, async readyClient => {
        console.log(`Discord bot logged in as ${readyClient.user.tag}.`);
        try {
            await registerSlashCommands(readyClient);
        } catch (error) {
            console.error('Failed to register Discord commands:', error);
        }
    });

    client.on(Events.InteractionCreate, async interaction => {
        try {
            if (interaction.isChatInputCommand()) {
                if (!(await ensureDm(interaction))) {
                    return;
                }
                if (longRunningCommands.has(interaction.commandName)) {
                    await interaction.deferReply();
                }
                const ctx = new DiscordCompatContext(interaction, buildLegacyCommandText(interaction));
                await applyDiscordAuth(ctx);
                await dispatchCommand(interaction.commandName, ctx);
                return;
            }

            if (interaction.isButton()) {
                if (!(await ensureDm(interaction))) {
                    return;
                }
                await interaction.deferReply();
                const ctx = new DiscordCompatContext(interaction);
                await applyDiscordAuth(ctx);
                await dispatchAction(interaction.customId, ctx);
            }
        } catch (error) {
            console.error('Discord interaction error:', error);
            if (interaction.isRepliable()) {
                const content = 'An unexpected error occurred. Please try again later.';
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content, components: [] }).catch(() => undefined);
                } else {
                    await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
                }
            }
        }
    });

    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) {
            return;
        }
        if (!(await ensureDm(message))) {
            return;
        }

        try {
            const ctx = new DiscordCompatContext(message, message.content);
            await applyDiscordAuth(ctx);
            const trimmed = message.content.trim();

            if (trimmed.startsWith('/')) {
                const commandName = trimmed.slice(1).split(/\s+/)[0]?.toLowerCase();
                if (commandName) {
                    await dispatchCommand(commandName, ctx);
                    return;
                }
            }

            await authHandlers.handleMessage(ctx, async () => Promise.resolve());
        } catch (error) {
            console.error('Discord message error:', error);
            await message.reply('An unexpected error occurred. Please try again later.').catch(() => undefined);
        }
    });

    await client.login(config.discordBotToken);
    return client;
}
