# Tutorial

# Discord bot setup
First thing to do when you want to create this is go to [Discord Dev Site](https://discord.com/developers/applications) and create a bot.

Log in, click on ```"New Application"``` and name the bot, then accept the terms of server and create the bot.

Once you've created the bot, look for the ```"Application ID"``` and copy it and paste it somewhere you will remember.

-------

# Installation settings (under General Information)

scroll down to ```"Guild Install"``` and click on scopes and add ```"bot"``` as a scope. 

Next go to ```"Permissions"```(still under guild install) and add these permissions: ```"Send Messages"```, and ```"Use Slash Commands"```

-----

# OAuth2 settings (Under Installation)

Scroll down to ```"OAuth2 URL Generator"``` and click on ```"bot"``` and ```"applications.commands"```

Once you've done that something called ```"Bot Permissions"``` Should've shown under ```"OAuth2 URL Generator"```

In ```"Bot Permissions"```, Click on ```"Use Slash Commands"``` and ```"Send Messages"```.

Now at the very bottom of the tab, you should see something named ```"Generated URL"```. Copy it, then send it in the discord server you want the bot in. Then in the discord server click on the link, and add it to the server.

-----

# Bot Settings (Under OAuth2)

Set the Icon and banner(both optional) and the username.

Next, Click on ```"Reset Token"``` and copy the token down for later.

Next make sure ```"Public Bot"``` is turned on and under ```"Privileged Gateway Intents"``` you want to turn on all 3 settings then save changes and 

----

# Forking it into YOUR GitHub 

Make your way to [GitHub](https://github.com/) and sign in, next go to my repo [LOA-Bot](https://github.com/NewUser1121/Loa-Bot) and then click on ```"Fork"``` (in between "watch" and "star" in the top rightish)

Next click on ```"Create fork"``` and keep the settings it gives you by default(optional).


---

# Render.com (Hosting site)

Go to [Render](https://render.com/) and click on ```"Get Started For Free"``` and login with GitHub.

---
# Creating the WebService(Still Render)

After logging in, Click on ```"+ Add New"``` on the top right, and then click on ```"Web Service"``` and then click on the repository that you created when you forked it. or you can click on "Public Git Repository" and paste this link into it: https://github.com/NewUser1121/Loa-Bot

Next, keep the name(optional) and go down to "Build Command" and paste this into it: ```npm install```

Next, Go down to the "Start Command" and paste this into it: ```npm start```

Next, Go down to "```Instance Type"``` and choose your plan. For this you can do the ```"Free"``` version because its a extremely small project and pings itself to keep itself alive. (if for any reason it says you've passed the limit for it in the future, you can go to the basic one, or redo this process(only the render.com section) and bypass them.

---

# Environment Variables (still creating the webservice)

Look for the ```"Add Environment Variable"``` and click it 2 times. There should now be 3 things you can edit now.

I will now put the 3 ```"NAME_OF_VARIABLE"```'s and the ```"VALUE"```'s you will be putting into the 3 you now have:

 VARIABLE 1: ```CLIENT_ID```    VALUE 1: ```The Application Id from the "# Discord bot setup"```

 VARIABLE 2: ```DISCORD_TOKEN```    VALUE 2: ```Your Discord Bot Token from when you reset your bot token```
 
 VARIABLE 3: ```RENDER_EXTERNAL_URL```    VALUE 3: ```This you will get when you click "Deploy Web Service". It should look something like this: https://loa-bot-m2ro.onrender.com```


Next click on ```"Deploy Web Service"```.

---

# End

After Deploying, Look for something that says a link. it should look something like this: ```https://loa-bot-bu9g.onrender.com```

Copy it. Then look at the very left, and click on ```"Environment"```. 

In Environment, Look for ```"Edit"``` and click on it. Then look for the Key ```"RENDER_EXTERNAL_URL"``` and in the ```"VALUE"``` You need to paste in the link you copied just a second ago. Then click on ```"Save, rebuild, and deploy"```. and now you can go back into ```"Logs"``` in the left bar and watch as your webservice deploys. 

As log as there are no errors, you can go into your Discord server, and type in /loa and there should be a command that you can click/press tab to autofill it and run it. And if it allows you to, then you have successfully created your bot!

# Great job!
