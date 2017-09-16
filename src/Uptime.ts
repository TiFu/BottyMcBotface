import Discord = require("discord.js");
import prettyMs = require("pretty-ms");
import Extension from "./Extension";
import Botty from "./Botty";

import { fileBackedObject } from "./FileBackedObject";
import { SharedSettings } from "./SharedSettings";
import { PersonalSettings } from "./PersonalSettings";
import { dataFiles } from "./DataFiles";

export interface UptimeData {
    LastUptime: number;
    UptimeStart: number;
    TotalDowntime: number;
}

export default class Uptime extends Extension {
    private data: UptimeData;

    constructor(botty: Botty, sharedSettings: SharedSettings, personalSettings: PersonalSettings) {
        super(botty, sharedSettings, personalSettings);
        console.log("Requested uptime extension..");

        this.data = fileBackedObject(dataFiles.uptime);
        console.log("Successfully loaded uptime data file.");

        this.onClientReady(this.onBot.bind(this));
        this.addEventListener(this.bot, "message", this.onMessage.bind(this));
        setInterval(this.onUpdate.bind(this), this.sharedSettings.uptimeSettings.checkInterval);
    }

    public disable(): void {
        this.removeRegisteredEventListeners();
    }

    onBot() {
        console.log("uptime extension loaded.");
    }

    onMessage(message: Discord.Message) {
        if (!message.content.startsWith("!uptime")) return;
        message.reply(`the bot has been up for ${this.uptimePercentage}% of the time. Bot started ${this.uptime} ago.`);
    }

    onUpdate() {
        let timeDiff = Date.now() - this.data.LastUptime;

        // To restart, basically set either of these values to 0
        if (this.data.LastUptime === 0 || this.data.UptimeStart === 0) {
            this.data.UptimeStart = Date.now();
            this.data.TotalDowntime = 0;
            timeDiff = 0;
        }

        if (timeDiff > this.sharedSettings.uptimeSettings.checkInterval + 1000) {
            // Give it some error
            this.data.TotalDowntime += timeDiff;
            console.log(`Noticed a downtime of ${timeDiff * 0.001} seconds.`);
        }

        this.data.LastUptime = Date.now();
    }

    get uptimePercentage() {
        const timeSpan = new Date().getTime() - this.data.UptimeStart;
        const percentage = 1.0 - this.data.TotalDowntime / timeSpan;
        return +(percentage * 100.0).toFixed(3);
    }

    get uptime() {
        return prettyMs(Date.now() - this.data.UptimeStart, { verbose: true });
    }
}
