﻿module CocaineCartels {
    "use strict";

    export interface IGame {
        gridSize: number;

        players: Array<IPlayer>;

        /** Null on first turn. */
        previousTurn: ITurn;

        started: boolean;
    }
}
