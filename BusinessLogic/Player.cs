﻿using System;
using System.Collections.Generic;
using System.Net;
using Newtonsoft.Json;

namespace CocaineCartels.BusinessLogic
{
    public class Player : IEquatable<Player>
    {
        internal Player(PlayerColors colors, IPAddress ipAddress, string userAgent)
        {
            Color = colors.MainColor;
            CommandsSentOn = null;
            IpAddress = ipAddress;
            TextColor = colors.TextColor;
            UserAgent = userAgent;

            AllianceProposals = new HashSet<Player>();
            Points = 0;
            PointsLastTurn = 0;
            Ready = false;
        }

        public HashSet<Player> AllianceProposals { get; set; }
        
        /// <summary>The main color also identifies a player, so use this property the player ID.</summary>
        public string Color { get; }

        public DateTime? CommandsSentOn { get; set; }

        [JsonIgnore]
        public IPAddress IpAddress { get; }

        public int Points { get; set; }

        public int PointsLastTurn { get; set; }

        /// <summary>If the game hasn't started yet: The player believe that all players are here. If the game has started: The player has sent in commands and is thus ready for the next turn.</summary>
        public bool Ready { get; set; }

        public string TextColor { get; }

        [JsonIgnore]
        public readonly string UserAgent;

        public bool Equals(Player other)
        {
            bool areEqual = Color == other.Color;
            return areEqual;
        }
    }
}
