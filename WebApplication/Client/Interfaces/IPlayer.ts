﻿module CocaineCartels {
    "use strict";

    export interface IPlayer {
        administrator: boolean;
        /** The color is also the ID of the player. */
        color: string;
        commandsSentOn: string;
        points: number;
        ready: boolean;
        textColor: string;
    }
}
