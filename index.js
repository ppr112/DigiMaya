require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk");
const { Resend } = require("resend");
const { connectCall } = require("./call-agent");
const { router: smsAgent, init: initSmsAgent } = require("./sms-agent");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

initSmsAgent(supabase, anthropic, require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN));

app.get("/", (req, res) => {
  res.json({ status: "Chatbot backend is running!" });
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "maya_verify_token";
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  const body = req.body;
  console.log("Webhook event received:", JSON.stringify(body, null, 2));

  // Must respond 200 quickly so Meta doesn't retry
  res.sendStatus(200);

  if (body.object !== "instagram") return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id;
      const messageText = event.message?.text;

      // Ignore messages sent by the bot itself (echo)
      if (event.message?.is_echo) continue;
      // Ignore if no text (e.g. stickers, reactions)
      if (!messageText) continue;

      console.log(`Message from ${senderId}: ${messageText}`);

      await sendReply(senderId, `You said: "${messageText}"`);
    }
  }
});

async function sendReply(recipientId, text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    });

    const options = {
      hostname: "graph.instagram.com",
      path: `/v21.0/me/messages?access_token=${IG_ACCESS_TOKEN}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const https = require("https");
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        console.log("Reply sent:", data);
        resolve();
      });
    });

    req.on("error", (err) => {
      console.error("Failed to send reply:", err.message);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

app.get("/products", async (req, res) => {
  const { search } = req.query;
  try {
    let query = supabase.from("products").select("*");
    if (search) { query = query.ilike("name", "%" + search + "%"); }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ products: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use("/", smsAgent);

app.post("/call/connect", require("./call-agent").handleConnect);

app.delete("/cleanup/:session_id", async (req, res) => {
  const { session_id } = req.params;
  await supabase.from("handoff_requests").delete().eq("session_id", session_id);
  await supabase.from("chat_messages").delete().eq("session_id", session_id);
  res.json({ message: "Session cleaned up: " + session_id });
});

app.post("/chat", async (req, res) => {
  const { message, session_id } = req.body;
  if (!message || !session_id) {
    return res.status(400).json({ error: "message and session_id are required" });
  }

  try {
    await supabase.from("chat_messages").insert({ session_id, role: "user", content: message });

    const { data: products } = await supabase.from("products").select("*").eq("in_stock", true);
    const { data: faqs } = await supabase.from("faqs").select("*");
    const { data: recentChats } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const conversationHistory = recentChats
      ? recentChats.reverse().map(function(m) { return { role: m.role, content: m.content }; })
      : [{ role: "user", content: message }];

    const productList = products && products.length > 0
      ? products.map(function(p) { return p.name + " — $" + p.price + ": " + p.description; }).join("\n")
      : "";

    const faqList = faqs && faqs.length > 0
      ? faqs.map(function(f) { return "Q: " + f.question + "\nA: " + f.answer; }).join("\n\n")
      : "";

    const systemPrompt = "You are Maya, a smart and friendly pre-sales assistant for a digital products business that helps physical product sellers run their business more efficiently.\n\n" +
"ABOUT THE BUSINESS:\n" +
"We sell 5 digital tools for small to medium physical product sellers — people who sell on markets, online stores, Instagram, WhatsApp or their own website.\n\n" +
"PRODUCTS:\n" + productList + "\n\n" +
"FAQS:\n" + faqList + "\n\n" +
"BUNDLE SUGGESTIONS:\n" +
"- Starter Bundle: Inventory Tracker Pro + Profit Margin Calculator (best for beginners)\n" +
"- Growth Bundle: Sales Performance Dashboard + Supplier Contact Manager (best for scaling)\n" +
"- Complete Bundle: all 5 products work together as a full business management system\n\n" +
"POLICIES:\n" +
"- 7-day money back guarantee on all products\n" +
"- All products are one-time purchases, no subscription\n" +
"- Digital download delivered immediately after payment\n" +
"- No free trial but 7-day guarantee covers any concerns\n\n" +
"EDGE CASES:\n" +
"- Free trial: No free trial but 7-day money back guarantee\n" +
"- Shopify integration: Not yet but works alongside any platform\n" +
"- Restaurants or non-product businesses: Designed for product sellers, may not be the best fit\n" +
"- Already using Excel: More structured and purpose-built, saves setup time\n" +
"- Customisation: Not currently available\n\n" +
"HOW TO HANDLE A CUSTOMER WHO WANTS TO BUY:\n" +
"1. First ask their name and what type of business they run\n" +
"2. Then ask how they prefer to be contacted: A. Phone call B. WhatsApp C. Text message D. Email\n" +
"3. Then ask for their contact detail (phone number or email)\n" +
"4. Then confirm: 'Thank you [name]! Our team will [contact method] you at [detail] within minutes!'\n" +
"5. End with: HANDOFF_READY|[name]|[business]|[contact_method]|[contact_detail]|[product_interest]\n\n" +
"HOW TO HANDLE A HUMAN AGENT REQUEST:\n" +
"1. Say: 'I am connecting you to our team right now. Someone will be with you shortly!'\n" +
"2. End with: HUMAN_HANDOFF|[session_id]\n\n" +
"IMPORTANT RULES:\n" +
"- Always answer any question the customer asks, even mid-purchase flow\n" +
"- Never ignore a question to push the purchase flow\n" +
"- Keep responses under 3 sentences unless listing products\n" +
"- Sound like a helpful human sales assistant\n" +
"- Never make up information not provided above\n" +
"- If customer changes their mind mid-flow, handle it naturally";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: conversationHistory,
      system: systemPrompt,
    });

    let reply = response.content[0].text;

    if (reply.includes("HANDOFF_READY|")) {
      const parts = reply.split("HANDOFF_READY|")[1].split("|");
      const customerName = parts[0] || "";
      const businessType = parts[1] || "";
      const contactMethod = parts[2] || "";
      const contactDetail = parts[3] || "";
      const productInterest = parts[4] || "";

      await supabase.from("handoff_requests").insert({
        session_id,
        reason: "purchase_intent",
        status: "pending",
        customer_name: customerName,
        business_type: businessType,
        contact_method: contactMethod,
        contact_detail: contactDetail,
        product_interest: productInterest,
      });

      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: process.env.ALERT_EMAIL,
        subject: "New Purchase Lead — " + customerName,
        text: "Name: " + customerName + "\nBusiness: " + businessType + "\nProduct: " + productInterest + "\nContact: " + contactMethod + " — " + contactDetail,
      });

      if (contactMethod.toLowerCase().includes("phone")) {
        await connectCall(contactDetail, productInterest);
      }

      reply = reply.split("HANDOFF_READY|")[0].trim();
    }

    if (reply.includes("HUMAN_HANDOFF|")) {
      await supabase.from("handoff_requests").insert({
        session_id,
        reason: "customer_request",
        status: "pending",
      });

      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: process.env.ALERT_EMAIL,
        subject: "Human Handoff Request",
        text: "A customer needs human support.\nSession: " + session_id,
      });

      reply = reply.split("HUMAN_HANDOFF|")[0].trim();
    }

    await supabase.from("chat_messages").insert({ session_id, role: "assistant", content: reply });
    res.json({ reply });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/handoff", async (req, res) => {
  try {
    const { data, error } = await supabase.from("handoff_requests").select("*").eq("status", "pending").order("created_at", { ascending: true });
    if (error) throw error;
    res.json({ queue: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log("Chatbot backend is running!");
});
