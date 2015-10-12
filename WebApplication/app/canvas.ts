﻿module Muep {
    "use strict";

    export class Canvas {
        constructor(
            game: Game
        ) {
            Canvas.game = game;

            this.drawGame();
        }

        private static game: Game; // Has be to static to be accessible inside unitDragBound function.
        private stage: Konva.Stage;

        private backgroundLayer: Konva.Layer;
        private boardLayer: Konva.Layer;
        private commandsLayer: Konva.Layer;
        private dragLayer: Konva.Layer;
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

            this.dragLayer = new Konva.Layer({
                opacity: 0.5
            });
            this.stage.add(this.dragLayer);
        }

        private drawBoard() {
            const background = new Konva.Rect({
                x: 0,
                y: 0,
                width: Settings.width,
                height: Settings.height,
                fill: "#fff"
            });
            this.backgroundLayer.add(background);

            Canvas.game.cells.forEach(cell => {
                this.drawCell(cell);
            });
        }

        private drawCell(cell: Cell) {
            const hexagon = new Konva.RegularPolygon({
                x: cell.hex.pos.x,
                y: cell.hex.pos.y,
                radius: Settings.cellRadius,
                sides: 6,
                stroke: "#ccc",
                strokeWidth: 1
            });

            hexagon.on("dragenter", e => {
                //console.info(`Drag entered cell (${cell.hex.r},${cell.hex.s},${cell.hex.t}).`);
                hexagon.fill("#eee");
                this.boardLayer.draw();
            });

            hexagon.on("dragleave", e => {
                //console.info(`Drag left cell (${cell.hex.r},${cell.hex.s},${cell.hex.t}).`);
                hexagon.fill(null);
                this.boardLayer.draw();
            });

            this.boardLayer.add(hexagon);
        }

        private drawCommand(command: Command) {
            switch (command.type) {
                case CommandType.MoveCommand:
                    this.drawMoveCommand(<MoveCommand>command);
                    break;

                case CommandType.PlaceCommand:
                    this.drawPlaceCommand(<PlaceCommand>command);
                    break;

                default:
                    throw `The command type ${command.type} is not supported.`;
            }
        }

        private drawCommands() {
            Canvas.game.commands.forEach(command => {
                this.drawCommand(command);
            });
        }

        /** Currently redraws the game from scratch each time, re-adding all units and commands. */
        public drawGame() {
            this.stage = new Konva.Stage({
                container: Settings.canvasId,
                height: Settings.height,
                width: Settings.width
            });

            this.addLayers();

            this.drawBoard();
            this.drawUnits();
            this.drawCommands();

            this.stage.draw();
        }

        private drawMoveCommand(command: MoveCommand) {
            const arrow = new Konva["Arrow"]({
                fill: command.unit.commandColor,
                listening: false,
                pointerLength: 4,
                pointerWidth: 5,
                points: [command.from.hex.pos.x, command.from.hex.pos.y, command.to.hex.pos.x, command.to.hex.pos.y],
                shadowBlur: 10,
                shadowColor: "#000",
                stroke: command.unit.commandColor,
                strokeWidth: 2,
                x: 0,
                y: 0
            });

            this.commandsLayer.add(arrow);
        }

        private drawPlaceCommand(command: PlaceCommand) {
            throw "drawPlaceCommand() is not yet implemented.";
        }

        private drawUnit(unit: Unit) {
            const circleRadius = Settings.cellRadius / 1.8;
            const circle = new Konva.Circle({
                draggable: true,
                fill: unit.color,
                radius: circleRadius,
                x: unit.cell.hex.pos.x,
                y: unit.cell.hex.pos.y
            });

            /** Currently hovered hexagon. */
            var currentHexagon: Konva.Shape = null;
            /** Previously hovered hexagon.*/
            var previousHexagon: Konva.Shape = null;

            circle.on("dragstart", e => {
                e.target.moveTo(this.dragLayer);

                const allowedCells = Canvas.game.allowedCellsForMove(unit);
                allowedCells.forEach(cell => {
                    // TODO: Implement.

                    cell.hex; // Get the corresponding hexagon.
                });
            });
            
            // Dragmove is called on every single pixel moved.
            circle.on("dragmove", e => {
                const pos = this.stage.getPointerPosition();

                currentHexagon = this.boardLayer.getIntersection(pos);
                if (currentHexagon !== null) {
                    // TODO: Either move the nearest-logic in here or make a direct link between each cell and each heaxgon.
                    const currentCell = Canvas.game.nearestCell(new Pos(currentHexagon.x(), currentHexagon.y()));
                    const distance = unit.cell.distance(currentCell);

                    if (distance === 0 || distance > unit.maximumMoveDistance) {
                        currentHexagon = null;
                    }
                }

                if (currentHexagon === previousHexagon) {
                    // Current same as previous: Don't change anything.
                    return;
                }

                if (currentHexagon === null) {
                    // Only previous defined: Moving out of a cell.
                    previousHexagon.fire("dragleave");
                } else {
                    if (previousHexagon === null) {
                        // Only current defined: Moving into a cell.
                        currentHexagon.fire("dragenter");
                    } else {
                        // Both cells defined and different: Moving from one cell to another.
                        previousHexagon.fire("dragleave");
                        currentHexagon.fire("dragenter");
                    }
                }

                previousHexagon = currentHexagon;
            });

            circle.on("dragend", e => {
                e.target.moveTo(this.unitsLayer);

                if (currentHexagon !== null) {
                    const from = unit.cell;
                    const event = <MouseEvent>e.evt;
                    const pos = new Pos(event.layerX, event.layerY);
                    const to = Canvas.game.nearestCell(pos);
                    const distance = from.distance(to);

                    if (from !== to && distance <= unit.maximumMoveDistance) {
                        //console.info(`Dragged ${unit.color} unit from (${from.hex.r},${from.hex.s},${from.hex.t}) to (${to.hex.r},${to.hex.s},${to.hex.t}).`);
                        // Move the unit and assign a new move command to it.
                        Canvas.game.moveUnit(unit, to);
                        unit.setMoveCommand(from, to);
                    }
                }

                this.drawGame();
            });

            circle.on("mouseover", () => {
                document.body.style.cursor = "move";
            });

            circle.on("mouseout", () => {
                document.body.style.cursor = "default";
            })

            this.unitsLayer.add(circle);
        }

        private drawUnits() {
            Canvas.game.units.forEach(unit => {
                this.drawUnit(unit);
            });
        }
    }
}
