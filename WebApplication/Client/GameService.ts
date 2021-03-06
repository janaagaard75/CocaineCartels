﻿module CocaineCartels {
    "use strict";

    export class GameService {
        public static getGameState(): Promise<GameState> {
            return HttpClient.get<IGameState>("/api/gamestate").then(gameStateData => {
                const gameState = new GameState(gameStateData);
                return gameState;
            });
        }

        public static getStatus(): Promise<IStatus> {
            return HttpClient.get<IStatus>("/api/status");
        }

        public static notReady(): Promise<void> {
            return HttpClient.get<void>("/api/notready");
        }

        public static resetGame(): Promise<void> {
            return HttpClient.get<void>("/api/reset");
        }

        public static sendCommands(commands: ClientCommands): Promise<void> {
            return HttpClient.post<void>("/api/commands", commands);
        }

        public static setAllPlayersSeemToBeHere(allSeemToBeHere: boolean): Promise<void> {
            return HttpClient.get<void>(`/api/setallplayershere/${allSeemToBeHere}`);
        }
    }
}
