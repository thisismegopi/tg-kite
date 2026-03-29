import type { OrderRecord, PlaceOrderParams, PlaceOrderResponse } from "../../types/kite";

type ParsedOrderParams = Omit<PlaceOrderParams, "variety">;

const parseOrderCommand = (text: string): ParsedOrderParams | null => {
    const parts = text.split(" ").filter(part => part.trim() !== "");
    if (parts.length < 3) return null;

    const side = parts[0].replace("/", "").toUpperCase();
    const symbol = parts[1].toUpperCase();
    const quantity = parseInt(parts[2], 10);

    if (Number.isNaN(quantity)) {
        throw new Error("Quantity must be a number");
    }

    let order_type = "MARKET";
    let price = 0;
    let product = "CNC";
    let trigger_price = 0;

    for (let i = 3; i < parts.length; i += 1) {
        const arg = parts[i].toUpperCase();

        if (["MARKET", "LIMIT", "SL", "SL-M"].includes(arg)) {
            order_type = arg;
        } else if (["MIS", "CNC", "NRML", "CO", "BO"].includes(arg)) {
            product = arg;
        } else if (!Number.isNaN(parseFloat(arg))) {
            price = parseFloat(arg);
        }
    }

    if (order_type === "LIMIT" && price === 0) {
        throw new Error("For LIMIT orders, you must specify a price.");
    }

    let exchange = "NSE";
    let tradingsymbol = symbol;

    if (symbol.includes(":")) {
        [exchange, tradingsymbol] = symbol.split(":");
    }

    return {
        exchange,
        tradingsymbol,
        transaction_type: side,
        quantity,
        order_type,
        product,
        price,
        trigger_price,
        validity: "DAY",
    };
};

const placeOrder = async (ctx: any) => {
    try {
        const params = parseOrderCommand(ctx.message.text);
        if (!params) {
            return ctx.reply("⚠️ Usage: /buy <SYMBOL> <QTY> [MARKET/LIMIT] [PRICE] [CNC/MIS]");
        }

        ctx.reply(`⏳ Placing ${params.transaction_type} order for ${params.quantity} ${params.tradingsymbol}...`);

        const response = await ctx.kite.placeOrder({
            variety: "regular",
            exchange: params.exchange,
            tradingsymbol: params.tradingsymbol,
            transaction_type: params.transaction_type,
            quantity: params.quantity,
            product: params.product,
            order_type: params.order_type,
            price: params.price,
            validity: params.validity,
            trigger_price: params.trigger_price,
        }) as PlaceOrderResponse;

        ctx.reply(`✅ Order Placed!\nOrder ID: \`${response.order_id}\``, { parse_mode: "Markdown" });
    } catch (err: any) {
        ctx.reply(`❌ Order Failed: ${err.message}`);
    }
};

const listOrders = async (ctx: any) => {
    try {
        const orders = await ctx.kite.getOrders() as OrderRecord[];
        if (!orders || orders.length === 0) {
            return ctx.reply("No orders found for today.");
        }

        const recent = orders.slice(0, 5);
        let message = '📝 *Recent Orders*\n\n';

        recent.forEach(order => {
            message += `🆔 \`${order.order_id}\`\n`;
            message += `${order.transaction_type} ${order.tradingsymbol} x ${order.quantity}\n`;
            message += `Status: *${order.status}* | Price: ${order.price || "MKT"}\n\n`;
        });

        ctx.reply(message, { parse_mode: "Markdown" });
    } catch (err: any) {
        ctx.reply(`❌ Error fetching orders: ${err.message}`);
    }
};

const orderStatus = async (ctx: any) => {
    const parts = ctx.message.text.split(" ");
    const orderId = parts[1];

    if (!orderId) {
        return ctx.reply("⚠️ Usage: /orderstatus <order_id>");
    }

    try {
        const history = await ctx.kite.getOrderHistory(orderId) as OrderRecord[];
        if (!history || history.length === 0) {
            return ctx.reply("Order not found.");
        }

        const current = history[history.length - 1];

        let message = `🕒 *Order Status: ${current.status}*\n`;
        message += `Symbol: ${current.tradingsymbol}\n`;
        message += `Type: ${current.transaction_type} ${current.order_type}\n`;
        message += `Qty: ${current.filled_quantity ?? 0}/${current.quantity}\n`;
        if (current.average_price) message += `Avg Price: ${current.average_price}\n`;
        if (current.status_message) message += `Msg: ${current.status_message}\n`;

        ctx.reply(message, { parse_mode: "Markdown" });
    } catch (err: any) {
        ctx.reply(`❌ Error fetching status: ${err.message}`);
    }
};

export = {
    placeOrder,
    listOrders,
    orderStatus,
};
