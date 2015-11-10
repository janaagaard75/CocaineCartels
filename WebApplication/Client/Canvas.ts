﻿module CocaineCartels {
    "use strict";

    export class Canvas {
        constructor(
            board: Board,
            canvasId: string,
            interactive: boolean
        ) {
            Canvas.board = board;
            this.canvasId = canvasId;
            this.interactive = interactive;
            if (board !== null) {
                CanvasSettings.initialize(board.gridSize);
                this.drawBoard();
            }
        }

        private static board: Board; // Has be to static to be accessible inside unitDragBound function.
        private stage: Konva.Stage;

        private backgroundLayer: Konva.Layer;
        private boardLayer: Konva.Layer;
        private canvasId: string;
        private commandsLayer: Konva.Layer;
        private dragLayer: Konva.Layer;
        private interactive: boolean;
        private unitsLayer: Konva.Layer;

        private addLayers() {
            this.backgroundLayer = new Konva.Layer();
            this.stage.add(this.backgroundLayer);

            this.boardLayer = new Konva.Layer();
            this.stage.add(this.boardLayer);

            this.unitsLayer = new Konva.Layer();
            this.stage.add(this.unitsLayer);

            this.commandsLayer = new Konva.Layer();
            this.stage.add(this.commandsLayer);

            this.dragLayer = new Konva.Layer();
            this.stage.add(this.dragLayer);
        }

        /** Currently redraws the board from scratch each time, re-adding all units and commands. */
        public drawBoard() {
            this.stage = new Konva.Stage({
                container: this.canvasId,
                height: CanvasSettings.height,
                width: CanvasSettings.width
            });

            this.addLayers();

            // Draw methods are separated this way to match the layers in the game.
            this.drawCells();
            this.drawUnits();
            this.drawMoveCommands();

            this.stage.draw();
        }

        private drawCell(cell: Cell) {
            const hexagon = new Konva.RegularPolygon({
                x: cell.hex.pos.x,
                y: cell.hex.pos.y,
                radius: CanvasSettings.cellRadius,
                sides: 6,
                stroke: "#ccc",
                strokeWidth: CanvasSettings.lineWidth
            });

            cell.hexagon = hexagon;

            hexagon.on(HexagonEvent.dragEnter, () => {
                cell.hovered = true;
                this.updateCellColor(cell);
                this.boardLayer.draw();
            });

            hexagon.on(HexagonEvent.dragLeave, () => {
                cell.hovered = false;
                this.updateCellColor(cell);
                this.boardLayer.draw();
            });

            this.boardLayer.add(hexagon);
        }

        private drawCells() {
            const background = new Konva.Rect({
                x: 0,
                y: 0,
                width: CanvasSettings.width,
                height: CanvasSettings.height,
                fill: "#fff"
            });
            this.backgroundLayer.add(background);

            Canvas.board.cells.forEach(cell => {
                this.drawCell(cell);
            });
        }

        private drawMoveCommand(command: MoveCommand, index: number, numberOfCommands: number) {
            const halfways = Utilities.midPoint(command.from.hex.pos, command.to.hex.pos);
            const aFourth = Utilities.midPoint(command.from.hex.pos, halfways);
            const threeFourths = Utilities.midPoint(command.to.hex.pos, halfways);
            const from = Utilities.midPoint(command.from.hex.pos, threeFourths);
            const to = Utilities.midPoint(command.to.hex.pos, aFourth);

            const d = new Pos(
                to.x - from.x,
                to.y - from.y
            );
            const offset = Utilities.rotate90Degrees(d).multiply(1 / numberOfCommands);
            const origin = new Pos(
                (numberOfCommands - 1) * offset.x / 2 - index * offset.x,
                (numberOfCommands - 1) * offset.y / 2 - index * offset.y
            );

            const arrow = new Konva["Arrow"]({
                fill: command.color,
                listening: false,
                pointerLength: CanvasSettings.arrowPointerLength,
                pointerWidth: CanvasSettings.arrowPointerWidth,
                points: [from.x, from.y, to.x, to.y],
                shadowBlur: CanvasSettings.arrowShadowBlurRadius,
                shadowColor: "#000",
                stroke: command.color,
                strokeWidth: CanvasSettings.arrowWidth,
                x: origin.x,
                y: origin.y
            });

            this.commandsLayer.add(arrow);
        }

        private drawMoveCommands() {
            var groupByFromAndTo: IGroupByFunc<MoveCommand> = command => {
                return command.from.hex.toString() + command.to.hex.toString();
            }

            Canvas.board.cells.forEach(cell => {
                var groups = Utilities.groupByIntoArray(cell.moveCommandsFromCell, groupByFromAndTo);
                groups.forEach(commands => {
                    const oppositeCommands = Canvas.board.getMoveCommands(commands[0].to, commands[0].from);
                    const totalCommands = commands.length + oppositeCommands.length;
                    commands.forEach((command, index) => {
                        this.drawMoveCommand(command, index, totalCommands);
                    });
                });
            });
        }

        private drawNewUnitsForPlayer(player: Player, playerIndex: number, numberOfPlayers: number) {
            const pos = new Pos(
                (playerIndex + 1) * (CanvasSettings.width / (numberOfPlayers + 1)),
                CanvasSettings.width + CanvasSettings.spaceToNewUnits
            );

            Canvas.board.newUnitsForPlayer(player).forEach((unit, unitIndex, units) => {
                if (unit.placeCommand === null) {
                    this.drawUnit(unit, pos, unitIndex, units.length, false);
                }
            });
        }

        private drawPlaceCommand(command: PlaceCommand) {
            throw "drawPlaceCommand() is not yet implemented.";
        }

        private drawUnit(unit: Unit, pos: Pos, unitIndex: number, numberOfUnits: number, movedHere: boolean) {
            const color = movedHere ? unit.movedColor : unit.color;
            const distanceBetweenUnits = CanvasSettings.cellRadius / numberOfUnits;
            const ownedByThisPlayer = unit.player.color === Main.currentPlayer.color;
            const x = pos.x - (numberOfUnits - 1) * distanceBetweenUnits / 2 + unitIndex * distanceBetweenUnits;
            const strokeColor = "#999";

            const circle = new Konva.Circle({
                draggable: this.interactive && ownedByThisPlayer,
                fill: color,
                radius: CanvasSettings.unitRadius,
                shadowBlur: 20,
                shadowColor: "#000",
                shadowEnabled: false,
                shadowOpacity: 0.7,
                stroke: strokeColor,
                strokeWidth: CanvasSettings.lineWidth,
                x: x,
                y: pos.y
            });

            /** Currently hovered hexagon. */
            var currentHexagon: Konva.Shape = null;
            
            /** Previously hovered hexagon.*/
            var previousHexagon: Konva.Shape = null;

            circle.on("dragstart", e => {
                e.target.moveTo(this.dragLayer);
                e.target.shadowEnabled(true);
                document.body.classList.remove("grab-cursor");
                document.body.classList.add("grabbing-cursor");

                var allowedCells: Array<Cell>;
                if (unit.cell === null && unit.placeCommand === null) {
                    allowedCells = Canvas.board.allowedCellsForPlace(unit);
                } else {
                    allowedCells = Canvas.board.allowedCellsForMove(unit);
                }

                allowedCells.forEach(cell => {
                    cell.dropAllowed = true;
                    this.updateCellColor(cell);
                });

                this.boardLayer.draw();
                this.unitsLayer.draw();
            });
            
            // Dragmove is called on every single pixel moved.
            circle.on("dragmove", () => {
                const pos = this.stage.getPointerPosition();
                currentHexagon = this.boardLayer.getIntersection(pos);

                if (currentHexagon === previousHexagon) {
                    // Current same as previous: Don't change anything.
                    return;
                }

                if (currentHexagon === null) {
                    // Only previous defined: Moving out of a cell.
                    previousHexagon.fire(HexagonEvent.dragLeave);
                } else {
                    if (previousHexagon === null) {
                        // Only current defined: Moving into a cell.
                        currentHexagon.fire(HexagonEvent.dragEnter);
                    } else {
                        // Both cells defined and different: Moving from one cell to another.
                        previousHexagon.fire(HexagonEvent.dragLeave);
                        currentHexagon.fire(HexagonEvent.dragEnter);
                    }
                }

                previousHexagon = currentHexagon;
            });

            circle.on("dragend", e => {
                e.target.moveTo(this.unitsLayer);
                e.target.shadowEnabled(false);
                document.body.classList.remove("grabbing-cursor");

                if (currentHexagon !== null) {
                    const currentCell = Canvas.board.nearestCell(new Pos(currentHexagon.x(), currentHexagon.y()));

                    if (currentCell.dropAllowed) {
                        if (unit.cell === null && unit.placeCommand === null) {
                            unit.setPlaceCommand(currentCell);
                        } else {
                            let from: Cell;
                            if (unit.cell === null) {
                                from = unit.placeCommand.on;
                            } else {
                                from = unit.cell;
                            }

                            unit.setMoveCommand(from, currentCell);
                        }
                    }

                    currentCell.hovered = false;
                }

                const numberOfMoveCommands = Main.currentPlayer.numberOfMoveCommands;
                document.getElementById("numberOfMoves").innerHTML = numberOfMoveCommands.toString();
                const movesElement = document.getElementById("moves");
                if (numberOfMoveCommands > Settings.movesPerTurn) {
                    movesElement.classList.add("label", "label-danger");
                } else {
                    movesElement.classList.remove("label", "label-danger");
                }

                currentHexagon = null;
                previousHexagon = null;

                Canvas.board.cells.forEach(cell => {
                    cell.dropAllowed = false;
                });

                this.drawBoard();
            });

            if (this.interactive && ownedByThisPlayer) {
                circle.on("mouseover", () => {
                    document.body.classList.add("grab-cursor");
                });

                circle.on("mouseout", () => {
                    document.body.classList.remove("grab-cursor");
                });
            }

            this.unitsLayer.add(circle);
        }

        private drawUnits() {
            Canvas.board.cells.forEach(cell => {
                this.drawUnitsOnCell(cell);
            });

            Main.game.players.forEach((player, index, players) => {
                this.drawNewUnitsForPlayer(player, index, players.length);
            });
        }

        private drawUnitsOnCell(cell: Cell) {
            const staying = cell.unitsStaying;
            const movedHere = cell.unitsMovedHere;
            const toBeMovedHere = cell.unitsToBeMovedHere;
            const toBePlacedHere = cell.unitsToBePlacedHereAndNotMovedAway;

            const total = staying.length + movedHere.length + toBeMovedHere.length + toBePlacedHere.length;

            staying.forEach((unit, index) => {
                this.drawUnit(unit, cell.hex.pos, index, total, false);
            });

            const movedHereStartIndex = staying.length;
            movedHere.forEach((unit, index) => {
                this.drawUnit(unit, cell.hex.pos, movedHereStartIndex + index, total, false);
            });

            const movingHereStartIndex = movedHereStartIndex + movedHere.length;
            toBeMovedHere.forEach((unit, index) => {
                this.drawUnit(unit, cell.hex.pos, movingHereStartIndex + index, total, true);
            });

            const toBePlacedHereStartIndex = movingHereStartIndex + toBeMovedHere.length;
            toBePlacedHere.forEach((unit, index) => {
                this.drawUnit(unit, cell.hex.pos, toBePlacedHereStartIndex + index, total, true);
            });
        }

        private updateCellColor(cell: Cell) {
            var backgroundColor: string;
            if (cell.dropAllowed) {
                if (cell.hovered) {
                    backgroundColor = "#ddd";
                } else {
                    backgroundColor = "#dfd";
                }
            } else {
                backgroundColor = null;
            }

            cell.hexagon.fill(backgroundColor);
        }
    }
}
