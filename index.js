
const express = require('express');
const app = express();

const stripe = require("stripe")("sk_test_51Nx89nLKAT3hd67NtikE0pYaBsaKzOOcBKl2kszFVbo2XpGGjBanQWlrDMcBsDmtBxO5zRIC8gOaH1psG9YrEoiw0068Hf1cko");



app.use(
  express.json({
    verify: (req,buffer) => (req['rawBody'] = buffer),
  })
);



// TODO Implement a real database
const customers = {
  // stripeCustomerId : data
  'stripeCustomerId': {
    apiKey: '1',
    active: false,
    subscriptionId: 'Subscription1',
  },
};
const apiKeys = {
  // apiKey : customerdata
  '1': 'stripeCustomerId',
};

////// Custom API Key Generation 

// Recursive function to generate a unique random string as API key
function generateAPIKey() {
  const { randomBytes } = require('crypto');
  const apiKey = randomBytes(16).toString('hex');
  const hashedAPIKey = hashAPIKey(apiKey);

  // Ensure API key is unique
  if (apiKeys[hashedAPIKey]) {
    generateAPIKey();
  } else {
    return { hashedAPIKey, apiKey };
  }
}

// Hash the API 
function hashAPIKey(apiKey) {
  const { createHash } = require('crypto');

  const hashedAPIKey = createHash('sha256').update(apiKey).digest('hex');

  return hashedAPIKey;
}

// Express API //

// Create a Stripe Checkout Session to create a customer and subscribe them to a plan
app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: '£30',
      },
    ],
    success_url:
      'http://yusufalitstripe/dashboard?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'http://yusufalistripe/error',
  });

  res.send(session);
});

// Listen to webhooks from Stripe when important events happen
app.post('/webhook', async (req, res) => {
  let data;
  let eventType;
  // Check if webhook signing is configured.
  const webhookSecret = 'whsec_wRNftLajMZNeslQOP6vEPm4iVx5NlZ6z';

  if (webhookSecret) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers['stripe-signature'];

    try {
      event = stripe.webhooks.constructEvent(
        req['rawBody'],
        signature,
        webhookSecret
      );
    } catch (err) {
      console.log(` Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    
   
    data = req.body.data;
    eventType = req.body.type;
  }

  switch (eventType) {
    case 'checkout.session.completed':
      console.log(data);
     
      const customerId = data.object.customer;
      const subscriptionId = data.object.subscription;

      console.log(
        `💰 Customer ${customerId} subscribed to plan ${subscriptionId}`
      );

      // Generate API key
      const { apiKey, hashedAPIKey } = generateAPIKey();
      console.log(`User's API Key: ${apiKey}`);
      console.log(`Hashed API Key: ${hashedAPIKey}`);

      // Store the API key in your database.
      customers[customerId] = {
        apiKey: hashedAPIKey,
        subscriptionId,
        active: true,
      };
      apiKeys[hashedAPIKey] = customerId;

      break;
    case 'invoice.paid':
    
      break;
    case 'invoice.payment_failed':
     
      break;
    default:
    // Unhandled event type
  }

  res.sendStatus(200);
});

// Get information about the customer
app.get('/customers/:id', (req, res) => {
  const customerId = req.params.id;
  const account = customers[customerId];
  if (account) {
    res.send(account);
  } else {
    res.sendStatus(404);
  }
});

// Make a call to the API
app.get('/api', async (req, res) => {
  const { apiKey } = req.query;

  if (!apiKey) {
    res.sendStatus(400); // bad request
  }

  const hashedAPIKey = hashAPIKey(apiKey);

  const customerId = apiKeys[hashedAPIKey];
  const customer = customers[customerId];

  if (!customer || !customer.active) {
    res.sendStatus(403); // not authorized
  } else {

    // Record usage with Stripe Billing
    const record = await stripe.subscriptionItems.createUsageRecord(
      customer.subscriptionId,
      {
        quantity: 1,
        timestamp: 'now',
        action: 'increment',
      }
    );
    res.send({ data: '🔥🔥🔥', usage: record });
  }
});

app.get('/usage/:customer', async (req, res) => {
  const customerId = req.params.customer;
  const invoice = await stripe.invoices.retrieveUpcoming({
    customer: customerId,
  });

  res.send(invoice);
});

app.listen(8080, () => console.log('Server is running on http://localhost:8080'));



