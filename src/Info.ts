import { fileBackedObject } from "./FileBackedObject";
import { SharedSettings } from "./SharedSettings";

import Discord = require("discord.js");
import { PersonalSettings } from "./PersonalSettings";
import Botty from "./Botty";
import Extension from "./Extension";
import { dataFiles } from "./DataFiles";

// If the Collection contains anything in the other array
const findOne = (arr1: Discord.Collection<string, Discord.Role>, arr2: Array<any>) => {
    return arr2.some(v => {
        return !!arr1.get(v);
    });
};

export interface InfoData {
    command: string;
    message: string;
}

export default class Info extends Extension {
    private infos: InfoData[];
    private command: string;

    constructor(botty: Botty, sharedSettings: SharedSettings, personalSettings: PersonalSettings) {
        super(botty, sharedSettings, personalSettings);
        console.log("Requested Info extension..");
        this.command = sharedSettings.info.command;

        this.infos = fileBackedObject(dataFiles.info);
        console.log("Successfully loaded info file.");

        this.onClientReady(this.onBot.bind(this));
        this.addEventListener(this.bot, "message", this.onInfo.bind(this));
    }

    public disable(): void {
        this.removeRegisteredEventListeners();
    }

    onBot() {
        console.log("Info extension loaded.");
    }

    onInfo(message: Discord.Message) {
        if (message.author.bot) return;

        // Needs to start with / or !
        const split = message.cleanContent.split(" ");
        if (split[0][0] !== "!" && split[0][0] !== "/") return;

        // needs to start with command
        let command = split[0].substr(1);
        if (!command.startsWith(this.command)) return;

        // !info <command>
        let nextIndex = 1;
        if (command.length === this.command.length) {
            command = split[1];
            nextIndex++;
        } else
            // !info<command>
            command = command.substr(this.command.length);

        let response: string | undefined;
        switch (command) {
            case "add":
                // Only admins
                if (!message.member || !findOne(message.member.roles, this.sharedSettings.info.allowedRoles)) return;

                if (split.length <= nextIndex + 1) return;
                response = this.addInfo(split[nextIndex], split.slice(nextIndex + 1).join(" "));
                break;

            case "remove":
                // Only admins
                if (!message.member || !findOne(message.member.roles, this.sharedSettings.info.allowedRoles)) return;

                if (split.length <= nextIndex) return;
                response = this.removeInfo(split[nextIndex]);
                break;

            case "list":
                response = this.listInfo();
                break;

            default:
                // Retrieve or just !info
                if (split.length <= 1) return;
                response = this.fetchInfo(split[1]);
                break;
        }

        if (!response) return;

        message.channel.send(response);
    }

    private addInfo(command: string, message: string) {
        const alreadyExists = this.infos.some(info => info.command === command);
        if (alreadyExists) return;

        const newInfo: InfoData = {
            command: command,
            message: message
        };

        this.infos.push(newInfo);
        return `Successfully added ${command}`;
    }

    private removeInfo(command: string) {
        const index = this.infos.findIndex(info => {
            return info.command === command;
        });

        if (index === -1) return;

        this.infos.splice(index, 1);
        return `Successfully removed ${command}`;
    }

    private listInfo() {
        const index = this.infos;

        let message = `The available info commands are: \n`;

        for (let i = 0; i < this.infos.length; i++) {
            message += `- \`!${this.command} ${this.infos[i].command}\`\n`;
        }

        return message;
    }

    private fetchInfo(command: string) {
        const info = this.infos.find(info => {
            return info.command === command;
        });

        if (!info) return;

        return info.message;
    }
}
