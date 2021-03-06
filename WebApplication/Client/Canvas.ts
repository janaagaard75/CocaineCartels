﻿module CocaineCartels {
    "use strict";

    enum AnimationState {
        Undefined,
        BeforeMove,
        AfterMove,
        AfterBattle
    }

    export class Canvas {
        constructor(
            private turn: Turn,
            private canvasId: string,
            private animated: boolean,
            private interactive: boolean
        ) {
            if (animated === true && interactive === true) {
                throw "A canvas cannot be both animated and interactive.";
            }

            if (turn !== null) {
                this.drawBoard();
            }
        }

        private boardLayer: Konva.Layer;
        private commandsLayer: Konva.Layer;
        private dragLayer: Konva.Layer;
        private killedTweens: Array<Konva.Tween> = [];
        private moveTweens: Array<Konva.Tween> = [];
        private newUnitTweens: Array<Konva.Tween> = [];
        //private repositionTweens: Array<TweenCreator> = [];
        private shapesWithEvents: Array<Konva.Shape> = [];
        private stage: Konva.Stage;
        private unitsLayer: Konva.Layer;

        private addLayers() {
            this.destroy();

            this.boardLayer = new Konva.Layer();
            this.stage.add(this.boardLayer);

            this.unitsLayer = new Konva.Layer();
            this.stage.add(this.unitsLayer);

            this.commandsLayer = new Konva.Layer();
            this.commandsLayer.hitGraphEnabled(false);
            this.stage.add(this.commandsLayer);

            this.dragLayer = new Konva.Layer();
            this.dragLayer.hitGraphEnabled(false);
            this.stage.add(this.dragLayer);
        }

        private get allTweens(): Array<Konva.Tween> {
            const allTweens = this.newUnitTweens.concat(this.moveTweens).concat(this.killedTweens);
            return allTweens;
        }

        private get dragMode(): DragMode {
            if (!this.interactive) {
                return DragMode.None;
            }

            const newUnitsNotYetPlaced = this.turn.newUnits.filter(unit => unit.player.color === Main.currentPlayer.color && unit.placeCommand === null);

            if (newUnitsNotYetPlaced.length > 0) {
                return DragMode.NewUnits;
            } else {
                return DragMode.UnitsOnBoard;
            }
        }

        /** Return's the unit's posistion including offset calculations. If the unit isn't positioned on a cell, or if the unit is killed then null is returned. */
        private getAnimatedUnitPosition(unit: Unit, state: AnimationState): Pos {
            let cell: Cell;
            let unitsOnCell: Array<Unit> = null;

            switch (state) {
                case AnimationState.BeforeMove:
                    cell = unit.cellAfterPlaceBeforeMove;
                    if (cell === null) {
                        return null;
                    }
                    unitsOnCell = unit.cell.board.allUnits.filter(u => u.cellAfterPlaceBeforeMove === cell);
                    break;

                case AnimationState.AfterMove:
                    cell = unit.cellAfterPlaceAndMove;
                    if (cell === null) {
                        return null;
                    }
                    unitsOnCell = unit.cell.board.allUnits.filter(u => u.cellAfterPlaceAndMove === cell);
                    break;

                case AnimationState.AfterBattle:
                    if (unit.killed) {
                        return null;
                    }
                    cell = unit.cellAfterPlaceAndMove;
                    unitsOnCell = unit.cell.board.allUnits.filter(u => !u.killed && u.cellAfterPlaceAndMove === cell);
                    break;

                default:
                    throw `The state ${state} is not supported.`;
            }

            const unitIndex = unitsOnCell.indexOf(unit);
            if (unitIndex === -1) {
                throw "The unit was not found on the cell. Don't know where to draw it then.";
            }

            const position = this.getOffsetPosition(cell.hex.pos, unitIndex, unitsOnCell.length);
            return position;
        }

        private getOffsetPosition(basePosition: Pos, unitIndex: number, unitsOnCell: number): Pos {
            const distanceBetweenUnits = CanvasSettings.cellRadius / unitsOnCell;
            const x = basePosition.x - (unitsOnCell - 1) * distanceBetweenUnits / 2 + unitIndex * distanceBetweenUnits;
            const position = new Pos(
                x,
                basePosition.y
            );
            return position;
        }

        public destroy() {
            this.shapesWithEvents.forEach(shape => {
                shape.off("dragstart");
                shape.off("dragmove");
                shape.off("dragend");
                shape.off("mouseover");
                shape.off("mouseout");
                shape.listening(false);
                shape.destroy();
            });
            this.shapesWithEvents = [];

            if (this.boardLayer !== undefined) {
                this.commandsLayer.getChildren().each(node => {
                    node.destroy();
                });
                this.dragLayer.getChildren().each(node => {
                    node.destroy();
                });
                this.unitsLayer.getChildren().each(node => {
                    node.destroy();
                });

                this.boardLayer.destroy();
                this.commandsLayer.destroy();
                this.dragLayer.destroy();
                this.unitsLayer.destroy();
            }
        }

        /** Currently redraws the board from scratch each time, re-adding all units and commands. */
        private drawBoard() {
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
            this.setUpUnitDragEvents();

            this.stage.draw();

            this.showOrHideMovesLeft();
        }

        private drawCell(cell: Cell) {
            const hexagon = new Konva.RegularPolygon({
                x: cell.hex.pos.x,
                y: cell.hex.pos.y,
                radius: CanvasSettings.cellRadius,
                sides: 6,
                stroke: "#ccc",
                strokeWidth: CanvasSettings.cellBorderWidth
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
            this.turn.cells.forEach(cell => {
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
                perfectDrawEnabled: false,
                pointerLength: CanvasSettings.arrowPointerLength,
                pointerWidth: CanvasSettings.arrowPointerWidth,
                points: [from.x, from.y, to.x, to.y],
                shadowBlur: CanvasSettings.arrowShadowBlurRadius,
                shadowColor: "#999",
                stroke: command.color,
                strokeWidth: CanvasSettings.arrowWidth,
                transformsEnabled: 'position',
                x: origin.x,
                y: origin.y
            });

            this.commandsLayer.add(arrow);
        }

        private drawMoveCommands() {
            var groupByFromAndTo: IGroupByFunc<MoveCommand> = command => {
                return command.from.hex.toString() + command.to.hex.toString();
            }

            this.turn.cells.forEach(cell => {
                var groups = Utilities.groupByIntoArray(cell.moveCommandsFromCell, groupByFromAndTo);
                groups.forEach(commands => {
                    const oppositeCommands = this.turn.getMoveCommands(commands[0].to, commands[0].from);
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

            this.turn.newUnitsForPlayer(player).forEach((unit, unitIndex, units) => {
                if (unit.placeCommand === null) {
                    this.drawUnit(unit, pos, unitIndex, units.length);
                }
            });
        }

        private drawUnit(unit: Unit, basePosition: Pos, unitIndex: number, unitsOnCell: number) {
            const ownedByThisPlayer = (unit.player.color === Main.currentPlayer.color);

            let draggable: boolean;
            switch (this.dragMode) {
                case DragMode.NewUnits:
                    draggable = ownedByThisPlayer && unit.newUnit && unit.placeCommand === null;
                    break;

                case DragMode.UnitsOnBoard:
                    draggable = ownedByThisPlayer;
                    break;

                default:
                    draggable: false;
            }

            const borderColor = ownedByThisPlayer ? "#000" : "#999";
            const borderWidth = CanvasSettings.unitBorderWidth;
            const offsetPostion = this.getOffsetPosition(basePosition, unitIndex, unitsOnCell);
            const fillColor = (!this.animated && unit.moveCommand !== null) ? unit.movedColor : unit.color;
            const scale = (this.animated && unit.newUnit) ? 1 / CanvasSettings.newUnitScale : 1;
            const unitRadius = CanvasSettings.unitRadius;

            if (unit.circle === null) {
                const circle = new Konva.Circle({
                    draggable: draggable,
                    fill: fillColor,
                    radius: unitRadius,
                    scaleX: scale,
                    scaleY: scale,
                    shadowBlur: 20,
                    shadowColor: "#000",
                    shadowEnabled: false,
                    shadowOpacity: 0.7,
                    stroke: borderColor,
                    strokeWidth: borderWidth,
                    x: offsetPostion.x,
                    y: offsetPostion.y
                });

                unit.circle = circle;
            } else {
                unit.circle.draggable(draggable);
                unit.circle.fill(fillColor);
                unit.circle.stroke(borderColor);
                unit.circle.x(offsetPostion.x);
                unit.circle.y(offsetPostion.y);
                unit.circle.moveToTop();
            }

            var currentlyHoveredHexagon: Konva.Shape = null;
            var previouslyHoveredHexagon: Konva.Shape = null;

            if (draggable) {
                unit.circle.on("mouseover", () => {
                    document.body.classList.add("grab-cursor");
                });

                unit.circle.on("mouseout", () => {
                    document.body.classList.remove("grab-cursor");
                });

                this.shapesWithEvents.push(unit.circle);
            } else {
                unit.circle.off("mouseover");
                unit.circle.off("mouseout");
            }

            this.unitsLayer.add(unit.circle);

            if (this.animated) {
                if (unit.newUnit) {
                    const newUnitTween = new Konva.Tween({
                        duration: CanvasSettings.tweenDuration,
                        easing: Konva.Easings.ElasticEaseOut,
                        node: unit.circle,
                        scaleX: 1,
                        scaleY: 1,
                    });

                    this.newUnitTweens.push(newUnitTween);
                }

                const positionAfterMove = this.getAnimatedUnitPosition(unit, AnimationState.AfterMove);

                if (positionAfterMove !== null) {
                    const moveTween = new Konva.Tween({
                        duration: CanvasSettings.tweenDuration,
                        easing: Konva.Easings.ElasticEaseInOut,
                        node: unit.circle,
                        x: positionAfterMove.x,
                        y: positionAfterMove.y
                    });

                    this.moveTweens.push(moveTween);
                }

                if (unit.killed) {
                    // Can't set scale here, because this screws up the new unit tween.
                    const killedTween = new Konva.Tween({
                        duration: CanvasSettings.tweenDuration,
                        easing: Konva.Easings.EaseOut,
                        node: unit.circle,
                        opacity: 0
                    });

                    this.killedTweens.push(killedTween);
                }

                //const positionAfterKilled = this.getAnimatedUnitPosition(unit, AnimationState.AfterBattle);
                //if (positionAfterKilled !== null) {
                //    const repositionTween = new TweenCreator(
                //        unit.circle,
                //        {
                //            easing: Konva.Easings.ElasticEaseInOut,
                //            x: positionAfterKilled.x,
                //            y: positionAfterKilled.y
                //        }
                //    );

                //    this.repositionTweens.push(repositionTween);
                //}
            }
        }

        private drawUnits() {
            this.turn.cells.forEach(cell => {
                this.drawUnitsOnCell(cell);
            });

            Main.game.players.forEach((player, index, players) => {
                this.drawNewUnitsForPlayer(player, index, players.length);
            });
        }

        private drawUnitsOnCell(cell: Cell) {
            if (this.animated) {
                const unitsOnCell = cell.board.allUnits.filter(unit => unit.cellAfterPlaceBeforeMove === cell);
                unitsOnCell.forEach((unit, index) => {
                    this.drawUnit(unit, unit.cellAfterPlaceBeforeMove.hex.pos, index, unitsOnCell.length);
                });
            } else {
                const unitsOnCell = cell.board.allUnits.filter(unit => unit.cellAfterPlaceAndMove === cell);
                unitsOnCell.forEach((unit, index) => {
                    this.drawUnit(unit, cell.hex.pos, index, unitsOnCell.length);
                });
            }
        }

        private redrawBoard() {
            this.drawUnits();
            this.commandsLayer.destroyChildren();
            this.drawMoveCommands();
            this.stage.draw();
            Main.printTurnMode(this.dragMode); // Not necessary to call this in drawBoard() because the job's already done by Main.ts.
            this.showOrHideMovesLeft();
        }

        public replayLastTurn(): Promise<void> {
            // Reset all the tweens.
            this.allTweens.forEach(tween => {
                tween.reset();
            });

            // Animate new units.
            this.newUnitTweens.forEach(tween => {
                tween.play();
            });
            let allDoneDelay = CanvasSettings.tweenDuration + CanvasSettings.delayAfterTween;

            const moveDelay = CanvasSettings.tweenDuration + CanvasSettings.delayAfterTween;
            allDoneDelay += moveDelay;
            setTimeout(() => {
                // Animate moves.
                this.moveTweens.forEach(tween => {
                    tween.play();
                });
            }, moveDelay * 1000);

            if (this.killedTweens.length > 0) {
                const killedDelay = moveDelay + CanvasSettings.tweenDuration + CanvasSettings.delayAfterTween;
                allDoneDelay += killedDelay;
                setTimeout(() => {
                    // Animate killed units.
                    this.killedTweens.forEach(tween => {
                        tween.play();
                    });
                }, killedDelay * 1000);
            }

            //const repositionDelay = killedDelay + CanvasSettings.tweenDuration + CanvasSettings.delayAfterTween;
            //setTimeout(() => {
            //    this.repositionTweens.forEach(tween => {
            //        //tween.createAndPlay();
            //    });
            //}, repositionDelay * 1000);

            // Switch back to the interactive canvas.
            //const allDoneDelay = moveDelay + CanvasSettings.tweenDuration + CanvasSettings.delayAfterTween;
            var promise = new Promise<void>((resolve, reject) => {
                setTimeout(() => {
                    resolve();
                    //this.repositionTweens.forEach(tween => {
                    //    //tween.destroy();
                    //});
                }, allDoneDelay * 1000);
            });

            return promise;
        }

        public resetMoves() {
            this.turn.allUnits.forEach(unit => {
                unit.moveCommand = null;
                unit.placeCommand = null;
            });

            this.redrawBoard();
        }

        private setUpUnitDragEvents() {
            var currentlyHoveredHexagon: Konva.Shape = null;
            var previouslyHoveredHexagon: Konva.Shape = null;
            var unitBeingDragged: Unit = null;

            this.stage.on("dragstart", e => {
                e.target.moveTo(this.dragLayer);
                e.target.shadowEnabled(true);
                document.body.classList.remove("grab-cursor");
                document.body.classList.add("grabbing-cursor");

                unitBeingDragged = this.turn.allUnits.filter(u => u.circle === e.target)[0];

                var allowedCells: Array<Cell>;
                if (unitBeingDragged.cell === null) {
                    if (unitBeingDragged.placeCommand === null) {
                        allowedCells = this.turn.allowedCellsForPlace(unitBeingDragged);
                    } else {
                        allowedCells = this.turn.allowedCellsForPlace(unitBeingDragged).concat(this.turn.allowedCellsForMove(unitBeingDragged));
                    }
                } else {
                    allowedCells = this.turn.allowedCellsForMove(unitBeingDragged);
                }

                allowedCells.forEach(cell => {
                    cell.dropAllowed = true;
                    this.updateCellColor(cell);
                });

                this.unitsLayer.draw();
            });

            this.stage.on("dragmove", () => {
                const pos = this.stage.getPointerPosition();
                currentlyHoveredHexagon = this.boardLayer.getIntersection(pos);

                if (currentlyHoveredHexagon === previouslyHoveredHexagon) {
                    // Current same as previous: Don't change anything.
                    return;
                }

                if (currentlyHoveredHexagon === null) {
                    // Only previous defined: Moving out of a cell.
                    previouslyHoveredHexagon.fire(HexagonEvent.dragLeave);
                } else {
                    if (previouslyHoveredHexagon === null) {
                        // Only current defined: Moving into a cell.
                        currentlyHoveredHexagon.fire(HexagonEvent.dragEnter);
                    } else {
                        // Both cells defined and different: Moving from one cell to another.
                        previouslyHoveredHexagon.fire(HexagonEvent.dragLeave);
                        currentlyHoveredHexagon.fire(HexagonEvent.dragEnter);
                    }
                }

                previouslyHoveredHexagon = currentlyHoveredHexagon;
            });

            this.stage.on("dragend", e => {
                e.target.moveTo(this.unitsLayer);
                e.target.shadowEnabled(false);
                document.body.classList.remove("grabbing-cursor");

                if (currentlyHoveredHexagon !== null) {
                    const currentCell = this.turn.nearestCell(new Pos(currentlyHoveredHexagon.x(), currentlyHoveredHexagon.y()));

                    if (currentCell.dropAllowed) {
                        if (unitBeingDragged.cell === null) {
                            if (unitBeingDragged.placeCommand === null) {
                                // It's a place.
                                unitBeingDragged.setPlaceCommand(currentCell);
                                Main.setCurrentPlayerNotReadyIfNecessary();
                            } else {
                                // This might be a re-place of a new unit.
                                const cellsAllowedForDrop = this.turn.allowedCellsForPlace(unitBeingDragged)
                                if (cellsAllowedForDrop.filter(c => c === currentCell).length > 0) {
                                    // It's a re-place.
                                    unitBeingDragged.moveCommand = null;
                                    unitBeingDragged.setPlaceCommand(currentCell);
                                } else {
                                    // It's a move.
                                    let from: Cell;
                                    if (unitBeingDragged.cell === null) {
                                        from = unitBeingDragged.placeCommand.on;
                                    } else {
                                        from = unitBeingDragged.cell;
                                    }

                                    unitBeingDragged.setMoveCommand(from, currentCell);
                                }
                            }
                        } else {
                            // It's a move.
                            let from: Cell;
                            if (unitBeingDragged.cell === null) {
                                from = unitBeingDragged.placeCommand.on;
                            } else {
                                from = unitBeingDragged.cell;
                            }

                            unitBeingDragged.setMoveCommand(from, currentCell);
                        }

                        Main.setCurrentPlayerNotReadyIfNecessary();
                    }

                    currentCell.hovered = false;
                }

                Main.printNumberOfMovesLeft();

                currentlyHoveredHexagon = null;
                previouslyHoveredHexagon = null;

                this.turn.cells.forEach(cell => {
                    cell.dropAllowed = false;
                    this.updateCellColor(cell);
                });

                this.redrawBoard();
            });
        }

        private showOrHideMovesLeft() {
            $("#movesLeft").toggleClass("hidden", this.dragMode !== DragMode.UnitsOnBoard);
        }

        private updateCellColor(cell: Cell) {
            var backgroundColor: string;
            if (cell.dropAllowed) {
                if (cell.hovered) {
                    backgroundColor = CanvasSettings.dropAllowedAndHoveredColor;
                } else {
                    backgroundColor = CanvasSettings.dropAllowedNotHoveredColor;
                }
            } else {
                backgroundColor = null;
            }

            cell.hexagon.fill(backgroundColor);
        }
    }
}
