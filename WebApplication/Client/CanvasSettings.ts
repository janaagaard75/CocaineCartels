module CocaineCartels {
    "use strict";

    // All these settings are related to the canvas.
    export class CanvasSettings {
        public static arrowPointerLength = 4;
        public static arrowPointerWidth = 5;
        public static arrowShadowBlurRadius = 10;
        public static arrowWidth: number;
        public static canvasId = "canvas";
        public static cellRadius: number;
        public static height: number;
        public static lineWidth: number;
        public static unitRadius: number;
        public static width: number;

        public static initialize(gridSize: number) {
            if (gridSize == null) {
                throw "gridSize must be defined.";
            }

            const availableHeigt = window.innerHeight;
            const availableWidth = window.innerWidth;
            const aspectRatio = 2 / 3; // Aspect ratio of an iPhone 4.

            const correspondingWidth = availableHeigt * aspectRatio;
            if (correspondingWidth <= availableWidth) {
                this.height = availableHeigt;
                this.width = correspondingWidth;
            } else {
                const correspondingHeight = availableWidth / aspectRatio;
                this.height = correspondingHeight;
                this.width = availableWidth;
            }

            const boardSize = Math.min(this.height, this.width);

            this.cellRadius = boardSize / (2 * gridSize + 1) * 0.55;
            this.lineWidth = 1 + boardSize / 1000;

            this.arrowWidth = 2 * this.lineWidth;
            this.unitRadius = this.cellRadius / 2.2;
        }
    }
}