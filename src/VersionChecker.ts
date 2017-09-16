import Discord = require("discord.js");
import fetch from "node-fetch";

import { fileBackedObject } from "./FileBackedObject";
import { SharedSettings } from "./SharedSettings";
import { PersonalSettings } from "./PersonalSettings";
import Botty from "./Botty";
import { dataFiles } from "./DataFiles";
import Extension from "./Extension";

export interface VersionCheckerData {
    latestGameVersion: string;
    latestDataDragonVersion: string;
}

export default class VersionChecker extends Extension {
    private data: VersionCheckerData;
    private channel: Discord.TextChannel;

    constructor(botty: Botty, sharedSettings: SharedSettings, personalSettings: PersonalSettings) {
        super(botty, sharedSettings, personalSettings);
        console.log("Requested VersionChecker extension..");

        this.data = fileBackedObject(dataFiles.versionChecker);
        console.log("Successfully loaded VersionChecker data file.");

        this.onClientReady(this.onBot.bind(this));
    }

    public disable():void {
        this.removeRegisteredEventListeners();
    }

    onBot() {
        let guild = this.bot.guilds.get(this.sharedSettings.server);
        if (!guild) {
            console.error(`VersionChecker: Incorrect settings for guild ID ${this.sharedSettings.server}`);
            return;
        }

        const channel = guild.channels.find("name", this.sharedSettings.forum.channel);
        if (!channel || !(channel instanceof Discord.TextChannel)) {
            console.error(`VersionChecker: Incorrect setting for the channel: ${this.sharedSettings.forum.channel}`);
            return;
        }

        this.channel = channel as Discord.TextChannel;
        console.log("VersionChecker extension loaded.");
        this.onUpdate();
    }

    async updateDataDragonVersion() {
        try {
            const response = await fetch(`http://ddragon.leagueoflegends.com/realms/na.json`, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            });

            if (response.status !== 200) console.log("HTTP Error trying to read ddragon version: " + response.status);

            let dataDragonVersion = await response.json();

            if (!dataDragonVersion || !dataDragonVersion["v"]) {
                console.error("ddragon version json seems to be incorrect? Data corrupted?");
                return;
            }

            if (dataDragonVersion["v"] == this.data.latestDataDragonVersion) {
                return;
            }

            // new version
            // TODO: Maybe check for higher version, denote type of update? (patch/etc)
            this.data.latestDataDragonVersion = dataDragonVersion["v"];
            let downloadLink = `http://ddragon.leagueoflegends.com/cdn/dragontail-${this.data.latestDataDragonVersion}.tgz`;

            let embed = new Discord.RichEmbed()
                .setColor(0x42f456)
                .setTitle("New DDragon version!")
                .setDescription(
                    `Version ${this.data
                        .latestDataDragonVersion} of DDragon has hit the CDN.\nYou can find the tool here:\nhttp://ddragon.leagueoflegends.com/tool\n\nAnd the download is available here:\n${downloadLink}`
                )
                .setURL("http://ddragon.leagueoflegends.com/tool")
                .setThumbnail(this.sharedSettings.versionChecker.dataDragonThumbnail);

            this.channel.send("", {
                embed: embed
            });
        } catch (e) {
            console.error("Ddragon fetch error: " + e.message);
        }
    }

    async updateGameVersion() {
        try {
            let currentVersionArray = this.data.latestGameVersion.split(".");
            let nextMajor: number = parseInt(currentVersionArray[0]);
            let nextMinor: number = parseInt(currentVersionArray[1]);

            let tries = 0;

            let patchNotes: string;

            let lastNewValidMajor = nextMajor;
            let lastNewValidMinor = nextMinor;
            let validPatchNotes: string = "invalid";
            let newPatch = false;

            do {
                nextMinor++;
                patchNotes = `https://na.leagueoflegends.com/en/news/game-updates/patch/patch-${nextMajor.toString()}${nextMinor.toString()}-notes`;
                tries++;

                let response = await fetch(patchNotes, {
                    method: "GET"
                });

                if (response.status === 200) {
                    lastNewValidMajor = nextMajor;
                    lastNewValidMinor = nextMinor;
                    validPatchNotes = patchNotes;
                    newPatch = true;
                } else if (response.status === 404) {
                    // check for change in season
                    nextMajor++;
                    nextMinor = 1;

                    patchNotes = `https://na.leagueoflegends.com/en/news/game-updates/patch/patch-${nextMajor.toString()}${nextMinor.toString()}-notes`;
                    tries++;

                    response = await fetch(patchNotes, {
                        method: "GET"
                    });

                    if (response.status === 200) {
                        lastNewValidMajor = nextMajor;
                        lastNewValidMinor = nextMinor;
                        validPatchNotes = patchNotes;
                        newPatch = true;
                    } else if (response.status === 404) break;
                }
            } while (tries < 100);

            if (newPatch == false) return; // no new version

            this.data.latestGameVersion = `${lastNewValidMajor.toString()}.${lastNewValidMinor.toString()}`;

            let embed = new Discord.RichEmbed()
                .setColor(0xf442e5)
                .setTitle("New League of Legends version!")
                .setDescription(
                    `Version ${this.data
                        .latestGameVersion} of League of Legends has posted its patch notes. You can expect the game to update soon.\n\nYou can find the notes here:\n${validPatchNotes}`
                )
                .setURL(validPatchNotes)
                .setThumbnail(this.sharedSettings.versionChecker.gameThumbnail);

            this.channel.send("", {
                embed: embed
            });
        } catch (e) {
            console.error("Game version fetch error: " + e.message);
        }
    }

    async onUpdate() {
        await this.updateDataDragonVersion();
        await this.updateGameVersion();

        setTimeout(this.onUpdate.bind(this), this.sharedSettings.versionChecker.checkInterval);
    }
}
