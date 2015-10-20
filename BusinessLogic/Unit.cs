﻿using System;

namespace CocaineCartels.BusinessLogic
{
    public class Unit
    {
        public Unit(Player player)
        {
            MoveCommand = null;
            PlaceCommand = null;
            Player = player;
        }

        public MoveCommand MoveCommand { get; private set; }
        public readonly PlaceCommand PlaceCommand;
        public readonly Player Player;

        internal Cell Cell;

        public MoveCommand SetMoveCommand(Cell to)
        {
            if (Cell == null && PlaceCommand == null)
            {
                throw new ApplicationException("Cannot assign a move command to a unit that isn't positioned on a cell or doesn't have a place command.");
            }

            MoveCommand = new MoveCommand(this, to);
            return MoveCommand;
        }
    }
}
