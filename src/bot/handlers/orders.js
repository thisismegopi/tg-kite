// Parsing helper
const parseOrderCommand = (text) => {
  // Format: /buy SYMBOL QTY [TYPE] [PRICE] [PRODUCT]
  // Defaults: TYPE=MARKET, PRODUCT=CNC (for equity) or MIS, Price=0
  
  const parts = text.split(' ').filter(p => p.trim() !== '');
  if (parts.length < 3) return null;

  const side = parts[0].replace('/', '').toUpperCase(); // BUY or SELL
  const symbol = parts[1].toUpperCase();
  const quantity = parseInt(parts[2], 10);

  if (isNaN(quantity)) throw new Error('Quantity must be a number');

  // Basic assumptions/defaults
  let order_type = 'MARKET';
  let price = 0;
  let product = 'CNC'; // Default to Delivery for simplicity, can be MIS
  let trigger_price = 0;

  // Try to parse optional args
  // This is a naive parser. A robust one would check for keywords.
  // parts[3] could be 'MARKET' or 'LIMIT' or price or product.
  
  for (let i = 3; i < parts.length; i++) {
    const arg = parts[i].toUpperCase();
    
    if (['MARKET', 'LIMIT', 'SL', 'SL-M'].includes(arg)) {
      order_type = arg;
    } else if (['MIS', 'CNC', 'NRML', 'CO', 'BO'].includes(arg)) {
      product = arg;
    } else if (!isNaN(parseFloat(arg))) {
      price = parseFloat(arg);
    }
  }

  // If LIMIT but no price, that's an error usually, but we'll let API reject or user specify
  if (order_type === 'LIMIT' && price === 0) {
    throw new Error('For LIMIT orders, you must specify a price.');
  }

  // Determine Exchange (Default to NSE for simplicity, checking BSE is harder without instrument list)
  // User can specify exchange like "BSE:INFY" or we just assume NSE.
  let exchange = 'NSE';
  let tradingsymbol = symbol;
  
  if (symbol.includes(':')) {
    [exchange, tradingsymbol] = symbol.split(':');
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
    validity: 'DAY'
  };
};

const placeOrder = async (ctx) => {
  try {
    const params = parseOrderCommand(ctx.message.text);
    if (!params) {
      return ctx.reply('⚠️ Usage: /buy <SYMBOL> <QTY> [MARKET/LIMIT] [PRICE] [CNC/MIS]');
    }

    ctx.reply(`⏳ Placing ${params.transaction_type} order for ${params.quantity} ${params.tradingsymbol}...`);

    const response = await ctx.kite.placeOrder({
      variety: 'regular',
      exchange: params.exchange,
      tradingsymbol: params.tradingsymbol,
      transaction_type: params.transaction_type,
      quantity: params.quantity,
      product: params.product,
      order_type: params.order_type,
      price: params.price,
      validity: params.validity
    });

    // response: { order_id: '...' }
    ctx.reply(`✅ Order Placed!\nOrder ID: \`${response.order_id}\``, { parse_mode: 'Markdown' });

  } catch (err) {
    ctx.reply(`❌ Order Failed: ${err.message}`);
  }
};

const listOrders = async (ctx) => {
  try {
    const orders = await ctx.kite.getOrders();
    if (!orders || orders.length === 0) {
      return ctx.reply('No orders found for today.');
    }

    // Show recent 5 orders
    const recent = orders.slice(0, 5); 
    let msg = '📋 *Recent Orders*\n\n';

    recent.forEach(o => {
      msg += `🆔 \`${o.order_id}\`\n`;
      msg += `${o.transaction_type} ${o.tradingsymbol} x ${o.quantity}\n`;
      msg += `Status: *${o.status}* | Price: ${o.price || 'MKT'}\n\n`;
    });

    ctx.reply(msg, { parse_mode: 'Markdown' });

  } catch (err) {
    ctx.reply(`❌ Error fetching orders: ${err.message}`);
  }
};

const orderStatus = async (ctx) => {
  const parts = ctx.message.text.split(' ');
  const orderId = parts[1];

  if (!orderId) {
    return ctx.reply('⚠️ Usage: /orderstatus <order_id>');
  }

  try {
    const history = await ctx.kite.getOrderHistory(orderId);
    if (!history || history.length === 0) {
      return ctx.reply('Order not found.');
    }

    // History is an array of state changes. The last one is current.
    const current = history[history.length - 1];

    let msg = `🆔 *Order Status: ${current.status}*\n`;
    msg += `Symbol: ${current.tradingsymbol}\n`;
    msg += `Type: ${current.transaction_type} ${current.order_type}\n`;
    msg += `Qty: ${current.filled_quantity}/${current.quantity}\n`;
    if (current.average_price) msg += `Avg Price: ${current.average_price}\n`;
    if (current.status_message) msg += `Msg: ${current.status_message}\n`;

    ctx.reply(msg, { parse_mode: 'Markdown' });

  } catch (err) {
    ctx.reply(`❌ Error fetching status: ${err.message}`);
  }
};

module.exports = {
  placeOrder,
  listOrders,
  orderStatus
};

