var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var AnimationState;
    (function (AnimationState) {
        AnimationState[AnimationState["Undefined"] = 0] = "Undefined";
        AnimationState[AnimationState["BeforeMove"] = 1] = "BeforeMove";
        AnimationState[AnimationState["AfterMove"] = 2] = "AfterMove";
        AnimationState[AnimationState["AfterBattle"] = 3] = "AfterBattle";
    })(AnimationState || (AnimationState = {}));
    var Canvas = (function () {
        function Canvas(turn, canvasId, animated, interactive) {
            this.turn = turn;
            this.canvasId = canvasId;
            this.animated = animated;
            this.interactive = interactive;
            this.killedTweens = [];
            this.moveTweens = [];
            this.newUnitTweens = [];
            //private repositionTweens: Array<TweenCreator> = [];
            this.shapesWithEvents = [];
            if (animated === true && interactive === true) {
                throw "A canvas cannot be both animated and interactive.";
            }
            if (turn !== null) {
                this.drawBoard();
            }
        }
        Canvas.prototype.addLayers = function () {
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
        };
        Object.defineProperty(Canvas.prototype, "allTweens", {
            get: function () {
                var allTweens = this.newUnitTweens.concat(this.moveTweens).concat(this.killedTweens);
                return allTweens;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Canvas.prototype, "dragMode", {
            get: function () {
                if (!this.interactive) {
                    return CocaineCartels.DragMode.None;
                }
                var newUnitsNotYetPlaced = this.turn.newUnits.filter(function (unit) { return unit.player.color === CocaineCartels.Main.currentPlayer.color && unit.placeCommand === null; });
                if (newUnitsNotYetPlaced.length > 0) {
                    return CocaineCartels.DragMode.NewUnits;
                }
                else {
                    return CocaineCartels.DragMode.UnitsOnBoard;
                }
            },
            enumerable: true,
            configurable: true
        });
        /** Return's the unit's posistion including offset calculations. If the unit isn't positioned on a cell, or if the unit is killed then null is returned. */
        Canvas.prototype.getAnimatedUnitPosition = function (unit, state) {
            var cell;
            var unitsOnCell = null;
            switch (state) {
                case AnimationState.BeforeMove:
                    cell = unit.cellAfterPlaceBeforeMove;
                    if (cell === null) {
                        return null;
                    }
                    unitsOnCell = unit.cell.board.allUnits.filter(function (u) { return u.cellAfterPlaceBeforeMove === cell; });
                    break;
                case AnimationState.AfterMove:
                    cell = unit.cellAfterPlaceAndMove;
                    if (cell === null) {
                        return null;
                    }
                    unitsOnCell = unit.cell.board.allUnits.filter(function (u) { return u.cellAfterPlaceAndMove === cell; });
                    break;
                case AnimationState.AfterBattle:
                    if (unit.killed) {
                        return null;
                    }
                    cell = unit.cellAfterPlaceAndMove;
                    unitsOnCell = unit.cell.board.allUnits.filter(function (u) { return !u.killed && u.cellAfterPlaceAndMove === cell; });
                    break;
                default:
                    throw "The state " + state + " is not supported.";
            }
            var unitIndex = unitsOnCell.indexOf(unit);
            if (unitIndex === -1) {
                throw "The unit was not found on the cell. Don't know where to draw it then.";
            }
            var position = this.getOffsetPosition(cell.hex.pos, unitIndex, unitsOnCell.length);
            return position;
        };
        Canvas.prototype.getOffsetPosition = function (basePosition, unitIndex, unitsOnCell) {
            var distanceBetweenUnits = CocaineCartels.CanvasSettings.cellRadius / unitsOnCell;
            var x = basePosition.x - (unitsOnCell - 1) * distanceBetweenUnits / 2 + unitIndex * distanceBetweenUnits;
            var position = new CocaineCartels.Pos(x, basePosition.y);
            return position;
        };
        Canvas.prototype.destroy = function () {
            this.shapesWithEvents.forEach(function (shape) {
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
                this.commandsLayer.getChildren().each(function (node) {
                    node.destroy();
                });
                this.dragLayer.getChildren().each(function (node) {
                    node.destroy();
                });
                this.unitsLayer.getChildren().each(function (node) {
                    node.destroy();
                });
                this.boardLayer.destroy();
                this.commandsLayer.destroy();
                this.dragLayer.destroy();
                this.unitsLayer.destroy();
            }
        };
        /** Currently redraws the board from scratch each time, re-adding all units and commands. */
        Canvas.prototype.drawBoard = function () {
            this.stage = new Konva.Stage({
                container: this.canvasId,
                height: CocaineCartels.CanvasSettings.height,
                width: CocaineCartels.CanvasSettings.width
            });
            this.addLayers();
            // Draw methods are separated this way to match the layers in the game.
            this.drawCells();
            this.drawUnits();
            this.drawMoveCommands();
            this.setUpUnitDragEvents();
            this.stage.draw();
            this.showOrHideMovesLeft();
        };
        Canvas.prototype.drawCell = function (cell) {
            var _this = this;
            var hexagon = new Konva.RegularPolygon({
                x: cell.hex.pos.x,
                y: cell.hex.pos.y,
                radius: CocaineCartels.CanvasSettings.cellRadius,
                sides: 6,
                stroke: "#ccc",
                strokeWidth: CocaineCartels.CanvasSettings.cellBorderWidth
            });
            cell.hexagon = hexagon;
            hexagon.on(CocaineCartels.HexagonEvent.dragEnter, function () {
                cell.hovered = true;
                _this.updateCellColor(cell);
                _this.boardLayer.draw();
            });
            hexagon.on(CocaineCartels.HexagonEvent.dragLeave, function () {
                cell.hovered = false;
                _this.updateCellColor(cell);
                _this.boardLayer.draw();
            });
            this.boardLayer.add(hexagon);
        };
        Canvas.prototype.drawCells = function () {
            var _this = this;
            this.turn.cells.forEach(function (cell) {
                _this.drawCell(cell);
            });
        };
        Canvas.prototype.drawMoveCommand = function (command, index, numberOfCommands) {
            var halfways = CocaineCartels.Utilities.midPoint(command.from.hex.pos, command.to.hex.pos);
            var aFourth = CocaineCartels.Utilities.midPoint(command.from.hex.pos, halfways);
            var threeFourths = CocaineCartels.Utilities.midPoint(command.to.hex.pos, halfways);
            var from = CocaineCartels.Utilities.midPoint(command.from.hex.pos, threeFourths);
            var to = CocaineCartels.Utilities.midPoint(command.to.hex.pos, aFourth);
            var d = new CocaineCartels.Pos(to.x - from.x, to.y - from.y);
            var offset = CocaineCartels.Utilities.rotate90Degrees(d).multiply(1 / numberOfCommands);
            var origin = new CocaineCartels.Pos((numberOfCommands - 1) * offset.x / 2 - index * offset.x, (numberOfCommands - 1) * offset.y / 2 - index * offset.y);
            var arrow = new Konva["Arrow"]({
                fill: command.color,
                listening: false,
                perfectDrawEnabled: false,
                pointerLength: CocaineCartels.CanvasSettings.arrowPointerLength,
                pointerWidth: CocaineCartels.CanvasSettings.arrowPointerWidth,
                points: [from.x, from.y, to.x, to.y],
                shadowBlur: CocaineCartels.CanvasSettings.arrowShadowBlurRadius,
                shadowColor: "#999",
                stroke: command.color,
                strokeWidth: CocaineCartels.CanvasSettings.arrowWidth,
                transformsEnabled: 'position',
                x: origin.x,
                y: origin.y
            });
            this.commandsLayer.add(arrow);
        };
        Canvas.prototype.drawMoveCommands = function () {
            var _this = this;
            var groupByFromAndTo = function (command) {
                return command.from.hex.toString() + command.to.hex.toString();
            };
            this.turn.cells.forEach(function (cell) {
                var groups = CocaineCartels.Utilities.groupByIntoArray(cell.moveCommandsFromCell, groupByFromAndTo);
                groups.forEach(function (commands) {
                    var oppositeCommands = _this.turn.getMoveCommands(commands[0].to, commands[0].from);
                    var totalCommands = commands.length + oppositeCommands.length;
                    commands.forEach(function (command, index) {
                        _this.drawMoveCommand(command, index, totalCommands);
                    });
                });
            });
        };
        Canvas.prototype.drawNewUnitsForPlayer = function (player, playerIndex, numberOfPlayers) {
            var _this = this;
            var pos = new CocaineCartels.Pos((playerIndex + 1) * (CocaineCartels.CanvasSettings.width / (numberOfPlayers + 1)), CocaineCartels.CanvasSettings.width + CocaineCartels.CanvasSettings.spaceToNewUnits);
            this.turn.newUnitsForPlayer(player).forEach(function (unit, unitIndex, units) {
                if (unit.placeCommand === null) {
                    _this.drawUnit(unit, pos, unitIndex, units.length);
                }
            });
        };
        Canvas.prototype.drawUnit = function (unit, basePosition, unitIndex, unitsOnCell) {
            var ownedByThisPlayer = (unit.player.color === CocaineCartels.Main.currentPlayer.color);
            var draggable;
            switch (this.dragMode) {
                case CocaineCartels.DragMode.NewUnits:
                    draggable = ownedByThisPlayer && unit.newUnit && unit.placeCommand === null;
                    break;
                case CocaineCartels.DragMode.UnitsOnBoard:
                    draggable = ownedByThisPlayer;
                    break;
                default:
                    draggable: false;
            }
            var borderColor = ownedByThisPlayer ? "#000" : "#999";
            var borderWidth = CocaineCartels.CanvasSettings.unitBorderWidth;
            var offsetPostion = this.getOffsetPosition(basePosition, unitIndex, unitsOnCell);
            var fillColor = (!this.animated && unit.moveCommand !== null) ? unit.movedColor : unit.color;
            var scale = (this.animated && unit.newUnit) ? 1 / CocaineCartels.CanvasSettings.newUnitScale : 1;
            var unitRadius = CocaineCartels.CanvasSettings.unitRadius;
            if (unit.circle === null) {
                var circle = new Konva.Circle({
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
            }
            else {
                unit.circle.draggable(draggable);
                unit.circle.fill(fillColor);
                unit.circle.stroke(borderColor);
                unit.circle.x(offsetPostion.x);
                unit.circle.y(offsetPostion.y);
                unit.circle.moveToTop();
            }
            var currentlyHoveredHexagon = null;
            var previouslyHoveredHexagon = null;
            if (draggable) {
                unit.circle.on("mouseover", function () {
                    document.body.classList.add("grab-cursor");
                });
                unit.circle.on("mouseout", function () {
                    document.body.classList.remove("grab-cursor");
                });
                this.shapesWithEvents.push(unit.circle);
            }
            else {
                unit.circle.off("mouseover");
                unit.circle.off("mouseout");
            }
            this.unitsLayer.add(unit.circle);
            if (this.animated) {
                if (unit.newUnit) {
                    var newUnitTween = new Konva.Tween({
                        duration: CocaineCartels.CanvasSettings.tweenDuration,
                        easing: Konva.Easings.ElasticEaseOut,
                        node: unit.circle,
                        scaleX: 1,
                        scaleY: 1,
                    });
                    this.newUnitTweens.push(newUnitTween);
                }
                var positionAfterMove = this.getAnimatedUnitPosition(unit, AnimationState.AfterMove);
                if (positionAfterMove !== null) {
                    var moveTween = new Konva.Tween({
                        duration: CocaineCartels.CanvasSettings.tweenDuration,
                        easing: Konva.Easings.ElasticEaseInOut,
                        node: unit.circle,
                        x: positionAfterMove.x,
                        y: positionAfterMove.y
                    });
                    this.moveTweens.push(moveTween);
                }
                if (unit.killed) {
                    // Can't set scale here, because this screws up the new unit tween.
                    var killedTween = new Konva.Tween({
                        duration: CocaineCartels.CanvasSettings.tweenDuration,
                        easing: Konva.Easings.EaseOut,
                        node: unit.circle,
                        opacity: 0
                    });
                    this.killedTweens.push(killedTween);
                }
            }
        };
        Canvas.prototype.drawUnits = function () {
            var _this = this;
            this.turn.cells.forEach(function (cell) {
                _this.drawUnitsOnCell(cell);
            });
            CocaineCartels.Main.game.players.forEach(function (player, index, players) {
                _this.drawNewUnitsForPlayer(player, index, players.length);
            });
        };
        Canvas.prototype.drawUnitsOnCell = function (cell) {
            var _this = this;
            if (this.animated) {
                var unitsOnCell = cell.board.allUnits.filter(function (unit) { return unit.cellAfterPlaceBeforeMove === cell; });
                unitsOnCell.forEach(function (unit, index) {
                    _this.drawUnit(unit, unit.cellAfterPlaceBeforeMove.hex.pos, index, unitsOnCell.length);
                });
            }
            else {
                var unitsOnCell = cell.board.allUnits.filter(function (unit) { return unit.cellAfterPlaceAndMove === cell; });
                unitsOnCell.forEach(function (unit, index) {
                    _this.drawUnit(unit, cell.hex.pos, index, unitsOnCell.length);
                });
            }
        };
        Canvas.prototype.redrawBoard = function () {
            this.drawUnits();
            this.commandsLayer.destroyChildren();
            this.drawMoveCommands();
            this.stage.draw();
            CocaineCartels.Main.printTurnMode(this.dragMode); // Not necessary to call this in drawBoard() because the job's already done by Main.ts.
            this.showOrHideMovesLeft();
        };
        Canvas.prototype.replayLastTurn = function () {
            var _this = this;
            // Reset all the tweens.
            this.allTweens.forEach(function (tween) {
                tween.reset();
            });
            // Animate new units.
            this.newUnitTweens.forEach(function (tween) {
                tween.play();
            });
            var allDoneDelay = CocaineCartels.CanvasSettings.tweenDuration + CocaineCartels.CanvasSettings.delayAfterTween;
            var moveDelay = CocaineCartels.CanvasSettings.tweenDuration + CocaineCartels.CanvasSettings.delayAfterTween;
            allDoneDelay += moveDelay;
            setTimeout(function () {
                // Animate moves.
                _this.moveTweens.forEach(function (tween) {
                    tween.play();
                });
            }, moveDelay * 1000);
            if (this.killedTweens.length > 0) {
                var killedDelay = moveDelay + CocaineCartels.CanvasSettings.tweenDuration + CocaineCartels.CanvasSettings.delayAfterTween;
                allDoneDelay += killedDelay;
                setTimeout(function () {
                    // Animate killed units.
                    _this.killedTweens.forEach(function (tween) {
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
            var promise = new Promise(function (resolve, reject) {
                setTimeout(function () {
                    resolve();
                    //this.repositionTweens.forEach(tween => {
                    //    //tween.destroy();
                    //});
                }, allDoneDelay * 1000);
            });
            return promise;
        };
        Canvas.prototype.resetMoves = function () {
            this.turn.allUnits.forEach(function (unit) {
                unit.moveCommand = null;
                unit.placeCommand = null;
            });
            this.redrawBoard();
        };
        Canvas.prototype.setUpUnitDragEvents = function () {
            var _this = this;
            var currentlyHoveredHexagon = null;
            var previouslyHoveredHexagon = null;
            var unitBeingDragged = null;
            this.stage.on("dragstart", function (e) {
                e.target.moveTo(_this.dragLayer);
                e.target.shadowEnabled(true);
                document.body.classList.remove("grab-cursor");
                document.body.classList.add("grabbing-cursor");
                unitBeingDragged = _this.turn.allUnits.filter(function (u) { return u.circle === e.target; })[0];
                var allowedCells;
                if (unitBeingDragged.cell === null) {
                    if (unitBeingDragged.placeCommand === null) {
                        allowedCells = _this.turn.allowedCellsForPlace(unitBeingDragged);
                    }
                    else {
                        allowedCells = _this.turn.allowedCellsForPlace(unitBeingDragged).concat(_this.turn.allowedCellsForMove(unitBeingDragged));
                    }
                }
                else {
                    allowedCells = _this.turn.allowedCellsForMove(unitBeingDragged);
                }
                allowedCells.forEach(function (cell) {
                    cell.dropAllowed = true;
                    _this.updateCellColor(cell);
                });
                _this.unitsLayer.draw();
            });
            this.stage.on("dragmove", function () {
                var pos = _this.stage.getPointerPosition();
                currentlyHoveredHexagon = _this.boardLayer.getIntersection(pos);
                if (currentlyHoveredHexagon === previouslyHoveredHexagon) {
                    // Current same as previous: Don't change anything.
                    return;
                }
                if (currentlyHoveredHexagon === null) {
                    // Only previous defined: Moving out of a cell.
                    previouslyHoveredHexagon.fire(CocaineCartels.HexagonEvent.dragLeave);
                }
                else {
                    if (previouslyHoveredHexagon === null) {
                        // Only current defined: Moving into a cell.
                        currentlyHoveredHexagon.fire(CocaineCartels.HexagonEvent.dragEnter);
                    }
                    else {
                        // Both cells defined and different: Moving from one cell to another.
                        previouslyHoveredHexagon.fire(CocaineCartels.HexagonEvent.dragLeave);
                        currentlyHoveredHexagon.fire(CocaineCartels.HexagonEvent.dragEnter);
                    }
                }
                previouslyHoveredHexagon = currentlyHoveredHexagon;
            });
            this.stage.on("dragend", function (e) {
                e.target.moveTo(_this.unitsLayer);
                e.target.shadowEnabled(false);
                document.body.classList.remove("grabbing-cursor");
                if (currentlyHoveredHexagon !== null) {
                    var currentCell = _this.turn.nearestCell(new CocaineCartels.Pos(currentlyHoveredHexagon.x(), currentlyHoveredHexagon.y()));
                    if (currentCell.dropAllowed) {
                        if (unitBeingDragged.cell === null) {
                            if (unitBeingDragged.placeCommand === null) {
                                // It's a place.
                                unitBeingDragged.setPlaceCommand(currentCell);
                                CocaineCartels.Main.setCurrentPlayerNotReadyIfNecessary();
                            }
                            else {
                                // This might be a re-place of a new unit.
                                var cellsAllowedForDrop = _this.turn.allowedCellsForPlace(unitBeingDragged);
                                if (cellsAllowedForDrop.filter(function (c) { return c === currentCell; }).length > 0) {
                                    // It's a re-place.
                                    unitBeingDragged.moveCommand = null;
                                    unitBeingDragged.setPlaceCommand(currentCell);
                                }
                                else {
                                    // It's a move.
                                    var from;
                                    if (unitBeingDragged.cell === null) {
                                        from = unitBeingDragged.placeCommand.on;
                                    }
                                    else {
                                        from = unitBeingDragged.cell;
                                    }
                                    unitBeingDragged.setMoveCommand(from, currentCell);
                                }
                            }
                        }
                        else {
                            // It's a move.
                            var from;
                            if (unitBeingDragged.cell === null) {
                                from = unitBeingDragged.placeCommand.on;
                            }
                            else {
                                from = unitBeingDragged.cell;
                            }
                            unitBeingDragged.setMoveCommand(from, currentCell);
                        }
                        CocaineCartels.Main.setCurrentPlayerNotReadyIfNecessary();
                    }
                    currentCell.hovered = false;
                }
                CocaineCartels.Main.printNumberOfMovesLeft();
                currentlyHoveredHexagon = null;
                previouslyHoveredHexagon = null;
                _this.turn.cells.forEach(function (cell) {
                    cell.dropAllowed = false;
                    _this.updateCellColor(cell);
                });
                _this.redrawBoard();
            });
        };
        Canvas.prototype.showOrHideMovesLeft = function () {
            $("#movesLeft").toggleClass("hidden", this.dragMode !== CocaineCartels.DragMode.UnitsOnBoard);
        };
        Canvas.prototype.updateCellColor = function (cell) {
            var backgroundColor;
            if (cell.dropAllowed) {
                if (cell.hovered) {
                    backgroundColor = CocaineCartels.CanvasSettings.dropAllowedAndHoveredColor;
                }
                else {
                    backgroundColor = CocaineCartels.CanvasSettings.dropAllowedNotHoveredColor;
                }
            }
            else {
                backgroundColor = null;
            }
            cell.hexagon.fill(backgroundColor);
        };
        return Canvas;
    })();
    CocaineCartels.Canvas = Canvas;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    // All these settings are related to the canvas.
    var CanvasSettings = (function () {
        function CanvasSettings() {
        }
        CanvasSettings.initialize = function (gridSize) {
            if (gridSize == null) {
                throw "gridSize must be defined";
            }
            if (gridSize <= 0) {
                throw "gridSize must be positive.";
            }
            var gridGutterWidth = 30; // Also defined in variables.scss.
            var canvasButtonsRowHeight = 43; // Hard coded here, since it might be hidden.
            var headerContainerHeight = 105; // Not using $("#headerContainer").height() because that height changes when the text is added.
            var availableHeight = $(window).height() - (headerContainerHeight + canvasButtonsRowHeight);
            var availableWidth = $(document).width() / 2 - gridGutterWidth;
            var aspectRatio = 10 / 11; // A bit higher than wide to make space for the new units below the board.
            var neededWidthToMatchFullHeight = Math.round(availableHeight * aspectRatio);
            if (neededWidthToMatchFullHeight <= availableWidth) {
                this.height = availableHeight;
                this.width = neededWidthToMatchFullHeight;
            }
            else {
                var neededHeightToMatchFullWidth = Math.round(availableWidth / aspectRatio);
                this.height = neededHeightToMatchFullWidth;
                this.width = availableWidth;
            }
            var boardSize = Math.min(this.height, this.width);
            this.cellRadius = boardSize / (2 * gridSize + 1) * 0.55;
            this.cellBorderWidth = 1 + boardSize / 1000;
            this.spaceToNewUnits = 0;
            this.arrowWidth = 2 * this.cellBorderWidth;
            this.center = new CocaineCartels.Pos(this.width / 2, this.width / 2 - this.cellRadius / 3);
            this.unitBorderWidth = this.cellBorderWidth;
            this.unitRadius = this.cellRadius / 3;
        };
        CanvasSettings.arrowPointerLength = 4;
        CanvasSettings.arrowPointerWidth = 5;
        CanvasSettings.arrowShadowBlurRadius = 10;
        CanvasSettings.dropAllowedAndHoveredColor = "#afa";
        CanvasSettings.dropAllowedNotHoveredColor = "#dfd";
        CanvasSettings.delayAfterTween = 0.3;
        CanvasSettings.killedTweenScale = 10;
        CanvasSettings.newUnitScale = 10;
        CanvasSettings.tweenDuration = 1;
        return CanvasSettings;
    })();
    CocaineCartels.CanvasSettings = CanvasSettings;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var Cell = (function () {
        function Cell(cellData, board) {
            this._units = undefined;
            this.dropAllowed = false;
            this.hovered = false;
            this._cellData = cellData;
            this.board = board;
            this.hex = new CocaineCartels.Hex(cellData.hex.r, cellData.hex.s, cellData.hex.t);
        }
        Object.defineProperty(Cell.prototype, "moveCommandsFromCell", {
            get: function () {
                var moveCommands = this.unitsAlreadyHereOrToBePlacedHere
                    .map(function (unit) { return unit.moveCommand; })
                    .filter(function (moveCommand) { return moveCommand !== null; });
                return moveCommands;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Cell.prototype, "moveCommandsToCell", {
            get: function () {
                var _this = this;
                var commands = CocaineCartels.Main.game.currentTurn.moveCommands.filter(function (moveCommand) { return moveCommand.to === _this; });
                return commands;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Cell.prototype, "units", {
            /** Units on this cell, not taking into account that some of them might have move commands to other cells. Units to be placed on this cell are not included. */
            get: function () {
                var _this = this;
                if (this._units === undefined) {
                    this._units = [];
                    this._cellData.units.forEach(function (unitData) {
                        var unit = new CocaineCartels.Unit(unitData, _this.board, _this);
                        _this.addUnit(unit);
                    });
                }
                return this._units;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Cell.prototype, "unitsAlreadyHereOrToBePlacedHere", {
            /** Returns the units that were already here or to be placed on this cell. Units might be moved to another cell. */
            get: function () {
                var unitsAlreadyHereOrToBePlacedHere = this.units.concat(this.unitsToBePlacedHere);
                return unitsAlreadyHereOrToBePlacedHere;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Cell.prototype, "unitsToBePlacedHere", {
            /** Returns the units to be placed on this cell. Units might be moved to another cell. */
            get: function () {
                var _this = this;
                var unitsToBeplacedHere = this.board.newUnits.filter(function (unit) {
                    return unit.placeCommand !== null && unit.placeCommand.on === _this;
                });
                return unitsToBeplacedHere;
            },
            enumerable: true,
            configurable: true
        });
        Cell.prototype.addUnit = function (unit) {
            if (unit.cell !== null && unit.cell !== this) {
                throw "The unit is already placed on another cell.";
            }
            if (this.units.filter(function (u) { return u === unit; }).length > 0) {
                throw "The unit is already on the cell.";
            }
            this.units.push(unit);
            unit.cell = this;
        };
        /** Returns the Manhatten distance between this cell and another cell. See http://www.redblobgames.com/grids/hexagons/#distances */
        Cell.prototype.distance = function (other) {
            var distance = Math.max(Math.abs(this.hex.r - other.hex.r), Math.abs(this.hex.s - other.hex.s), Math.abs(this.hex.t - other.hex.t));
            return distance;
        };
        Cell.prototype.removeUnit = function (unit) {
            var unitsToRemove = this.units.filter(function (u) { return u === unit; });
            unitsToRemove.forEach(function (u) {
                u.cell = null;
            });
            this._units = this.units.filter(function (u) { return u !== unit; });
        };
        return Cell;
    })();
    CocaineCartels.Cell = Cell;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var ClientAllianceProposal = (function () {
        function ClientAllianceProposal(toPlayer) {
            this.toPlayer = toPlayer;
        }
        return ClientAllianceProposal;
    })();
    CocaineCartels.ClientAllianceProposal = ClientAllianceProposal;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var ClientCommands = (function () {
        function ClientCommands(allianceProposals, moveCommands, placeCommands) {
            this.allianceProposals = allianceProposals;
            this.moveCommands = moveCommands;
            this.placeCommands = placeCommands;
        }
        return ClientCommands;
    })();
    CocaineCartels.ClientCommands = ClientCommands;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var ClientMoveCommand = (function () {
        function ClientMoveCommand(from, to) {
            this.from = from;
            this.to = to;
        }
        return ClientMoveCommand;
    })();
    CocaineCartels.ClientMoveCommand = ClientMoveCommand;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var ClientPlaceCommand = (function () {
        function ClientPlaceCommand(on) {
            this.on = on;
        }
        return ClientPlaceCommand;
    })();
    CocaineCartels.ClientPlaceCommand = ClientPlaceCommand;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    (function (CommandType) {
        CommandType[CommandType["MoveCommand"] = 0] = "MoveCommand";
        CommandType[CommandType["PlaceCommand"] = 1] = "PlaceCommand";
    })(CocaineCartels.CommandType || (CocaineCartels.CommandType = {}));
    var CommandType = CocaineCartels.CommandType;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var Command = (function () {
        function Command(type, unit) {
            this.type = type;
            this.unit = unit;
            if (unit == null) {
                throw "'unit' must be defined.";
            }
        }
        Object.defineProperty(Command.prototype, "player", {
            get: function () {
                return this.unit.player;
            },
            enumerable: true,
            configurable: true
        });
        return Command;
    })();
    CocaineCartels.Command = Command;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    (function (DragMode) {
        DragMode[DragMode["Undefined"] = 0] = "Undefined";
        DragMode[DragMode["None"] = 1] = "None";
        DragMode[DragMode["NewUnits"] = 2] = "NewUnits";
        DragMode[DragMode["UnitsOnBoard"] = 3] = "UnitsOnBoard";
    })(CocaineCartels.DragMode || (CocaineCartels.DragMode = {}));
    var DragMode = CocaineCartels.DragMode;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var Game = (function () {
        function Game(currentTurnData, gameData) {
            var _this = this;
            this.players = [];
            gameData.players.forEach(function (playerData) {
                var player = new CocaineCartels.Player(playerData);
                _this.players.push(player);
            });
            if (gameData.previousTurn === null) {
                this.previousTurn = null;
            }
            else {
                this.previousTurn = new CocaineCartels.Turn(gameData.previousTurn);
            }
            this.currentTurn = new CocaineCartels.Turn(currentTurnData);
            this.gridSize = gameData.gridSize;
            this.started = gameData.started;
        }
        Object.defineProperty(Game.prototype, "players", {
            get: function () {
                var sortedPlayers = this._players.sort(function (playerA, playerB) { return playerA.sortValue - playerB.sortValue; });
                return sortedPlayers;
            },
            set: function (players) {
                this._players = players;
            },
            enumerable: true,
            configurable: true
        });
        /** Returns the player with the specified color. Returns null if the player wasn't found. */
        Game.prototype.getPlayer = function (playerColor) {
            var players = this.players.filter(function (p) { return p.color === playerColor; });
            if (players.length === 0) {
                return null;
            }
            return players[0];
        };
        /** Hacky solution for initializing the boards. */
        Game.prototype.initializeBoard = function (board) {
            if (board === null) {
                return;
            }
            // Initialize the units on the board.
            // ReSharper disable once QualifiedExpressionMaybeNull
            board.cells.forEach(function (cell) {
                cell.units.forEach(function (unit) {
                    // ReSharper disable once WrongExpressionStatement
                    unit.player;
                });
            });
            board.newUnits.forEach(function (unit) {
                // ReSharper disable once WrongExpressionStatement
                unit.player;
            });
        };
        return Game;
    })();
    CocaineCartels.Game = Game;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var GameService = (function () {
        function GameService() {
        }
        GameService.getGameState = function () {
            return CocaineCartels.HttpClient.get("/api/gamestate").then(function (gameStateData) {
                var gameState = new CocaineCartels.GameState(gameStateData);
                return gameState;
            });
        };
        GameService.getStatus = function () {
            return CocaineCartels.HttpClient.get("/api/status");
        };
        GameService.notReady = function () {
            return CocaineCartels.HttpClient.get("/api/notready");
        };
        GameService.resetGame = function () {
            return CocaineCartels.HttpClient.get("/api/reset");
        };
        GameService.sendCommands = function (commands) {
            return CocaineCartels.HttpClient.post("/api/commands", commands);
        };
        GameService.setAllPlayersSeemToBeHere = function (allSeemToBeHere) {
            return CocaineCartels.HttpClient.get("/api/setallplayershere/" + allSeemToBeHere);
        };
        return GameService;
    })();
    CocaineCartels.GameService = GameService;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var GameState = (function () {
        function GameState(gameStateData) {
            this.gameInstance = new CocaineCartels.Game(gameStateData.currentTurn, gameStateData.gameInstance);
            this.currentPlayer = this.gameInstance.getPlayer(gameStateData.currentPlayerColor);
        }
        return GameState;
    })();
    CocaineCartels.GameState = GameState;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    /** Hexagon coordinates with r, s and t. */
    var Hex = (function () {
        function Hex(r, s, t) {
            this.r = r;
            this.s = s;
            this.t = t;
            this._pos = null;
            var sum = r + s + t;
            if (sum !== 0) {
                throw "The sum of r, s and t must be equal to 0. " + r + " + " + s + " + " + t + " is " + sum + ".";
            }
        }
        Object.defineProperty(Hex.prototype, "pos", {
            get: function () {
                if (this._pos === null) {
                    this._pos = Hex.hexToPos(this);
                }
                return this._pos;
            },
            enumerable: true,
            configurable: true
        });
        Hex.prototype.equals = function (other) {
            var equals = (this.r === other.r && this.s === other.s && this.t === other.t);
            return equals;
        };
        Hex.hexToPos = function (hex) {
            if (CocaineCartels.CanvasSettings.width == null || CocaineCartels.CanvasSettings.height == null || CocaineCartels.CanvasSettings.cellRadius == null) {
                throw "CanvasSettings haven't been initialized.";
            }
            var x = CocaineCartels.CanvasSettings.center.x + Math.sqrt(3) * CocaineCartels.CanvasSettings.cellRadius * hex.r + Math.sqrt(3) / 2 * CocaineCartels.CanvasSettings.cellRadius * hex.t;
            var y = CocaineCartels.CanvasSettings.center.y + 1.5 * CocaineCartels.CanvasSettings.cellRadius * hex.t;
            var pos = new CocaineCartels.Pos(x, y);
            return pos;
        };
        Hex.prototype.toString = function () {
            var stringValue = "(" + this.r + "," + this.s + "," + this.t + ")";
            return stringValue;
        };
        return Hex;
    })();
    CocaineCartels.Hex = Hex;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var HexagonEvent = (function () {
        function HexagonEvent() {
        }
        HexagonEvent.dragEnter = "dragenter";
        HexagonEvent.dragLeave = "dragleave";
        return HexagonEvent;
    })();
    CocaineCartels.HexagonEvent = HexagonEvent;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var HttpMethod;
    (function (HttpMethod) {
        HttpMethod[HttpMethod["Get"] = 0] = "Get";
        HttpMethod[HttpMethod["Post"] = 1] = "Post";
    })(HttpMethod || (HttpMethod = {}));
    var HttpClient = (function () {
        function HttpClient() {
        }
        HttpClient.ajax = function (method, url, errorMessage, data) {
            var jsonData = null;
            if (data != null) {
                jsonData = JSON.stringify(data);
            }
            var promise = new Promise(function (resolve, reject) {
                var client = new XMLHttpRequest();
                client.timeout = 10 * 1000; // 10 seconds timeout as stardard.
                client.responseType = "json";
                client.open(method === HttpMethod.Get ? "GET" : "POST", url);
                if (method === HttpMethod.Post) {
                    client.setRequestHeader("Content-Type", "application/json");
                }
                client.send(jsonData);
                client.onload = function () {
                    var object = client.response;
                    if (object === null) {
                        if (client.status !== 200 && client.status !== 204) {
                            reject("Status is " + client.status + " " + client.statusText + ". Only 200 OK and 204 No Content are supported when a null is returned.");
                        }
                    }
                    else {
                        if (client.status !== 200) {
                            console.error(client.response);
                            reject("Status is " + client.status + " " + client.statusText + ". Only 200 OK is supported when a value is returned.");
                        }
                    }
                    resolve(object);
                };
                client.onerror = function () {
                    reject("Error " + errorMessage + " '" + url + "': " + client.statusText + ".");
                };
            });
            return promise;
        };
        HttpClient.get = function (url) {
            var promise = HttpClient.ajax(HttpMethod.Get, url, "getting data from");
            return promise;
        };
        HttpClient.post = function (url, data) {
            var promise = HttpClient.ajax(HttpMethod.Post, url, "posting data to", data);
            return promise;
        };
        return HttpClient;
    })();
    CocaineCartels.HttpClient = HttpClient;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
//module CocaineCartels {
//    "use strict";
//    export interface ITweenSettings {
//        easing: Konva.Easings;
//        scaleX?: number;
//        scaleY?: number;
//        x?: number;
//        y?: number;
//    }
//}
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    (function (TurnMode) {
        TurnMode[TurnMode["Undefined"] = 0] = "Undefined";
        TurnMode[TurnMode["PlanMoves"] = 1] = "PlanMoves";
        TurnMode[TurnMode["ProposeAlliances"] = 2] = "ProposeAlliances";
        TurnMode[TurnMode["StartGame"] = 3] = "StartGame";
    })(CocaineCartels.TurnMode || (CocaineCartels.TurnMode = {}));
    var TurnMode = CocaineCartels.TurnMode;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var Main = (function () {
        function Main() {
            this.checkBrowser();
            this.refreshGame();
        }
        Main.prototype.allPlayersSeemToBeHereClicked = function () {
            Main.currentPlayer.ready = !Main.currentPlayer.ready;
            CocaineCartels.GameService.setAllPlayersSeemToBeHere(Main.currentPlayer.ready);
            if (Main.currentPlayer.ready) {
                $("#allPlayersSeemToBeHereButton").addClass("active");
            }
            else {
                $("#allPlayersSeemToBeHereButton").removeClass("active");
            }
            this.printStartPlayersReady();
        };
        Main.prototype.allPlayersAreReady = function () {
            var playersWhoAreNotReady = Main.game.players.filter(function (player) { return !player.ready; }).length;
            return playersWhoAreNotReady === 0;
        };
        Main.prototype.checkBrowser = function () {
            var userAgent = window.navigator.userAgent;
            var isInternetExplorer = userAgent.indexOf("MSIE") !== -1;
            var isSafari = (userAgent.indexOf("Safari") !== -1 && userAgent.indexOf("Chrome") === -1);
            if (isInternetExplorer || isSafari) {
                return;
            }
            $("#unsupportedBrowserWarning").addClass("hidden");
        };
        Main.prototype.confirmResetGame = function () {
            if (Main.game !== undefined && Main.game.started) {
                if (!window.confirm("Sure you want to reset the game?")) {
                    return;
                }
            }
            this.resetGame();
        };
        Main.prototype.isInDemoMode = function () {
            var paramters = CocaineCartels.Utilities.getUrlParameters();
            var mode = paramters["mode"];
            var inDemoMode = mode === "demo";
            return inDemoMode;
        };
        Main.getPlayerBadge = function (player, emptyIfNotReady) {
            var label = Main.getPlayerLabel(player, "&nbsp;&nbsp;&nbsp;", !emptyIfNotReady || player.ready);
            return label;
        };
        Main.getPlayerLabel = function (player, content, filledBackground) {
            if (filledBackground) {
                var label = "<span class=\"label label-border\" style=\"border-color: " + player.color + "; background-color: " + player.color + ";\">" + content + "</span>";
                return label;
            }
            else {
                var label = "<span class=\"label label-border\" style=\"border-color: " + player.color + ";\">" + content + "</span>";
                return label;
            }
        };
        Main.getTurnModeStrings = function (turnMode, dragMode) {
            switch (Main.game.currentTurn.mode) {
                case CocaineCartels.TurnMode.PlanMoves:
                    switch (dragMode) {
                        case CocaineCartels.DragMode.NewUnits:
                            return new TurnModeStrings("Place new units", "Reinforce you positions by dragging your new units to the territories that you already control. All players get " + CocaineCartels.Settings.newUnitsPerTurn + " new units per turn plus a unit for each " + CocaineCartels.Settings.newUnitPerCellsControlled + " cell controlled.");
                        case CocaineCartels.DragMode.UnitsOnBoard:
                            return new TurnModeStrings("Move units", "Drag units to conquer new territories or reinforce your positions. You get one point per turn for each territory you control. You can move up to " + CocaineCartels.Settings.movesPerTurn + " units per turn. Press the Ready button when done.");
                        default:
                            throw "The DragMode " + dragMode + " is not supported.";
                    }
                case CocaineCartels.TurnMode.ProposeAlliances:
                    return new TurnModeStrings("Propose alliances", "Check the players that you would like to propose alliances to. If any of your alliance propositions are returned, an alliance is formed for the next turn. Press the Ready button when done.");
                case CocaineCartels.TurnMode.StartGame:
                    return new TurnModeStrings("Waiting for players to join", "Waiting for players to join the game. Once you can see that the number of players is correct, press the Ready button. The game will start when all players have pressed the button.");
                default:
                case CocaineCartels.TurnMode.Undefined:
                    return new TurnModeStrings("Unknown", "Unknown");
            }
        };
        Main.printAllAlliances = function () {
            switch (Main.game.currentTurn.mode) {
                case CocaineCartels.TurnMode.ProposeAlliances:
                    var allAlliances = Main.game.currentTurn.alliances.alliancePairs
                        .map(function (pair) {
                        return "<div><span style=\"color: " + pair.playerA.color + "\">" + pair.playerA.name + "</span> & <span style=\"color: " + pair.playerB.color + "\">" + pair.playerB.name + "</span></div>";
                    });
                    var allAlliancesText;
                    if (allAlliances.length >= 1) {
                        allAlliancesText = allAlliances.join(" ");
                    }
                    else {
                        allAlliancesText = "No players were allied.";
                    }
                    $("#allAlliancesList").html(allAlliancesText);
                    $("#allAlliances").removeClass("hidden");
                    break;
                default:
                    $("#allAlliances").addClass("hidden");
            }
        };
        Main.printAllianceCheckboxes = function () {
            switch (Main.game.currentTurn.mode) {
                case CocaineCartels.TurnMode.ProposeAlliances:
                    var allianceProposals = Main.game.currentTurn.allianceProposals.map(function (proposal) { return proposal.toPlayer.color; });
                    var enemies = Main.game.players.filter(function (p) { return p !== Main.currentPlayer; });
                    var allianceCheckboxes = enemies
                        .map(function (enemy) {
                        var isChecked = (allianceProposals.indexOf(enemy.color) !== -1);
                        var checked = isChecked ? " checked=\"\"" : "";
                        var playerButton = "<div class=\"checkbox\"><label><input type=\"checkbox\" value=\"" + enemy.color + "\" " + checked + " onclick=\"cocaineCartels.toggleProposeAllianceWith();\" class=\"jsAllianceProposal\" /> <span style=\"color: " + enemy.color + "\">" + enemy.name + "</span></label></div>";
                        return playerButton;
                    })
                        .join(" ");
                    $("#allianceCheckboxes").html(allianceCheckboxes);
                    $("#allianceProposals").removeClass("hidden");
                    break;
                default:
                    $("#allianceProposals").addClass("hidden");
            }
        };
        Main.printNumberOfMovesLeft = function () {
            var numberOfMovesLeft = CocaineCartels.Settings.movesPerTurn - Main.currentPlayer.numberOfMoveCommands;
            document.getElementById("numberOfMovesLeft").innerHTML = numberOfMovesLeft.toString();
            var movesElement = $("#movesLeft");
            if (numberOfMovesLeft < 0) {
                movesElement.addClass("label label-danger");
            }
            else {
                movesElement.removeClass("label label-danger");
            }
        };
        Main.printOwnAlliances = function () {
            switch (Main.game.currentTurn.mode) {
                case CocaineCartels.TurnMode.PlanMoves:
                    var ownAlliances = Main.game.currentTurn.alliances.alliancePairs
                        .map(function (pair) {
                        var html = [
                            "<div>",
                            (" <span style=\"color: " + pair.playerA.color + "\">" + pair.playerA.name + "</span>"),
                            " & ",
                            (" <span style=\"color: " + pair.playerB.color + "\">" + pair.playerB.name + "</span>"),
                            "</div>"
                        ].join("");
                        return html;
                    });
                    var ownAlliancesText;
                    if (ownAlliances.length >= 1) {
                        ownAlliancesText = ownAlliances.join(" ");
                    }
                    else {
                        ownAlliancesText = "You're not allied with anybody.";
                    }
                    $("#ownAlliancesList").html(ownAlliancesText);
                    $("#ownAlliances").removeClass("hidden");
                    break;
                default:
                    $("#ownAlliances").addClass("hidden");
            }
        };
        Main.printPlayersPoints = function (showLastTurnsPoints) {
            var playerPointsRows = Main.game.players
                .sort(function (playerA, playerB) { return playerB.points - playerA.points; })
                .map(function (player) {
                var points;
                var addedPoints;
                if (showLastTurnsPoints) {
                    points = player.points - player.pointsLastTurn;
                    addedPoints = "";
                }
                else {
                    points = player.points;
                    addedPoints = "+" + player.pointsLastTurn;
                }
                var playerPoints = [
                    "<p>",
                    Main.getPlayerLabel(player, points.toString(), true),
                    ("  " + addedPoints),
                    "</p>"
                ].join("");
                return playerPoints;
            });
            var playersPoints = [
                "<table>",
                playerPointsRows.join(""),
                "</table>"
            ].join("");
            $("#playersPoints").html(playersPoints);
        };
        Main.printPlayersStatus = function () {
            var playersStatus = Main.game.players
                .map(function (player) {
                return Main.getPlayerBadge(player, true);
            })
                .join(" ");
            document.getElementById("playersStatus").innerHTML = playersStatus;
        };
        Main.prototype.printStartPage = function () {
            $("#startNumberOfPlayers").html(Main.game.players.length.toString());
            $("#playerColor").html(Main.getPlayerBadge(Main.currentPlayer, false));
            this.printStartPlayersReady();
        };
        Main.prototype.printStartPlayersReady = function () {
            var playersColors = Main.game.players.map(function (player) { return Main.getPlayerBadge(player, true); }).join(" ");
            $("#startPlayersColors").html(playersColors);
        };
        /** Static because it's called by Canvas.redrawBoard(). Not the most beautiful code architecture. */
        Main.printTurnMode = function (dragMode) {
            var turnModeStrings = Main.getTurnModeStrings(Main.game.currentTurn.mode, dragMode);
            $("#turnModeHeader").html(turnModeStrings.header);
            $("#turnModeDescription").html(turnModeStrings.description);
        };
        Main.prototype.printTurnNumber = function () {
            var turnNumber = Main.game.currentTurn.turnNumber.toString();
            $("#turnNumber").html(turnNumber);
        };
        Main.prototype.refreshGame = function () {
            var _this = this;
            return this.updateGameState().then(function () {
                // It's actually not necessary to call this every single time the game state is updated.
                CocaineCartels.CanvasSettings.initialize(Main.game.gridSize);
                var widthInPixels = CocaineCartels.CanvasSettings.width + "px";
                if (Main.game.started) {
                    if (_this.interactiveCanvas !== undefined) {
                        _this.interactiveCanvas.destroy();
                        _this.replayCanvas.destroy();
                    }
                    _this.interactiveCanvas = new CocaineCartels.Canvas(Main.game.currentTurn, "interactiveCanvas", false, Main.game.currentTurn.mode === CocaineCartels.TurnMode.PlanMoves);
                    _this.replayCanvas = new CocaineCartels.Canvas(Main.game.previousTurn, "replayCanvas", true, false);
                    $("#resetButton").toggleClass("hidden", Main.game.currentTurn.mode !== CocaineCartels.TurnMode.PlanMoves);
                    $("#playerColor").html(Main.getPlayerBadge(Main.currentPlayer, false));
                    $(".commands").css("width", widthInPixels);
                    var hideReplayButton = (Main.game.previousTurn === null);
                    $("#replayButtonWrapper").toggleClass("hidden", hideReplayButton);
                    $("#readyButton").prop("disabled", false);
                    $("#startGameButton").prop("disabled", true);
                    $("#startGameButton").attr("title", "The game is already started.");
                    $("#readyButton").toggleClass("active", Main.currentPlayer.ready);
                    Main.printNumberOfMovesLeft();
                    Main.printPlayersStatus();
                    Main.printPlayersPoints(false);
                    Main.printAllAlliances();
                    Main.printOwnAlliances();
                    Main.printAllianceCheckboxes();
                    _this.setActiveCanvas("interactiveCanvas");
                    var enableFirstThreeBoards = (Main.game.currentTurn.turnNumber >= 2);
                    for (var i = 1; i <= 3; i++) {
                        var boardButtonId = "#boardButton" + i;
                        $(boardButtonId).prop("disabled", !enableFirstThreeBoards);
                    }
                    $("#gameStarted").removeClass("hidden");
                    $("#gameStopped").addClass("hidden");
                }
                else {
                    $("#gameStartLobby").css("width", widthInPixels);
                    $("#readyButton").prop("disabled", true);
                    $("#startGameButton").prop("disabled", false);
                    $("#startGameButton").removeAttr("title");
                    $("#gameStarted").addClass("hidden");
                    $("#gameStopped").removeClass("hidden");
                }
                _this.printTurnNumber();
                var dragMode = Main.game.currentTurn.turnNumber === 1 ? CocaineCartels.DragMode.UnitsOnBoard : CocaineCartels.DragMode.NewUnits;
                Main.printTurnMode(dragMode);
                $("#administratorCommands").removeClass("hidden");
                _this.printStartPage();
                window.setTimeout(function () { return _this.tick(); }, 1000);
            });
        };
        Main.prototype.reloadPage = function () {
            window.location.reload();
        };
        Main.prototype.replayLastTurn = function () {
            var _this = this;
            $("#replayButton").prop("disabled", true);
            this.setActiveCanvas("replayCanvas");
            this.replayCanvas.replayLastTurn().then(function () {
                _this.setActiveCanvas("interactiveCanvas");
                $("#replayButton").prop("disabled", false);
            });
        };
        Main.prototype.readyButtonClicked = function () {
            if (Main.currentPlayer.ready) {
                Main.setCurrentPlayerNotReady();
            }
            else {
                var readyButtonElement = document.getElementById("readyButton");
                var exceeding = Main.currentPlayer.numberOfMoveCommands - CocaineCartels.Settings.movesPerTurn;
                if (exceeding > 0) {
                    alert("Only up to " + CocaineCartels.Settings.movesPerTurn + " moves are allowed. Please remove some moves and click the ready button again.");
                    readyButtonElement.blur();
                    return;
                }
                readyButtonElement.classList.add("active");
                readyButtonElement.blur();
                this.sendCommands();
            }
        };
        Main.prototype.resetGame = function () {
            var _this = this;
            CocaineCartels.GameService.resetGame().then(function () {
                _this.reloadPage();
            });
        };
        Main.prototype.resetMoves = function () {
            this.interactiveCanvas.resetMoves();
        };
        Main.prototype.sendCommands = function () {
            var commands;
            switch (Main.game.currentTurn.mode) {
                case CocaineCartels.TurnMode.PlanMoves:
                    commands = this.getMoveCommands();
                    break;
                case CocaineCartels.TurnMode.ProposeAlliances:
                    commands = this.getAllianceProposalCommands();
                    break;
                default:
                    throw Main.game.currentTurn.mode + " is not supported.";
            }
            CocaineCartels.GameService.sendCommands(commands)
                .then(function () {
                // This might cause a blinking of the player's status if there is currently a status update in the pipeline.
                Main.currentPlayer.ready = true;
                Main.printPlayersStatus();
            })
                .catch(function (e) {
                alert("Error sending commands: " + e + ".");
            });
        };
        Main.prototype.getAllianceProposalCommands = function () {
            var proposals = [];
            $(".jsAllianceProposal").each(function (index, checkbox) {
                if ($(checkbox).prop("checked")) {
                    var proposal = new CocaineCartels.ClientAllianceProposal($(checkbox).val());
                    proposals.push(proposal);
                }
            });
            var commands = new CocaineCartels.ClientCommands(proposals, null, null);
            return commands;
        };
        Main.prototype.getMoveCommands = function () {
            var currentPlayersUnitsOnBoardOrToBePlacedOnBoard = Main.game.currentTurn.unitsOnBoardOrToBePlacedOnBoard.filter(function (unit) { return unit.player.color === Main.currentPlayer.color; });
            var moveCommands = currentPlayersUnitsOnBoardOrToBePlacedOnBoard
                .filter(function (unit) { return unit.moveCommand !== null; })
                .map(function (unit) { return new CocaineCartels.ClientMoveCommand(unit.moveCommand.from.hex, unit.moveCommand.to.hex); });
            var currentPlayersNewUnits = Main.game.currentTurn.newUnits.filter(function (unit) { return unit.player.color === Main.currentPlayer.color; });
            var placeCommands = currentPlayersNewUnits
                .filter(function (unit) { return unit.placeCommand !== null; })
                .map(function (unit) { return new CocaineCartels.ClientPlaceCommand(unit.placeCommand.on.hex); });
            var commands = new CocaineCartels.ClientCommands(null, moveCommands, placeCommands);
            return commands;
        };
        Main.prototype.setActiveCanvas = function (canvasId) {
            var canvasIds = ["interactiveCanvas", "replayCanvas"];
            canvasIds.forEach(function (id) {
                var canvasElement = $("#" + id);
                if (id === canvasId) {
                    canvasElement.removeClass("hidden");
                }
                else {
                    canvasElement.addClass("hidden");
                }
            });
        };
        Main.setCurrentPlayerNotReady = function () {
            var readyButtonElement = document.getElementById("readyButton");
            readyButtonElement.classList.remove("active");
            readyButtonElement.blur();
            CocaineCartels.GameService.notReady().then(function () {
                Main.currentPlayer.ready = false;
                Main.printPlayersStatus();
            });
        };
        Main.setCurrentPlayerNotReadyIfNecessary = function () {
            if (Main.currentPlayer.ready) {
                Main.setCurrentPlayerNotReady();
            }
        };
        Main.prototype.toggleProposeAllianceWith = function () {
            Main.setCurrentPlayerNotReady();
        };
        Main.prototype.tick = function () {
            var _this = this;
            CocaineCartels.GameService.getStatus()
                .then(function (status) {
                if (Main.currentPlayer.color !== status.currentPlayer.color) {
                    _this.refreshGame();
                    return;
                }
                if (Main.game.currentTurn.turnNumber !== status.turnNumber) {
                    _this.refreshGame().then(function () {
                        if (Main.game.currentTurn.mode === CocaineCartels.TurnMode.ProposeAlliances) {
                            _this.replayLastTurn();
                        }
                    });
                    return;
                }
                if (Main.game.started) {
                    // If the game has been started, just update the players' ready status.
                    status.players.forEach(function (playerData) {
                        var player = Main.game.getPlayer(playerData.color);
                        player.ready = playerData.ready;
                    });
                    Main.printPlayersStatus();
                }
                else {
                    var updateListOfPlayers = false;
                    if (status.players.length !== Main.game.players.length) {
                        updateListOfPlayers = true;
                    }
                    else {
                        for (var i = 0; i < Main.game.players.length; i++) {
                            if (Main.game.players[i].color !== status.players[i].color) {
                                updateListOfPlayers = true;
                            }
                        }
                    }
                    if (updateListOfPlayers) {
                        Main.game.players = [];
                        status.players.forEach(function (playerData) {
                            var player = new CocaineCartels.Player(playerData);
                            Main.game.players.push(player);
                        });
                        _this.printStartPage();
                    }
                    else {
                        // Just update each players' ready status.
                        status.players.forEach(function (playerData) {
                            var player = Main.game.getPlayer(playerData.color);
                            player.ready = playerData.ready;
                        });
                        _this.printStartPlayersReady();
                    }
                }
                window.setTimeout(function () { return _this.tick(); }, 1000);
            })
                .catch(function (e) {
                alert("Oh noes! An internal error occurred. (╯°□°)╯︵ ┻━┻\n\n(Refresh the browser window and hope for the best.)");
                console.error(e);
            });
        };
        Main.prototype.updateGameState = function () {
            return CocaineCartels.GameService.getGameState().then(function (gameState) {
                Main.game = gameState.gameInstance;
                Main.game.initializeBoard(Main.game.previousTurn);
                Main.game.initializeBoard(Main.game.currentTurn);
                Main.currentPlayer = gameState.currentPlayer;
            });
        };
        return Main;
    })();
    CocaineCartels.Main = Main;
    var TurnModeStrings = (function () {
        function TurnModeStrings(header, description) {
            this.header = header;
            this.description = description;
        }
        return TurnModeStrings;
    })();
})(CocaineCartels || (CocaineCartels = {}));
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var MoveCommand = (function (_super) {
        __extends(MoveCommand, _super);
        function MoveCommand(unit, from, to) {
            _super.call(this, CocaineCartels.CommandType.MoveCommand, unit);
            this.unit = unit;
            this.from = from;
            this.to = to;
            this._color = undefined;
            if (unit.cell === null && unit.placeCommand === null) {
                throw "Can only assign move commands to units that are placed on a cell or has a place command.";
            }
        }
        Object.defineProperty(MoveCommand.prototype, "color", {
            get: function () {
                if (this._color === undefined) {
                    this._color = this.unit.player.color;
                }
                return this._color;
            },
            enumerable: true,
            configurable: true
        });
        return MoveCommand;
    })(CocaineCartels.Command);
    CocaineCartels.MoveCommand = MoveCommand;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var PlaceCommand = (function (_super) {
        __extends(PlaceCommand, _super);
        function PlaceCommand(unit, on) {
            _super.call(this, CocaineCartels.CommandType.PlaceCommand, unit);
            this.unit = unit;
            this.on = on;
        }
        return PlaceCommand;
    })(CocaineCartels.Command);
    CocaineCartels.PlaceCommand = PlaceCommand;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var Player = (function () {
        function Player(playerData) {
            this.color = playerData.color;
            this.commandsSentOn = Player.parseDateString(playerData.commandsSentOn);
            this.points = playerData.points;
            this.pointsLastTurn = playerData.pointsLastTurn;
            this.name = playerData.name;
            this.ready = playerData.ready;
            this.sortValue = playerData.sortValue;
        }
        Object.defineProperty(Player.prototype, "numberOfMoveCommands", {
            /** Returns the number of move commands that the current has assigned. */
            get: function () {
                var _this = this;
                var numberOfMoveCommands = CocaineCartels.Main.game.currentTurn.moveCommands.filter(function (command) { return command.player.color === _this.color; }).length;
                return numberOfMoveCommands;
            },
            enumerable: true,
            configurable: true
        });
        Player.parseDateString = function (dateString) {
            if (dateString == null) {
                return null;
            }
            return new Date(dateString);
        };
        return Player;
    })();
    CocaineCartels.Player = Player;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var Pos = (function () {
        function Pos(x, y) {
            this.x = x;
            this.y = y;
        }
        /** Returns the squared distance between two positions. */
        Pos.prototype.distance = function (other) {
            var squaredDistance = Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2);
            return squaredDistance;
        };
        /** Returns a new vector where the x and y values are multipled by a factor. */
        Pos.prototype.multiply = function (factor) {
            var multiplied = new Pos(this.x * factor, this.y * factor);
            return multiplied;
        };
        Pos.prototype.nearestHex = function (hexes) {
            var _this = this;
            var minDist = null;
            var nearestHex;
            hexes.forEach(function (hex) {
                var dist = _this.distance(hex.pos);
                if (minDist === null || dist < minDist) {
                    minDist = dist;
                    nearestHex = hex;
                }
            });
            return nearestHex;
        };
        return Pos;
    })();
    CocaineCartels.Pos = Pos;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var Settings = (function () {
        function Settings() {
        }
        Settings.movesPerTurn = serverSideSettings.MovesPerTurn;
        Settings.newUnitPerCellsControlled = serverSideSettings.NewUnitPerCellsControlled;
        Settings.newUnitsPerTurn = serverSideSettings.NewUnitsPerTurn;
        return Settings;
    })();
    CocaineCartels.Settings = Settings;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var Turn = (function () {
        /** Call initializeUnits after the board has been initialized. */
        function Turn(turnData) {
            var _this = this;
            this.allianceProposals = turnData.allianceProposals;
            this.alliances = turnData.alliances;
            // No units and commands initialized yet.
            this.cells = [];
            turnData.cells.forEach(function (cellData) {
                var cell = new CocaineCartels.Cell(cellData, _this);
                _this.cells.push(cell);
            });
            this.mode = turnData.mode;
            this.newUnits = [];
            turnData.newUnits.forEach(function (unitData) {
                var newUnit = new CocaineCartels.Unit(unitData, _this, null);
                _this.newUnits.push(newUnit);
            });
            this.turnNumber = turnData.turnNumber;
        }
        Object.defineProperty(Turn.prototype, "allUnits", {
            get: function () {
                var allUnits = this.unitsOnBoard.concat(this.newUnits);
                return allUnits;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Turn.prototype, "moveCommands", {
            get: function () {
                var moveCommands = this.unitsOnBoardOrToBePlacedOnBoard
                    .map(function (unit) { return unit.moveCommand; })
                    .filter(function (moveCommand) { return moveCommand !== null; });
                return moveCommands;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Turn.prototype, "unitsOnBoard", {
            /** Returns the list of units placed on the board, i.e. units to be placed on the board are not included. */
            get: function () {
                var unitsDoubleArray = this.cells.map(function (cell) { return cell.units; });
                var units = CocaineCartels.Utilities.flatten(unitsDoubleArray);
                return units;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Turn.prototype, "unitsOnBoardOrToBePlacedOnBoard", {
            get: function () {
                var unitsOnBoardOrToBePlacedOnBoard = this.unitsOnBoard.concat(this.unitsToBePlacedOnBoard);
                return unitsOnBoardOrToBePlacedOnBoard;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Turn.prototype, "unitsToBePlacedOnBoard", {
            get: function () {
                var unitsToBePlacedOnBoard = this.newUnits.filter(function (unit) { return unit.placeCommand !== null; });
                return unitsToBePlacedOnBoard;
            },
            enumerable: true,
            configurable: true
        });
        Turn.prototype.allowedCellsForMove = function (unit) {
            if (unit.cell === null && unit.placeCommand === null) {
                throw "It's not allowed to move a cell that is not on the board or to be placed on the board.";
            }
            var fromCell;
            if (unit.cell !== null) {
                fromCell = unit.cell;
            }
            else {
                fromCell = unit.placeCommand.on;
            }
            var allowedCells = this.cells.filter(function (cell) {
                var allowed = cell.distance(fromCell) <= unit.maximumMoveDistance;
                return allowed;
            });
            return allowedCells;
        };
        Turn.prototype.allowedCellsForPlace = function (unit) {
            var cellsWithUnits = this.cells.filter(function (cell) {
                var cellHasUnitsBelongingToCurrentPlayer = cell.units
                    .filter(function (u) { return u.moveCommand === null; })
                    .filter(function (u) { return u.player === unit.player; })
                    .length > 0;
                return cellHasUnitsBelongingToCurrentPlayer;
            });
            var moveFromCells = this.moveCommands
                .filter(function (mc) { return mc.unit.player === unit.player; })
                .map(function (mc) { return mc.from; });
            var allowedCells = CocaineCartels.Utilities.union(cellsWithUnits, moveFromCells);
            return allowedCells;
        };
        Turn.prototype.getCell = function (hex) {
            var cell = this.cells.filter(function (c) { return c.hex.equals(hex); })[0];
            return cell;
        };
        Turn.prototype.getMoveCommands = function (from, to) {
            var moveCommands = this.moveCommands.filter(function (moveCommand) { return moveCommand.from === from && moveCommand.to === to; });
            return moveCommands;
        };
        Turn.prototype.nearestCell = function (pos) {
            var minDist = null;
            var nearestCell;
            this.cells.forEach(function (cell) {
                var dist = cell.hex.pos.distance(pos);
                if (dist < minDist || minDist === null) {
                    minDist = dist;
                    nearestCell = cell;
                }
            });
            return nearestCell;
        };
        Turn.prototype.newUnitsForPlayer = function (player) {
            var newUnits = this.newUnits.filter(function (u) { return u.player.color === player.color; });
            return newUnits;
        };
        Turn.prototype.placeUnit = function (unit, on) {
            if (unit.cell !== null) {
                throw "The unit is already placed on a cell.";
            }
            on.addUnit(unit);
        };
        return Turn;
    })();
    CocaineCartels.Turn = Turn;
})(CocaineCartels || (CocaineCartels = {}));
//module CocaineCartels {
//    "use strict";
//    export class TweenCreator {
//        constructor(
//            node: Konva.Node,
//            settings: ITweenSettings
//        ) {
//            this.settings = settings;
//            this.settings.node = node;
//            this.settings.duration = CanvasSettings.tweenDuration;
//        }
//        private settings: any;
//        private tween: Konva.Tween;
//        public createAndPlay() {
//            this.tween = new Konva.Tween(this.settings);
//            this.tween.play();
//        }
//        public destroy() {
//            this.tween.reset();
//            this.tween.destroy();
//        }
//    }
//}
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var Unit = (function () {
        /** Set cell to null if this is a new unit. */
        function Unit(unitData, board, cell) {
            this._placeCommand = undefined;
            this._player = undefined;
            this._moveCommand = undefined;
            this._unitData = unitData;
            this.board = board;
            this.cell = cell;
            this.circle = null;
            this.killed = unitData.killed;
            this.newUnit = unitData.newUnit;
            this._color = unitData.player.color;
            this._movedColor = tinycolor(unitData.player.color).lighten(35).toString("hex6");
        }
        Object.defineProperty(Unit.prototype, "cellAfterPlaceBeforeMove", {
            get: function () {
                if (this.moveCommand !== null) {
                    return this.moveCommand.from;
                }
                if (this.placeCommand !== null) {
                    return this.placeCommand.on;
                }
                return this.cell;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Unit.prototype, "cellAfterPlaceAndMove", {
            get: function () {
                if (this.moveCommand !== null) {
                    return this.moveCommand.to;
                }
                if (this.placeCommand !== null) {
                    return this.placeCommand.on;
                }
                return this.cell;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Unit.prototype, "color", {
            /** The color of the unit. Based on the color of the player who onws the unit. */
            get: function () {
                return this._color;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Unit.prototype, "maximumMoveDistance", {
            get: function () {
                return 1;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Unit.prototype, "moveCommand", {
            get: function () {
                if (this._moveCommand === undefined) {
                    if (this._unitData.moveCommand === null) {
                        this.moveCommand = null;
                    }
                    else {
                        var from = this.board.getCell(this._unitData.moveCommand.fromHex);
                        var to = this.board.getCell(this._unitData.moveCommand.toHex);
                        this.setMoveCommand(from, to);
                    }
                }
                return this._moveCommand;
            },
            set: function (newMoveCommand) {
                if (newMoveCommand === null) {
                    this._moveCommand = null;
                    return;
                }
                if (this.cell === null && this.placeCommand === null) {
                    throw "Can only assign a move command to a unit that is positioned on a cell or has a place command.";
                }
                this._moveCommand = newMoveCommand;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Unit.prototype, "movedColor", {
            get: function () {
                return this._movedColor;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Unit.prototype, "placeCommand", {
            get: function () {
                if (this._placeCommand === undefined) {
                    if (this._unitData.placeCommand === null) {
                        this.placeCommand = null;
                    }
                    else {
                        var on = this.board.getCell(this._unitData.placeCommand.onHex);
                        this.setPlaceCommand(on);
                    }
                }
                return this._placeCommand;
            },
            set: function (newPlaceCommand) {
                if (newPlaceCommand === null) {
                    this._placeCommand = null;
                    return;
                }
                // This has been removed for now to allow new units to be highlighted on the second board.
                //if (this.cell !== null) {
                //    throw "Cannot assign a place command to a unit that already is placed on a cell.";
                //}
                this._placeCommand = newPlaceCommand;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Unit.prototype, "player", {
            get: function () {
                if (this._player === undefined) {
                    this._player = CocaineCartels.Main.game.getPlayer(this._unitData.player.color);
                }
                return this._player;
            },
            enumerable: true,
            configurable: true
        });
        Unit.prototype.deleteUnit = function () {
            this.cell = null;
            this._moveCommand = null;
            this._placeCommand = null;
            this._player = null;
        };
        Unit.prototype.setMoveCommand = function (from, to) {
            if (from === to) {
                this.moveCommand = null;
            }
            else {
                this.moveCommand = new CocaineCartels.MoveCommand(this, from, to);
            }
        };
        Unit.prototype.setPlaceCommand = function (on) {
            this.placeCommand = new CocaineCartels.PlaceCommand(this, on);
        };
        return Unit;
    })();
    CocaineCartels.Unit = Unit;
})(CocaineCartels || (CocaineCartels = {}));
var CocaineCartels;
(function (CocaineCartels) {
    "use strict";
    var Utilities = (function () {
        function Utilities() {
        }
        Utilities.flatten = function (doubleArray) {
            var flattened = Array.prototype.concat.apply([], doubleArray);
            return flattened;
        };
        Utilities.getUrlParameters = function () {
            var pl = /\+/g; // Regex for replacing addition symbol with a space
            var search = /([^&=]+)=?([^&]*)/g;
            var decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); };
            var query = window.location.search.substring(1);
            var parameters = {};
            var match;
            while ((match = search.exec(query))) {
                parameters[decode(match[1])] = decode(match[2]);
            }
            return parameters;
        };
        /** Groups elements in array by a key generated by groupByFunc. (You can use JSON.stingify to in the groupByFunc to convert any object in to a string. */
        Utilities.groupBy = function (array, groupByFunc) {
            var associativeArray = {};
            array.forEach(function (item) {
                var key = groupByFunc(item);
                if (associativeArray[key] === undefined) {
                    associativeArray[key] = [];
                }
                associativeArray[key].push(item);
            });
            return associativeArray;
        };
        Utilities.groupByIntoArray = function (array, groupByFunc) {
            var associativeArray = Utilities.groupBy(array, groupByFunc);
            var doubleArray = Utilities.toDoubleArray(associativeArray);
            return doubleArray;
        };
        /** Returns the points halfway between a and b. */
        Utilities.midPoint = function (a, b) {
            var mid = new CocaineCartels.Pos((a.x + b.x) / 2, (a.y + b.y) / 2);
            return mid;
        };
        /** Treats a position as a 2D vector with (0,0) as origin and returns a new vector that is rotated 90 degrees counter clockwize. */
        Utilities.rotate90Degrees = function (vector) {
            var rotated = new CocaineCartels.Pos(-vector.y, vector.x);
            return rotated;
        };
        /** Converts an associative array to a double array. They keys are deleted in the process. */
        Utilities.toDoubleArray = function (associativeArray) {
            var doubleArray = Object.keys(associativeArray).map(function (group) {
                return associativeArray[group];
            });
            return doubleArray;
        };
        /** Returns a union of two arrays of the same type that does not contain any duplicate items. */
        Utilities.union = function (array1, array2) {
            var union = [];
            array1.forEach(function (item) {
                if (union.filter(function (i) { return i === item; }).length === 0) {
                    union.push(item);
                }
            });
            array2.forEach(function (item) {
                if (union.filter(function (i) { return i === item; }).length === 0) {
                    union.push(item);
                }
            });
            return union;
        };
        return Utilities;
    })();
    CocaineCartels.Utilities = Utilities;
})(CocaineCartels || (CocaineCartels = {}));
//# sourceMappingURL=combined.js.map