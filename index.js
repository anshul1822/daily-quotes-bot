const { Telegraf, Markup } = require("telegraf");
const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");

const axios = require("axios");
const schedule = require("node-schedule");
const wordsArray = require("./data");
const message = require("./constants");

require("dotenv").config();

try{
  var supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  var bot = new Telegraf(process.env.BOT_TOKEN);
  var teleBot = new TelegramBot(process.env.BOT_TOKEN);
}
catch(err){
    console.log(err);
}

const sendQuoteToSubscribers = async () => {
    try {
      console.log("Job triggering everyday at 8 AM", Date.now());

      const { data, err } = await supabase
        .from("subscribers")
        .select("user_id, user_name, whether_subscribed, chosen_category")
        .eq("whether_subscribed", true); // Correct

      if (data) {
        console.log(data);

        data.map(async (user, index) => {
          const { chosen_category, user_id, user_name } = user;

          const res = await axios.get(
            `https://api.api-ninjas.com/v1/quotes?category=${chosen_category}&limit=1`,
            {
              headers: {
                "Content-Type": "application/json",
                "X-Api-Key": process.env.X_Api_Key,
              },
            }
          );

          let msg = message(user_name, res.data[0].quote, res.data[0].author);

          bot.telegram
            .sendMessage(user_id, msg)
            .then(() => {
              console.log(`Message sent successfully to ${user_name}!`);
            })
            .catch((error) => {
              console.error("Error sending message:", error);
            });
        });
      } else console.log("NO SUBSCRIBERS IN DB");
    } catch (err) {
      console.log(err);
    }
  };

  // const job = schedule.scheduleJob("36 * * * *", function scheduleJOB() {
  //     console.log("This job runs at the 2nd minute of every hour.");
  // });

  // const job1 = schedule.scheduleJob("*/30 * * * *", function scheduleJOB() {
  //     console.log("This job runs at the 2nd minute of every hour.");
  // });

  const job2 = schedule.scheduleJob("/1 * * * *", function scheduleJOB() {
    sendQuoteToSubscribers();
  });

  
  bot.start((ctx) => ctx.reply(`Welcome to Daily Quotes Bot
    To receive a quote /quote
    To subscribe this bot /subscribe`));

  bot.command("quote", async (ctx) => {

    const { id: user_id, first_name: user_name } = ctx.from;

    const res = await axios.get(
      `https://api.api-ninjas.com/v1/quotes?category=inspirational&limit=1`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": process.env.X_Api_Key,
        },
      }
    );

    ctx.reply(message(user_name, res.data[0].quote, res.data[0].author));
  });

  bot.command("subscribe", async (ctx) => {
    const { id: user_id, first_name: user_name } = ctx.from;

    try {
      const { data: user_data, err } = await supabase
        .from("subscribers")
        .select("user_id, user_name, whether_subscribed, chosen_category")
        .eq("user_id", user_id)
        .single();

      if (user_data) {
        if (user_data.whether_subscribed)
          ctx.reply(`You have alreay subscribed ❤`);
        else {
          const { error } = await supabase
            .from("subscribers")
            .update({ whether_subscribed: true })
            .eq("user_id", user_id);

          if (!error) {
            await ctx.reply(`Thanks for subscribing again ❤`);
            await ctx.telegram.sendMessage(
              ctx.message.chat.id,
              "Please Click on category to continue /category"
            );
          }
        }
      } else {
        const { error } = await supabase.from("subscribers").insert([
          {
            user_id: user_id,
            user_name: user_name,
            whether_subscribed: true,
            chosen_category: "inspirational",
          },
        ]);
        console.log(error);

        if (!error) {
          await ctx.reply(`You have successfully subscribed ❤`);
          await ctx.telegram.sendMessage(
            ctx.message.chat.id,
            "Please Choose a category to continue /category"
          );
        }
      }
    } catch (err) {
      console.log(err);
    }

  });

  bot.command("category", async (ctx) => {
    const { id: user_id, first_name: user_name } = ctx.from;
    //console.log(user_id, user_name);

    const options = wordsArray;

    // Create an array of button labels
    const buttons = options.map((option) =>
      Markup.button.callback(option, option, false, false, {
        callback_game: JSON.stringify({ hide: true }),
      })
    );

    // Create the inline keyboard with the array of buttons
    const keyboard = Markup.inlineKeyboard(buttons, { columns: 3 });

    ctx.reply("Please select your desired genre:", keyboard);
  });

  bot.action(wordsArray, async (ctx) => {
    const { id: user_id } = ctx.from;
    const selectedOption = ctx.match;
    ctx.reply(`You selected: ${selectedOption}`);
    ctx.editMessageReplyMarkup();

    const { error } = await supabase
      .from("subscribers")
      .update({ chosen_category: selectedOption.input })
      .eq("user_id", user_id)
      .select();

    if (!error) ctx.reply(`Successfully Selected Category : ${selectedOption} ✔`);
  });

  bot.command("unsubscribe", async (ctx) => {

    const { id: user_id, first_name: user_name } = ctx.from;

    const { error } = await supabase
    .from("subscribers")
    .update({ whether_subscribed: false })
    .eq("user_id", user_id)
    .select();

    if (!error) ctx.reply(`Successfully Unsubscribed`);
  });

  bot.launch().then(() => {
    console.log("Bot is up and running!");
  });

